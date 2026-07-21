import { Bell } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { getNotifications } from "@/lib/portal/data";

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <AppShell activeHref="/notifications">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Notifications</p>
            <h1>Portal alerts</h1>
            <p>Approval requests, payment submissions, dispute updates, and monthly close events.</p>
          </div>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inbox</p>
              <h2>Recent notifications</h2>
            </div>
            <Bell className="size-5 text-ink" aria-hidden="true" />
          </div>
          <div className="record-list">
            {notifications.map((notification) => (
              <article className="record-row" key={notification.id}>
                <div>
                  <span className="reference">{notification.createdAt}</span>
                  <h3>{notification.title}</h3>
                  <p>{notification.body}</p>
                </div>
                <div className="record-row-meta">
                  <StatusBadge tone={notification.read ? "disputed" : "pending"}>
                    {notification.read ? "Read" : "Unread"}
                  </StatusBadge>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
