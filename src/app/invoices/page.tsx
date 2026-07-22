import { ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getInvoices } from "@/lib/portal/data";
import { InvoicesRecordDetails } from "@/components/record-detail/invoices-record-details";
import { getPortalUser } from "@/lib/portal/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getPortalUser();
  const invoices = await getInvoices();
  const live = isSupabaseConfigured();

  return (
    <AppShell activeHref="/invoices">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Invoices</p>
            <h1>Atlas Dash sync</h1>
            <p>Source invoices, payment declarations, and commission trigger visibility.</p>
          </div>
        </section>

        <InvoicesRecordDetails
          invoices={invoices}
          userCompanyId={user.companyId}
          live={live}
          error={error}
        />
      </main>
    </AppShell>
  );
}
