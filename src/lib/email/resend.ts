const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function sender() {
  return process.env.RESEND_FROM || "Atlas Partnership Ledger <ledger@atlascg.co.za>";
}

// Resend suppresses an entire message when any single recipient is on the
// suppression list, so this only ever sends to one address per call.
export async function sendEmail({ to, subject, html, text }: OutboundEmail) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: sender(), to: [to], subject, html, text }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected the message (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as { id?: string };

  return payload.id ?? null;
}
