import Image from "next/image";
import Link from "next/link";
import { KeyRound } from "lucide-react";

export default function MfaPage() {
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
          <h1>Complete MFA</h1>
        </div>
        <div className="mfa-state">
          <KeyRound className="size-5" aria-hidden="true" />
          <p>Your Supabase session must reach AAL2 before the ledger is available.</p>
        </div>
        <Link className="secondary-button full-width" href="/login">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
