import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "../lib/legal";
import "./legal.css";

// The privacy policy: public (no login), linked from the App Store listing
// and the login page. Written for what the app actually does; when a new
// kind of data or a new service comes in, it goes in here too.

export const metadata: Metadata = { title: `Privacy policy · ${LEGAL.app}` };

export default function PrivacyPage() {
  const contact = LEGAL.contactEmail ? <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> : <em>[contact email to be added]</em>;
  return (
    <main className="lg">
      <div className="lg-wrap">
        <Link href="/login" className="lg-brand">
          {LEGAL.app}
        </Link>
        <h1>Privacy policy</h1>
        <p className="lg-updated">Last updated {LEGAL.updated}</p>

        <p>
          {LEGAL.app} is an app for coaching: your coach plans your training, nutrition and check-ins in it, and you log what you do. {LEGAL.app} is run by {LEGAL.company}, a company registered in {LEGAL.country} (&ldquo;we&rdquo;). This policy explains what we store, why, who
          else handles it, and what you can do about it.
        </p>

        <div className="lg-box">
          <strong>The short version.</strong> We store what you and your coach put into the app so that coaching works. Your coach sees what you log. We don&rsquo;t sell your data, we don&rsquo;t show ads, and we don&rsquo;t track you across other apps or websites. You can delete your account and your data from inside the app at any time.
        </div>

        <h2>Who sees your data</h2>
        <p>
          Your coach is an independent professional who uses {LEGAL.app} to coach you. Everything you enter in the app is shared with your coach, because that is what it is for. Your coach decides how to coach you with it; we provide the app and keep the data safe. Nobody else can see
          your data, apart from the service providers listed below, who handle it only to run the app.
        </p>

        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, email address and password (stored only in hashed form, never readable), and a profile picture if you add one.
          </li>
          <li>
            <strong>Health and fitness data:</strong> the check-ins you fill in (for example body weight, sleep, steps, how you&rsquo;re feeling, body measurements), the training you log (sets, weights, reps, notes), your food diary and calories, and progress pictures.
          </li>
          <li>
            <strong>Messages:</strong> your chat with your coach, including photos, videos, voice messages and files you send, and videos of exercises your coach asks for.
          </li>
          <li>
            <strong>What your coach writes about you:</strong> your programme and plan, notes, goals, meeting recaps and progress reports.
          </li>
          <li>
            <strong>Devices:</strong> if you turn on notifications, an address for your device that lets us send them. We also keep a sign-in cookie so you stay logged in.
          </li>
          <li>
            <strong>Technical data:</strong> when something goes wrong, an error report (what failed, the browser or device type, and roughly when) so we can fix it.
          </li>
        </ul>
        <p>We don&rsquo;t collect your location, your contacts, or advertising identifiers.</p>

        <h2>Why we use it, and on what basis</h2>
        <ul>
          <li>To provide the app and the coaching you signed up for (performance of a contract).</li>
          <li>
            Health and fitness data is a special kind of personal data. We process it only because you choose to enter it for your coaching, with your explicit consent, which you can withdraw at any time by deleting it or your account.
          </li>
          <li>To keep the app working and secure, and to fix errors (our legitimate interest).</li>
          <li>To send you notifications you turned on, such as a message from your coach or a reminder before a call. You can turn them off in the app or on your phone.</li>
        </ul>

        <h2>Service providers</h2>
        <p>These companies handle data for us, only to run the app, under contracts that require them to protect it:</p>
        <ul>
          <li>
            <strong>Railway</strong>: hosting, database, file storage and backups (servers in the United States and the European Union).
          </li>
          <li>
            <strong>Sentry</strong>: error reports.
          </li>
          <li>
            <strong>Apple and Google push services</strong>: delivering notifications to your device.
          </li>
          <li>
            <strong>Anthropic</strong>: when your coach creates a written progress report with AI, the figures for that period are sent to Anthropic&rsquo;s AI model to draft it. Anthropic doesn&rsquo;t use this data to train its models.
          </li>
          <li>
            <strong>Open Food Facts</strong>: when you search for a food or scan a barcode, the search term or barcode is looked up in this public food database. No personal data is sent.
          </li>
          <li>
            <strong>An email delivery service</strong>: to send account emails such as an invitation or a password reset.
          </li>
        </ul>

        <h2>International transfers</h2>
        <p>
          {LEGAL.company} and some of our providers are in the United States. If you are in the European Union or the United Kingdom, your data is transferred there under safeguards recognised by EU law, such as the European Commission&rsquo;s Standard Contractual Clauses.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li>For as long as you have an account.</li>
          <li>When you delete your account in the app, your data is deleted straight away. Copies in our nightly backups are gone within 30 days.</li>
          <li>Invoices your coach issued you are business records your coach must keep by law, so they stay (up to 7 years) after your account is deleted, with only your name on them.</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You can ask to see the data we hold about you, correct it, get a copy of it, have it deleted, or object to or restrict how it is used. You can delete your account and all your data yourself in the app, under Account. For anything else, write to {contact}. If you are in the EU or UK and
          aren&rsquo;t happy with how we handle your data, you can also complain to your data protection authority (in the Netherlands, the Autoriteit Persoonsgegevens).
        </p>

        <h2>Security</h2>
        <p>Data is sent over encrypted connections, passwords are stored hashed, and access to your data is limited to you and your coach. No system is perfectly secure, but we work to keep yours safe and will tell you if something goes wrong.</p>

        <h2>Children</h2>
        <p>{LEGAL.app} is not meant for anyone under 16, and we don&rsquo;t knowingly store data about children.</p>

        <h2>Changes</h2>
        <p>If we change this policy, we&rsquo;ll update the date at the top, and tell you in the app if the change matters.</p>

        <h2>Contact</h2>
        <p>
          {LEGAL.company}. Questions about your data: {contact}.
        </p>

        <div className="lg-foot">
          <Link href="/support">Support</Link>
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
