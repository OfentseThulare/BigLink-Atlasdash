import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { acceptInvitationAction } from "@/lib/portal/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadInvitation } from "@/lib/portal/invitations";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

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

  const invitation = await loadInvitation(token);

  if (!invitation) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <Image src="/big-link-logo.png" alt="Big Link Consulting" width={184} height={64} priority />
          <div>
            <p className="eyebrow">Invitation</p>
            <h1>This link is no longer valid</h1>
          </div>
          <p>It has already been used, or it expired. Ask for a fresh invitation.</p>
          <Link className="secondary-button full-width" href="/login">
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Image src="/big-link-logo.png" alt="Big Link Consulting" width={184} height={64} priority />
        <div>
          <p className="eyebrow">{invitation.companyName} administrator</p>
          <h1>Set up your account</h1>
        </div>

        <div className="mfa-state">
          <ShieldCheck className="size-5" aria-hidden="true" />
          <p>
            Setting up access for <strong>{invitation.email}</strong>. Choose a password, then we
            will email you a code to finish signing in.
          </p>
        </div>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <form action={acceptInvitationAction} className="action-form">
          <input type="hidden" name="token" value={token} />
          <label>
            <span>Full name</span>
            <input className="text-field" name="fullName" type="text" autoComplete="name" required />
          </label>
          <label>
            <span>Password</span>
            <input
              className="text-field"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              className="text-field"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <button className="primary-button full-width" type="submit">
            Create account and continue
          </button>
        </form>

        <div className="auth-security">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span>At least ten characters. You will be signed in straight away.</span>
        </div>
      </section>
    </main>
  );
}
