// Outgoing email: the client's invite, for now.
//
// Sent through Resend's HTTP API with a plain fetch, so there is no SDK to
// keep up to date. Off until two variables are set on the server:
//   RESEND_API_KEY  the key from resend.com
//   MAIL_FROM       a sender on a domain verified there, e.g.
//                   "Full Potential Coaching <coach@fullpotential.nl>"
// Until then the New client dialog says email isn't set up and the coach
// hands the login over themselves; nothing pretends to have been sent.

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Who an email is from. The address is always the platform's (MAIL_FROM,
 * on the domain verified at Resend): a coach's own Gmail can't be sent as
 * by anyone but Google. What the client reads is the coach's name, and a
 * reply goes to the coach's own inbox (26 Sep).
 */
function sender(fromName?: string | null): string {
  const from = process.env.MAIL_FROM ?? "";
  const name = fromName?.replace(/["<>\r\n]/g, "").trim();
  if (!name) return from;
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
  return `"${name}" <${address}>`;
}

async function send(to: string, subject: string, text: string, html: string, what: string, opts: { fromName?: string | null; replyTo?: string | null } = {}): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender(opts.fromName), to: [to], subject, text, html, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
    });
    if (!res.ok) console.error(`[mail] ${what} to ${to} failed: ${res.status} ${await res.text().catch(() => "")}`);
    return res.ok;
  } catch (error) {
    console.error(`[mail] ${what} failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/** A "forgot password" link. Resolves false rather than throwing. */
export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }): Promise<boolean> {
  if (!mailConfigured()) return false;
  const text = [
    "Someone asked to reset the password for your Ironline account.",
    "",
    `Choose a new password: ${resetUrl}`,
    "",
    "The link works once, for the next hour. If you didn't ask for this, ignore this email: your password stays as it is.",
  ].join("\n");
  const html = `<p>Someone asked to reset the password for your Ironline account.</p>
<p><a href="${escape(resetUrl)}">Choose a new password</a></p>
<p>The link works once, for the next hour. If you didn&rsquo;t ask for this, ignore this email: your password stays as it is.</p>`;
  return send(to, "Reset your Ironline password", text, html, "password reset");
}

/** The invite's words, as text and as HTML: sent below, and shown on the onboarding board. */
export function inviteEmail({ to, firstName, coachName, password, signInUrl }: { to: string; firstName: string; coachName: string; password: string; signInUrl: string }) {
  const subject = "Your Ironline login";
  const text = [
    `Hi ${firstName},`,
    "",
    `${coachName} has set up your Ironline account.`,
    "",
    `Sign in at ${signInUrl}`,
    `Email: ${to}`,
    `Temporary password: ${password}`,
    "",
    "The app asks you to choose your own password the first time you sign in.",
  ].join("\n");
  const html = `<p>Hi ${escape(firstName)},</p>
<p>${escape(coachName)} has set up your Ironline account.</p>
<p><a href="${escape(signInUrl)}">Sign in to Ironline</a><br>
Email: <b>${escape(to)}</b><br>
Temporary password: <b style="letter-spacing:0.04em">${escape(password)}</b></p>
<p>The app asks you to choose your own password the first time you sign in.</p>`;
  return { subject, text, html };
}

/** The client's first sign-in details, from the coach by name, answered to the coach. Resolves false rather than throwing: the client exists either way. */
export async function sendInviteEmail({ coachEmail, ...details }: { to: string; firstName: string; coachName: string; coachEmail: string; password: string; signInUrl: string }): Promise<boolean> {
  if (!mailConfigured()) return false;
  const { subject, text, html } = inviteEmail(details);
  return send(details.to, subject, text, html, "invite", { fromName: details.coachName, replyTo: coachEmail });
}
