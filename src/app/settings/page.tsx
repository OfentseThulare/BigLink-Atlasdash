import { KeyRound, ShieldCheck, Webhook } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function SettingsPage() {
  const live = isSupabaseConfigured();

  return (
    <AppShell activeHref="/settings">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Portal controls</h1>
            <p>Security, integration, statement, and document storage configuration.</p>
          </div>
        </section>

        <section className="settings-grid">
          <article className="content-section settings-card">
            <div className="settings-icon">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2>MFA enforcement</h2>
              <p>Every authenticated administrator must reach Supabase AAL2 before accessing financial records.</p>
            </div>
            <StatusBadge tone="credit">Required</StatusBadge>
          </article>

          <article className="content-section settings-card">
            <div className="settings-icon">
              <Webhook className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2>Atlas Dash sync</h2>
              <p>Atlas invoices are accepted as source records and processed into entitlements or service obligations.</p>
            </div>
            <StatusBadge tone={live ? "credit" : "pending"}>{live ? "Connected" : "Pending"}</StatusBadge>
          </article>

          <article className="content-section settings-card">
            <div className="settings-icon">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2>Administrator access</h2>
              <p>Named Atlas and Big Link administrators are modelled through active company memberships.</p>
            </div>
            <StatusBadge tone="pending">Invite controlled</StatusBadge>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
