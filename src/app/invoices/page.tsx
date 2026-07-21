import { ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatZar } from "@/domain/money";
import { recordInvoicePaymentAction } from "@/lib/portal/actions";
import { getInvoices } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function toneForStatus(status: string) {
  if (status.toLowerCase().includes("paid")) {
    return "credit" as const;
  }

  if (status.toLowerCase().includes("partial")) {
    return "pending" as const;
  }

  return "disputed" as const;
}

export default async function InvoicesPage() {
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

        <section className="workspace-grid">
          <div className="content-section span-2">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Source records</p>
                <h2>Partnership invoices</h2>
              </div>
              <ReceiptText className="size-5 text-ink" aria-hidden="true" />
            </div>
            <div className="record-list">
              {invoices.map((invoice) => (
                <article className="record-row" key={invoice.id}>
                  <div>
                    <span className="reference">{invoice.number}</span>
                    <h3>{invoice.client}</h3>
                    <p>{invoice.kind}, {invoice.sourceSystem}, due {invoice.dueDate}</p>
                  </div>
                  <div className="record-row-meta">
                    <strong>{formatZar(invoice.total)}</strong>
                    <span className="subtle">Paid {formatZar(invoice.paid)}</span>
                    <StatusBadge tone={toneForStatus(invoice.status)}>{invoice.status}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="content-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Payment</p>
                <h2>Record receipt</h2>
              </div>
            </div>
            <form action={recordInvoicePaymentAction} className="action-form">
              <label>
                <span>Invoice</span>
                <select className="text-field" name="invoiceId" disabled={!live} required>
                  {invoices.map((invoice) => (
                    <option value={invoice.id} key={invoice.id}>{invoice.number}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount received</span>
                <input className="text-field" name="amount" inputMode="decimal" placeholder="575.00" disabled={!live} required />
              </label>
              <label>
                <span>Paid on</span>
                <input className="text-field" name="paidOn" type="date" disabled={!live} required />
              </label>
              <label>
                <span>Reference</span>
                <input className="text-field" name="reference" disabled={!live} />
              </label>
              <button className="primary-button full-width" type="submit" disabled={!live}>
                Record payment
              </button>
            </form>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
