import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  WalletCards,
} from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { formatZar } from "@/domain/money";
import { closeChecklist, dashboardSummary, recentEntries } from "@/data/demo-dashboard";

export default function OverviewPage() {
  const netDirection = dashboardSummary.netAtlasReceivable >= 0
    ? "Big Link pays Atlas"
    : "Atlas pays Big Link";

  return (
    <div className="app-frame">
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="page-shell">
          <section className="page-heading">
            <div>
              <p className="eyebrow">Partnership overview</p>
              <h1>Financial position</h1>
              <p>All approved obligations, offsets, and exceptions for {dashboardSummary.period}.</p>
            </div>
            <Link className="primary-button" href="/statements">
              Review monthly close
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>

          <section className="balance-panel" aria-labelledby="balance-title">
            <div className="balance-copy">
              <div className="balance-kicker">
                <span className="live-indicator" />
                Live net position
              </div>
              <h2 id="balance-title">{netDirection}</h2>
              <p className="balance-amount">{formatZar(dashboardSummary.netAtlasReceivable)}</p>
              <p className="balance-note">Undisputed payable items only. Pending amounts remain visible below.</p>
            </div>
            <div className="balance-breakdown">
              <div>
                <span>Big Link owes Atlas</span>
                <strong>{formatZar(dashboardSummary.bigLinkOwesAtlas)}</strong>
              </div>
              <div className="offset-symbol" aria-hidden="true">minus</div>
              <div>
                <span>Atlas owes Big Link</span>
                <strong>{formatZar(dashboardSummary.atlasOwesBigLink)}</strong>
              </div>
              <div className="offset-rule" />
              <div className="net-row">
                <span>Net settlement</span>
                <strong>{formatZar(dashboardSummary.netAtlasReceivable)}</strong>
              </div>
            </div>
          </section>

          <section className="metric-grid" aria-label="Financial summary">
            <MetricCard
              label="Receivable by Atlas"
              value={formatZar(dashboardSummary.bigLinkOwesAtlas)}
              note="8 payable entries"
              icon={ArrowDownLeft}
              tone="positive"
            />
            <MetricCard
              label="Payable to Big Link"
              value={formatZar(dashboardSummary.atlasOwesBigLink)}
              note="4 commission entries"
              icon={ArrowUpRight}
              tone="negative"
            />
            <MetricCard
              label="Pending commission"
              value={formatZar(dashboardSummary.pendingCommission)}
              note="Awaiting customer payment"
              icon={Clock3}
              tone="warning"
            />
            <MetricCard
              label="Open disputes"
              value={String(dashboardSummary.openDisputes).padStart(2, "0")}
              note="R95,000.00 excluded"
              icon={CircleAlert}
            />
          </section>

          <div className="dashboard-grid">
            <section className="content-section activity-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Ledger activity</p>
                  <h2>Recent transactions</h2>
                </div>
                <Link href="/ledger">View ledger <ArrowRight className="size-4" /></Link>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Transaction</th>
                      <th scope="col">Direction</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="amount-cell">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span className="reference">{entry.id}</span>
                          <span className="subtle">{entry.date}</span>
                        </td>
                        <td>
                          <span className="primary-cell">{entry.description}</span>
                          <span className="subtle">{entry.client}</span>
                        </td>
                        <td>{entry.direction}</td>
                        <td><StatusBadge tone={entry.tone}>{entry.status}</StatusBadge></td>
                        <td className="amount-cell">{formatZar(entry.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-transactions">
                {recentEntries.map((entry) => (
                  <article key={entry.id}>
                    <div className="mobile-transaction-topline">
                      <div>
                        <span className="reference">{entry.id}</span>
                        <span className="subtle">{entry.date}</span>
                      </div>
                      <strong>{formatZar(entry.amount)}</strong>
                    </div>
                    <p>{entry.description}</p>
                    <span className="subtle">{entry.client}</span>
                    <div className="mobile-transaction-meta">
                      <span>{entry.direction}</span>
                      <StatusBadge tone={entry.tone}>{entry.status}</StatusBadge>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="content-section close-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">July close</p>
                  <h2>Statement readiness</h2>
                </div>
                <span className="progress-value">{dashboardSummary.closeProgress}%</span>
              </div>

              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={dashboardSummary.closeProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Monthly close readiness"
              >
                <span style={{ width: `${dashboardSummary.closeProgress}%` }} />
              </div>

              <div className="close-list">
                {closeChecklist.map((item) => (
                  <div key={item.label}>
                    <span className={item.done ? "check-done" : "check-pending"}>
                      {item.done ? <FileCheck2 className="size-4" /> : <Clock3 className="size-4" />}
                    </span>
                    <div>
                      <p>{item.label}</p>
                      <span>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Link className="secondary-button" href="/statements">
                <WalletCards className="size-4" />
                Open statement workspace
              </Link>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
