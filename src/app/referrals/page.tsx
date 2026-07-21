import { Handshake } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { submitReferralAction } from "@/lib/portal/actions";
import { getReferrals } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function toneForStatus(status: string) {
  if (status === "Approved") {
    return "credit" as const;
  }

  if (status.includes("Rejected")) {
    return "disputed" as const;
  }

  return "pending" as const;
}

export default async function ReferralsPage() {
  const referrals = await getReferrals();
  const live = isSupabaseConfigured();

  return (
    <AppShell activeHref="/referrals">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Referrals</p>
            <h1>Big Link introductions</h1>
            <p>Approved clients remain attributable until the partnership formally ends that referral.</p>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="content-section span-2">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Client attribution</p>
                <h2>Referral register</h2>
              </div>
              <Handshake className="size-5 text-ink" aria-hidden="true" />
            </div>
            <div className="record-list">
              {referrals.map((referral) => (
                <article className="record-row" key={referral.id}>
                  <div>
                    <span className="reference">{referral.rate}</span>
                    <h3>{referral.client}</h3>
                    <p>Submitted by {referral.submittedBy}, starts {referral.startsOn}</p>
                  </div>
                  <div className="record-row-meta">
                    <StatusBadge tone={toneForStatus(referral.status)}>{referral.status}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="content-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">New</p>
                <h2>Submit referral</h2>
              </div>
            </div>
            <form action={submitReferralAction} className="action-form">
              <label>
                <span>Client name</span>
                <input className="text-field" name="clientName" disabled={!live} required />
              </label>
              <label>
                <span>Client email</span>
                <input className="text-field" name="clientEmail" type="email" disabled={!live} />
              </label>
              <label>
                <span>Registration number</span>
                <input className="text-field" name="registrationNumber" disabled={!live} />
              </label>
              <label>
                <span>Relationship notes</span>
                <textarea className="text-field" name="notes" rows={5} disabled={!live} />
              </label>
              <button className="primary-button full-width" type="submit" disabled={!live}>
                Submit for Atlas approval
              </button>
            </form>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
