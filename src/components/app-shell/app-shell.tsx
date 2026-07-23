import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { getPortalUser } from "@/lib/portal/auth";
import { getUnresolvedDisputeCount } from "@/lib/portal/data";

export async function AppShell({
  activeHref,
  children,
}: {
  activeHref: string;
  children: React.ReactNode;
}) {
  const [user, unresolvedDisputeCount] = await Promise.all([
    getPortalUser(),
    getUnresolvedDisputeCount(),
  ]);

  return (
    <div className="app-frame">
      <Sidebar activeHref={activeHref} user={user} unresolvedDisputeCount={unresolvedDisputeCount} />
      <div className="app-main">
        <Topbar user={user} />
        {children}
      </div>
    </div>
  );
}
