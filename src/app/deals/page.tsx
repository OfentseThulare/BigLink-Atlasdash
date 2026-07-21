import { BriefcaseBusiness } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatZar } from "@/domain/money";
import { createDealAction } from "@/lib/portal/actions";
import { getDeals } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function toneForStatus(status: string) {
  if (status === "Closed" || status === "Approved") {
    return "credit" as const;
  }

  if (status === "Rejected") {
    return "disputed" as const;
  }

  return "pending" as const;
}

export default async function DealsPage() {
  const deals = await getDeals();
  const live = isSupabaseConfigured();

  return (
    <AppShell activeHref="/deals">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Deals</p>
            <h1>Closed deal disclosure</h1>
            <p>Variable commission opportunities, customer invoices, and agreed terms.</p>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="content-section span-2">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Commercial records</p>
                <h2>Closed deals</h2>
              </div>
              <BriefcaseBusiness className="size-5 text-ink" aria-hidden="true" />
            </div>
            <div className="record-list">
              {deals.map((deal) => (
                <article className="record-row" key={deal.id}>
                  <div>
                    <span className="reference">{deal.customer}</span>
                    <h3>{deal.title}</h3>
                    <p>Closed {deal.closedOn}</p>
                  </div>
                  <div className="record-row-meta">
                    <strong>{formatZar(deal.value)}</strong>
                    <StatusBadge tone={toneForStatus(deal.status)}>{deal.status}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="content-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">New</p>
                <h2>Disclose deal</h2>
              </div>
            </div>
            <form action={createDealAction} className="action-form">
              <label>
                <span>Deal title</span>
                <input className="text-field" name="title" disabled={!live} required />
              </label>
              <label>
                <span>Customer</span>
                <input className="text-field" name="customerName" disabled={!live} required />
              </label>
              <label>
                <span>Value</span>
                <input className="text-field" name="dealValue" inputMode="decimal" placeholder="5750.00" disabled={!live} required />
              </label>
              <label>
                <span>Closed on</span>
                <input className="text-field" name="closedOn" type="date" disabled={!live} required />
              </label>
              <button className="primary-button full-width" type="submit" disabled={!live}>
                Save deal
              </button>
            </form>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
