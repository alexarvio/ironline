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
    "Someone asked to reset the password for your NorCoach account.",
    "",
    `Choose a new password: ${resetUrl}`,
    "",
    "The link works once, for the next hour. If you didn't ask for this, ignore this email: your password stays as it is.",
  ].join("\n");
  const html = `<p>Someone asked to reset the password for your NorCoach account.</p>
<p><a href="${escape(resetUrl)}">Choose a new password</a></p>
<p>The link works once, for the next hour. If you didn&rsquo;t ask for this, ignore this email: your password stays as it is.</p>`;
  return send(to, "Reset your NorCoach password", text, html, "password reset");
}

/** The invite's words, as text and as HTML: sent below, and shown on the onboarding board. */
export function inviteEmail({ to, firstName, coachName, password, signInUrl }: { to: string; firstName: string; coachName: string; password: string; signInUrl: string }) {
  const subject = "Your NorCoach login";
  const text = [
    `Hi ${firstName},`,
    "",
    `${coachName} has set up your NorCoach account.`,
    "",
    `Sign in at ${signInUrl}`,
    `Email: ${to}`,
    `Temporary password: ${password}`,
    "",
    "The app asks you to choose your own password the first time you sign in.",
  ].join("\n");
  const html = `<p>Hi ${escape(firstName)},</p>
<p>${escape(coachName)} has set up your NorCoach account.</p>
<p><a href="${escape(signInUrl)}">Sign in to NorCoach</a><br>
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

/** Where the website's applications go (28 Oct, Alex: "email me"): APPLY_TO_EMAIL, else the owner's. */
export function applyInbox(): string | null {
  return process.env.APPLY_TO_EMAIL?.trim() || process.env.OWNER_EMAIL?.trim() || null;
}

export type Application = { name: string; email: string; business: string; clients: string; uses: string[]; hardest: string };

/** One founding-coach application from norcoachapp.com, to the inbox above, a reply going to the coach. False rather than throwing. */
export async function sendApplicationEmail(a: Application): Promise<boolean> {
  const to = applyInbox();
  if (!mailConfigured() || !to) return false;
  const rows: [string, string][] = [
    ["Name", a.name],
    ["Email", a.email],
    ["Business", a.business || "–"],
    ["Clients", a.clients || "–"],
    ["Uses today", a.uses.join(", ") || "–"],
    ["Hardest part of the week", a.hardest || "–"],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\nReply to this email to answer them.";
  const html = `<table style="border-collapse:collapse;font:15px/1.5 system-ui,sans-serif">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5b6474;vertical-align:top">${escape(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${escape(v)}</td></tr>`)
    .join("")}</table><p style="font:14px system-ui,sans-serif;color:#5b6474">Reply to this email to answer them.</p>`;
  return send(to, `Founding coach application: ${a.name}${a.clients ? ` (${a.clients} clients)` : ""}`, text, html, "application", { fromName: "NorCoach website", replyTo: a.email });
}

/** A coach who signed up is let in by the owner. Resolves false rather than throwing: they are in either way. */
export async function sendCoachApprovedEmail({ to, name, signInUrl }: { to: string; name: string; signInUrl: string }): Promise<boolean> {
  if (!mailConfigured()) return false;
  const first = name.split(" ")[0] || name;
  const text = [`Hi ${first},`, "", "Your NorCoach coach account is ready.", "", `Sign in: ${signInUrl}`].join("\n");
  const html = `<p>Hi ${escape(first)},</p>
<p>Your NorCoach coach account is ready.</p>
<p><a href="${escape(signInUrl)}">Sign in to NorCoach</a></p>`;
  return send(to, "You're in: your NorCoach coach account", text, html, "coach approved", { fromName: "NorCoach" });
}
