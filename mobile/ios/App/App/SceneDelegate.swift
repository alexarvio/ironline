import UIKit
import Capacitor
import AuthenticationServices
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Capacitor's own screen, with the app's own plugins registered on it.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NorcoachAuthPlugin())
        // No rubber band (11 Nov, Alex: dragging a screen showed blank room above and below it): the view itself, and
        // every scrolling box in the page, which is where the app scrolls. In the app alone; the website keeps its own.
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        let still = """
        (function () {
          var s = document.createElement('style');
          s.textContent = '*, html, body { overscroll-behavior-y: none !important; }';
          (document.head || document.documentElement).appendChild(s);
          document.documentElement.classList.add('native-app');
        })();
        """
        webView?.configuration.userContentController.addUserScript(WKUserScript(source: still, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    /// The status-bar plugin puts the clock back to its config colour each time this screen appears again (after the
    /// camera, the photo picker or a sign-in sheet closes), and the page never hears of it (12 Nov, Alex: "sometimes
    /// they do not"). Tell the page, after the plugin's own reset has run, so it sets the colour for what is under the
    /// clock again (NativeStatusBar, "norcoachappear").
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.triggerWindowJSEvent(eventName: "norcoachappear")
        }
    }
}

/// Signing in from inside the app (11 Nov, Alex). Google refuses to sign in inside an app's web view, so its sign-in runs
/// in Apple's secure sign-in sheet on the site's /auth/native/start, which ends on norcoach://auth with a one-time Clerk
/// ticket the page then signs in with. Sign in with Apple is Apple's own sheet; its identity token goes to Clerk.
/// Called from the site through window.Capacitor (app/lib/native.ts), as "NorcoachAuth".
@objc(NorcoachAuthPlugin)
public class NorcoachAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "NorcoachAuthPlugin"
    public let jsName = "NorcoachAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
    ]

    private let site = "app.norcoachapp.com"
    private var webSession: ASWebAuthenticationSession?
    private var appleCall: CAPPluginCall?

    private func anchor() -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    /// Opens a page of the site in the secure sheet and resolves with the norcoach:// address it ends on.
    @objc func openSignIn(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https", url.host == site else {
            call.reject("Not a Norcoach address")
            return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "norcoach") { [weak self] callbackURL, error in
                self?.webSession = nil
                if let callbackURL = callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                } else if let authError = error as? ASWebAuthenticationSessionError, authError.code == .canceledLogin {
                    call.reject("Cancelled", "cancelled")
                } else {
                    call.reject(error?.localizedDescription ?? "Sign-in failed")
                }
            }
            session.presentationContextProvider = self
            // Nothing kept in Safari: the sheet's sign-in is only the way to the ticket.
            session.prefersEphemeralWebBrowserSession = true
            self.webSession = session
            if !session.start() {
                self.webSession = nil
                call.reject("Couldn't open the sign-in")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return anchor()
    }

    /// Sign in with Apple, resolving with its identity token and, the first time only, the name the person shared.
    @objc func signInWithApple(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let waiting = self.appleCall {
                waiting.reject("Cancelled", "cancelled")
            }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleCall = call
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return anchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = appleCall else { return }
        appleCall = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = credential.identityToken,
              let token = String(data: data, encoding: .utf8) else {
            call.reject("Apple sent no sign-in")
            return
        }
        call.resolve([
            "token": token,
            "firstName": credential.fullName?.givenName ?? "",
            "lastName": credential.fullName?.familyName ?? "",
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = appleCall else { return }
        appleCall = nil
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            call.reject("Cancelled", "cancelled")
        } else {
            call.reject(error.localizedDescription)
        }
    }
}
