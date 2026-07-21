import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { getAuditEvents } from "@/lib/portal/data";

export default async function AuditPage() {
  const events = await getAuditEvents();

  return (
    <AppShell activeHref="/audit">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h1>Financial change history</h1>
            <p>Immutable records for approvals, source records, disputes, statements, and settlements.</p>
          </div>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Events</p>
              <h2>Recent audit entries</h2>
            </div>
            <ShieldCheck className="size-5 text-ink" aria-hidden="true" />
          </div>
          <div className="record-list">
            {events.map((event) => (
              <article className="record-row" key={event.id}>
                <div>
                  <span className="reference">{event.subject}</span>
                  <h3>{event.action}</h3>
                  <p>{event.createdAt}</p>
                </div>
                <div className="record-row-meta">
                  <span className="subtle">{event.actor}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
