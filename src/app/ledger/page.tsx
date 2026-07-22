import { BookOpenCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { LedgerRecordDetails } from "@/components/record-detail/ledger-record-details";
import { getPortalUser } from "@/lib/portal/auth";
import { getLedgerEntries } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getPortalUser();
  const entries = await getLedgerEntries();
  const live = isSupabaseConfigured();

  return (
    <AppShell activeHref="/ledger">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Ledger</p>
            <h1>Obligations and offsets</h1>
            <p>Posted partnership items, disputed exclusions, and statement-ready balances.</p>
          </div>
        </section>

        <LedgerRecordDetails entries={entries} userCompanyId={user.companyId} live={live} error={error} />
      </main>
    </AppShell>
  );
}
