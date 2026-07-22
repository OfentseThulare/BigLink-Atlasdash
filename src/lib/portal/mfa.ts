import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/resend";
import { mfaCodeEmail } from "@/lib/email/templates";

export const CODE_LENGTH = 4;
export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 5;
const RATE_WINDOW_MINUTES = 15;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

// A 4 digit code is only 10,000 possibilities, so the attempt ceiling below is what
// actually carries the security here, not the code length.
function generateCode() {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

function constantTimeEquals(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  return left.length === right.length && timingSafeEqual(left, right);
}

function sessionIdFromToken(accessToken: string) {
  const payload = accessToken.split(".").at(1);

  if (!payload) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      session_id?: string;
    };

    return decoded.session_id ?? null;
  } catch {
    return null;
  }
}

export interface ActiveSession {
  sessionId: string;
  profileId: string;
  email: string;
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const sessionId = sessionIdFromToken(session.access_token);

  if (!sessionId) {
    return null;
  }

  const service = createSupabaseServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, email, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<{ id: string; email: string; status: string }>();

  if (!profile || profile.status !== "active") {
    return null;
  }

  return { sessionId, profileId: profile.id, email: profile.email };
}

export async function isSessionVerified() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("has_required_mfa");

  return !error && data === true;
}

export async function issueMfaCode(): Promise<{ email: string }> {
  const session = await getActiveSession();

  if (!session) {
    throw new Error("Sign in again before requesting a code.");
  }

  const service = createSupabaseServiceClient();
  const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await service
    .from("email_mfa_challenges")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", session.profileId)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= MAX_CODES_PER_WINDOW) {
    throw new Error("Too many codes requested. Wait fifteen minutes and try again.");
  }

  // Retire any live challenge for this session so the unique index stays satisfied
  // and an older code cannot be replayed.
  await service
    .from("email_mfa_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("profile_id", session.profileId)
    .eq("session_id", session.sessionId)
    .is("consumed_at", null)
    .is("verified_at", null);

  const code = generateCode();
  const { error } = await service.from("email_mfa_challenges").insert({
    profile_id: session.profileId,
    session_id: session.sessionId,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  const message = mfaCodeEmail(code, CODE_TTL_MINUTES);
  await sendEmail({ to: session.email, ...message });

  return { email: session.email };
}

export async function verifyMfaCode(code: string) {
  const session = await getActiveSession();

  if (!session) {
    throw new Error("Sign in again before entering a code.");
  }

  const service = createSupabaseServiceClient();
  const { data: challenge } = await service
    .from("email_mfa_challenges")
    .select("id, code_hash, attempts, expires_at")
    .eq("profile_id", session.profileId)
    .eq("session_id", session.sessionId)
    .is("consumed_at", null)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; code_hash: string; attempts: number; expires_at: string }>();

  if (!challenge) {
    throw new Error("No code is waiting. Request a new one.");
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await service
      .from("email_mfa_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    throw new Error("That code has expired. Request a new one.");
  }

  if (!constantTimeEquals(hashCode(code), challenge.code_hash)) {
    const attempts = challenge.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;

    await service
      .from("email_mfa_challenges")
      .update({
        attempts,
        consumed_at: exhausted ? new Date().toISOString() : null,
      })
      .eq("id", challenge.id);

    throw new Error(
      exhausted
        ? "Too many wrong attempts. That code is cancelled, request a new one."
        : `Incorrect code. ${MAX_ATTEMPTS - attempts} attempts left.`,
    );
  }

  const { error } = await service
    .from("email_mfa_challenges")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", challenge.id);

  if (error) {
    throw new Error(error.message);
  }
}
