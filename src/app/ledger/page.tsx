import { BookOpenCheck, CircleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatZar } from "@/domain/money";
import { openDisputeAction } from "@/lib/portal/actions";
import { getLedgerEntries } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LedgerPage() {
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

        <section className="workspace-grid">
          <div className="content-section span-2">
            <div className="section-heading">
              <div>
                <p className="eyebrow">All records</p>
                <h2>Shared ledger</h2>
              </div>
              <BookOpenCheck className="size-5 text-ink" aria-hidden="true" />
            </div>
            <div className="record-list">
              {entries.map((entry) => (
                <article className="record-row" key={entry.id}>
                  <div>
                    <span className="reference">{entry.reference}</span>
                    <h3>{entry.description}</h3>
                    <p>{entry.date}, {entry.direction}</p>
                  </div>
                  <div className="record-row-meta">
                    <strong>{formatZar(entry.amount)}</strong>
                    <StatusBadge tone={entry.tone}>{entry.status}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="content-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Exception</p>
                <h2>Open dispute</h2>
              </div>
              <CircleAlert className="size-5 text-warning-strong" aria-hidden="true" />
            </div>
            <form action={openDisputeAction} className="action-form">
              <label>
                <span>Ledger item</span>
                <select className="text-field" name="ledgerEntryId" disabled={!live} required>
                  {entries.map((entry) => (
                    <option value={entry.id} key={entry.id}>{entry.reference}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Reason</span>
                <textarea className="text-field" name="reason" rows={5} disabled={!live} required />
              </label>
              <button className="primary-button full-width" type="submit" disabled={!live}>
                Submit dispute
              </button>
            </form>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
