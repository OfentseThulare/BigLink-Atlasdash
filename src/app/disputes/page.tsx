import { Scale } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { getDisputes } from "@/lib/portal/data";

export default async function DisputesPage() {
  const disputes = await getDisputes();

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

        <section className="content-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Review</p>
              <h2>Dispute register</h2>
            </div>
            <Scale className="size-5 text-ink" aria-hidden="true" />
          </div>
          <div className="record-list">
            {disputes.map((dispute) => (
              <article className="record-row" key={dispute.id}>
                <div>
                  <span className="reference">{dispute.reference}</span>
                  <h3>{dispute.reason}</h3>
                  <p>Opened by {dispute.openedBy}, {dispute.createdAt}</p>
                </div>
                <div className="record-row-meta">
                  <StatusBadge tone="disputed">{dispute.status}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
