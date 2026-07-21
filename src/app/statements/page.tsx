import { Landmark } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatZar } from "@/domain/money";
import { proposeMonthlyStatementAction } from "@/lib/portal/actions";
import { getStatements } from "@/lib/portal/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function toneForStatus(status: string) {
  if (status === "Settled") {
    return "credit" as const;
  }

  if (status === "Voided") {
    return "disputed" as const;
  }

  return "pending" as const;
}

export default async function StatementsPage() {
  const statements = await getStatements();
  const live = isSupabaseConfigured();

  return (
    <AppShell activeHref="/statements">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Monthly close</p>
            <h1>Statements and settlement</h1>
            <p>Monthly snapshots net Atlas and Big Link obligations into one settlement position.</p>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="content-section span-2">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Statements</p>
                <h2>Close history</h2>
              </div>
              <Landmark className="size-5 text-ink" aria-hidden="true" />
            </div>
            <div className="record-list">
              {statements.map((statement) => (
                <article className="record-row" key={statement.id}>
                  <div>
                    <span className="reference">{statement.period}</span>
                    <h3>{statement.payer}</h3>
                    <p>Due {statement.dueOn}</p>
                  </div>
                  <div className="record-row-meta">
                    <strong>{formatZar(statement.settlementAmount)}</strong>
                    <StatusBadge tone={toneForStatus(statement.status)}>{statement.status}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="content-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Close</p>
                <h2>Propose statement</h2>
              </div>
            </div>
            <form action={proposeMonthlyStatementAction} className="action-form">
              <label>
                <span>Period start</span>
                <input className="text-field" name="periodStart" type="date" disabled={!live} required />
              </label>
              <label>
                <span>Period end</span>
                <input className="text-field" name="periodEnd" type="date" disabled={!live} required />
              </label>
              <label>
                <span>Settlement due</span>
                <input className="text-field" name="dueOn" type="date" disabled={!live} required />
              </label>
              <button className="primary-button full-width" type="submit" disabled={!live}>
                Propose close
              </button>
            </form>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
