import { ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getInvoices } from "@/lib/portal/data";
import { InvoicesRecordDetails } from "@/components/record-detail/invoices-record-details";
import { recordPartnerInvoiceAction } from "@/lib/portal/actions";
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
  const canRecordPartnerInvoice = user.company === "Big Link" && live;

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
        {canRecordPartnerInvoice ? (
          <section className="content-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">New</p>
                <h2>Record partner invoice</h2>
              </div>
            </div>
            <form action={recordPartnerInvoiceAction} className="action-form">
              <input type="hidden" name="returnPath" value="/invoices" />
              <label>
                <span>Invoice reference</span>
                <input className="text-field" name="invoiceNumber" required disabled={!live} />
              </label>
              <label>
                <span>Issue date</span>
                <input className="text-field" name="issueDate" type="date" required disabled={!live} />
              </label>
              <label>
                <span>Due date</span>
                <input className="text-field" name="dueDate" type="date" required disabled={!live} />
              </label>
              <label>
                <span>Line description</span>
                <textarea className="text-field" name="lineDescription" rows={3} required disabled={!live} />
              </label>
              <label>
                <span>Subtotal (ZAR)</span>
                <input className="text-field" name="subtotalAmount" inputMode="decimal" placeholder="1200.00" required disabled={!live} />
              </label>
              <label>
                <span>VAT (ZAR)</span>
                <input className="text-field" name="vatAmount" inputMode="decimal" placeholder="0.00" disabled={!live} />
              </label>
              <button className="primary-button full-width" type="submit" disabled={!live}>
                Record invoice
              </button>
            </form>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
