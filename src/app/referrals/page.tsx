import { AppShell } from "@/components/app-shell/app-shell";
import { ReferralsRecordDetails } from "@/components/record-detail/referrals-record-details";
import { submitReferralAction } from "@/lib/portal/actions";
import { getReferrals } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

        <ReferralsRecordDetails referrals={referrals} error={error} />
        <section className="content-section">
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
        </section>
      </main>
    </AppShell>
  );
}
