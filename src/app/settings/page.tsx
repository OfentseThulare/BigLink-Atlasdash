import { KeyRound, ShieldCheck, UserPlus, Webhook } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendInvitationAction } from "@/lib/portal/actions";
import { listPortalPeople } from "@/lib/portal/people";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
  const live = isSupabaseConfigured();
  const people = live ? await listPortalPeople() : { members: [], pending: [] };

  return (
    <AppShell activeHref="/settings">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Portal controls</h1>
            <p>Security, integration, statement, and document storage configuration.</p>
          </div>
        </section>

        <section className="settings-grid">
          <article className="content-section settings-card">
            <div className="settings-icon">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2>Two step sign in</h2>
              <p>Every administrator receives a four digit code by email and must enter it before financial records load.</p>
            </div>
            <StatusBadge tone="credit">Required</StatusBadge>
          </article>

          <article className="content-section settings-card">
            <div className="settings-icon">
              <Webhook className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2>Atlas Dash sync</h2>
              <p>Atlas invoices are accepted as source records and processed into entitlements or service obligations.</p>
            </div>
            <StatusBadge tone={live ? "credit" : "pending"}>{live ? "Connected" : "Pending"}</StatusBadge>
          </article>

          <article className="content-section settings-card">
            <div className="settings-icon">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2>Administrator access</h2>
              <p>Named Atlas and Big Link administrators are modelled through active company memberships.</p>
            </div>
            <StatusBadge tone="pending">Invite controlled</StatusBadge>
          </article>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <h2>Invite an administrator</h2>
              <p>They receive an email invitation, set their own password, then verify by emailed code.</p>
            </div>
            <UserPlus className="size-5" aria-hidden="true" />
          </div>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {invited ? (
            <p className="auth-success" role="status">
              Invitation sent to {invited}.
            </p>
          ) : null}

          <form action={sendInvitationAction} className="action-form inline-form">
            <label>
              <span>Email address</span>
              <input className="text-field" name="email" type="email" required disabled={!live} />
            </label>
            <label>
              <span>Company</span>
              <select className="text-field" name="company" defaultValue="big_link" disabled={!live}>
                <option value="big_link">Big Link</option>
                <option value="atlas">Atlas Consulting</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={!live}>
              Send invitation
            </button>
          </form>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <h2>People</h2>
              <p>Active administrators and invitations that have not been accepted yet.</p>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Company</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {people.members.map((member) => (
                  <tr key={member.email}>
                    <td>{member.name}</td>
                    <td>{member.email}</td>
                    <td>{member.company}</td>
                    <td>
                      <StatusBadge tone="credit">Active</StatusBadge>
                    </td>
                  </tr>
                ))}
                {people.pending.map((invite) => (
                  <tr key={`pending-${invite.email}`}>
                    <td>Not accepted</td>
                    <td>{invite.email}</td>
                    <td>{invite.company}</td>
                    <td>
                      <StatusBadge tone="pending">Invited</StatusBadge>
                    </td>
                  </tr>
                ))}
                {people.members.length === 0 && people.pending.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No administrators yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
