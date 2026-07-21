import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { getPortalUser } from "@/lib/portal/auth";

export async function AppShell({
  activeHref,
  children,
}: {
  activeHref: string;
  children: React.ReactNode;
}) {
  const user = await getPortalUser();

  return (
    <div className="app-frame">
      <Sidebar activeHref={activeHref} user={user} />
      <div className="app-main">
        <Topbar user={user} />
        {children}
      </div>
    </div>
  );
}
