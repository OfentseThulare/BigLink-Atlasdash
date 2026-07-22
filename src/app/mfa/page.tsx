import Image from "next/image";
import { redirect } from "next/navigation";
import { KeyRound, MailCheck } from "lucide-react";
import { requestMfaCodeAction, verifyMfaCodeAction, signOutAction } from "@/lib/portal/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CODE_LENGTH, CODE_TTL_MINUTES, getActiveSession, isSessionVerified } from "@/lib/portal/mfa";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!domain) {
    return email;
  }

  return `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <h1>Connect Supabase</h1>
          <p>The portal is not wired to a database yet.</p>
        </section>
      </main>
    );
  }

  const session = await getActiveSession();

  if (!session) {
    redirect("/login");
  }

  if (await isSessionVerified()) {
    redirect("/");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Image
          src="/big-link-logo.png"
          alt="Big Link Consulting"
          width={184}
          height={64}
          priority
        />
        <div>
          <p className="eyebrow">Security check</p>
          <h1>Enter your code</h1>
        </div>

        <div className="mfa-state">
          {sent ? <MailCheck className="size-5" aria-hidden="true" /> : <KeyRound className="size-5" aria-hidden="true" />}
          <p>
            {sent ? (
              <>
                We sent a {CODE_LENGTH} digit code to <strong>{maskEmail(session.email)}</strong>. It
                expires in {CODE_TTL_MINUTES} minutes.
              </>
            ) : (
              <>A {CODE_LENGTH} digit code is required before the ledger loads. Request one below.</>
            )}
          </p>
        </div>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <form action={verifyMfaCodeAction} className="action-form">
          <label>
            <span>Verification code</span>
            <input
              className="text-field code-field"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              placeholder={"0".repeat(CODE_LENGTH)}
              required
            />
          </label>
          <button className="primary-button full-width" type="submit">
            Verify and continue
          </button>
        </form>

        <div className="auth-actions">
          <form action={requestMfaCodeAction}>
            <button className="link-button" type="submit">
              Send a new code
            </button>
          </form>
          <form action={signOutAction}>
            <button className="link-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
