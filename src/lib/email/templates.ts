// Table-based HTML so the layout survives Gmail, Outlook and Apple Mail.
// Palette matches the portal tokens in globals.css.

const INK = "#181a42";
const TEXT = "#252832";
const MUTED = "#6d7280";
const LINE = "#dfe2e7";
const CANVAS = "#f4f5f7";

function shell(heading: string, body: string) {
  return `<!doctype html>
<html lang="en-ZA"><body style="margin:0;padding:0;background:${CANVAS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
  <tr><td style="background:${INK};padding:24px 32px;">
    <div style="font:600 13px/1.2 'Segoe UI',Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9fa3c8;">Partnership ledger</div>
    <div style="font:600 20px/1.3 'Segoe UI',Arial,sans-serif;color:#ffffff;margin-top:6px;">Atlas and Big Link</div>
  </td></tr>
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 16px;font:600 22px/1.3 'Segoe UI',Arial,sans-serif;color:${TEXT};">${heading}</h1>
    ${body}
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid ${LINE};background:#fafbfc;">
    <p style="margin:0;font:400 12px/1.6 'Segoe UI',Arial,sans-serif;color:${MUTED};">
      Atlas Consulting Group. This is an automated message from the partnership ledger.
      If you were not expecting it, ignore it and tell Ofentse.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function paragraph(content: string) {
  return `<p style="margin:0 0 14px;font:400 15px/1.65 'Segoe UI',Arial,sans-serif;color:${TEXT};">${content}</p>`;
}

export function mfaCodeEmail(code: string, minutes: number) {
  const html = shell(
    "Your sign in code",
    [
      paragraph("Use this code to finish signing in to the partnership ledger."),
      `<div style="margin:24px 0;padding:20px;background:${CANVAS};border:1px solid ${LINE};border-radius:10px;text-align:center;">
         <div style="font:700 40px/1 'SFMono-Regular',Consolas,monospace;letter-spacing:.36em;color:${INK};padding-left:.36em;">${code}</div>
       </div>`,
      paragraph(`The code expires in ${minutes} minutes and works once. After five wrong attempts it is cancelled and you will need a new one.`),
      paragraph(`<strong>If you did not just try to sign in, do not enter this code.</strong> Someone has your password. Tell Ofentse immediately.`),
    ].join(""),
  );

  const text = [
    "Your partnership ledger sign in code",
    "",
    code,
    "",
    `Expires in ${minutes} minutes. Works once. Cancelled after five wrong attempts.`,
    "If you did not just try to sign in, do not enter this code and tell Ofentse immediately.",
  ].join("\n");

  return { subject: `${code} is your partnership ledger sign in code`, html, text };
}

export function invitationEmail(inviteUrl: string, companyName: string, invitedByName: string, days: number) {
  const html = shell(
    `You have been invited to the partnership ledger`,
    [
      paragraph(`${invitedByName} has invited you to join the Atlas and Big Link partnership ledger as a <strong>${companyName}</strong> administrator.`),
      paragraph("The ledger shows every invoice, commission, payment and credit between the two companies, and the single net balance that results."),
      `<div style="margin:24px 0;">
         <a href="${inviteUrl}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font:600 15px/1 'Segoe UI',Arial,sans-serif;padding:15px 28px;border-radius:8px;">Set up your account</a>
       </div>`,
      paragraph(`This invitation expires in ${days} days and can be used once.`),
      paragraph(`If the button does not work, paste this into your browser:<br><span style="font:400 13px/1.5 'SFMono-Regular',Consolas,monospace;color:${MUTED};word-break:break-all;">${inviteUrl}</span>`),
      paragraph("Once you set a password you will be asked for a code sent to this address. That second step runs on every sign in."),
    ].join(""),
  );

  const text = [
    `${invitedByName} has invited you to the Atlas and Big Link partnership ledger as a ${companyName} administrator.`,
    "",
    "Set up your account:",
    inviteUrl,
    "",
    `This invitation expires in ${days} days and can be used once.`,
    "After setting a password you will be asked for a code sent to this address. That second step runs on every sign in.",
  ].join("\n");

  return { subject: "Your invitation to the Atlas and Big Link partnership ledger", html, text };
}
