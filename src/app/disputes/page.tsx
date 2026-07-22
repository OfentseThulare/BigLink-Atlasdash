import { AppShell } from "@/components/app-shell/app-shell";
import { DisputesRecordDetails } from "@/components/record-detail/disputes-record-details";
import { getPortalUser } from "@/lib/portal/auth";
import { getDisputes } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getPortalUser();
  const disputes = await getDisputes();
  const live = isSupabaseConfigured();

  return (
    <AppShell activeHref="/disputes">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Disputes</p>
            <h1>Excluded items</h1>
            <p>Open disputes remain visible but are excluded from payable balances until resolved.</p>
          </div>
        </section>

        <DisputesRecordDetails disputes={disputes} userCompanyId={user.companyId} live={live} error={error} />
      </main>
    </AppShell>
  );
}
