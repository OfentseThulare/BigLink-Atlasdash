import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { signInAction } from "@/lib/portal/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const live = isSupabaseConfigured();

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
          <p className="eyebrow">Partnership ledger</p>
          <h1>Administrator sign in</h1>
        </div>
        <form action={signInAction} className="action-form">
          <label>
            <span>Email</span>
            <input className="text-field" name="email" type="email" disabled={!live} required />
          </label>
          <label>
            <span>Password</span>
            <input className="text-field" name="password" type="password" disabled={!live} required />
          </label>
          <button className="primary-button full-width" type="submit" disabled={!live}>
            Sign in
          </button>
        </form>
        <div className="auth-security">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span>MFA is required before financial data loads.</span>
        </div>
      </section>
    </main>
  );
}
