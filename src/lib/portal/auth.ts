import { redirect } from "next/navigation";
import { isSupabaseConfigured, shouldUseDemoData } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanSetupUser, demoUser } from "@/lib/portal/demo";
import type { PortalUser } from "@/lib/portal/types";

type ProfileRow = {
  full_name: string | null;
  company_memberships: Array<{
    companies: { slug: string | null; display_name: string | null } | null;
  }> | null;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");
}

export async function getPortalUser(): Promise<PortalUser> {
  if (!isSupabaseConfigured()) {
    return shouldUseDemoData() ? demoUser : cleanSetupUser;
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    redirect("/login");
  }

  // The second factor is an emailed numeric code, not a TOTP app, so this asks the
  // database rather than reading the session assurance level.
  const { data: verified } = await supabase.rpc("has_required_mfa");

  if (verified !== true) {
    redirect("/mfa");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_memberships(companies(slug, display_name))")
    .eq("auth_user_id", userResult.user.id)
    .single<ProfileRow>();

  const name = profile?.full_name || userResult.user.email || "Portal administrator";
  const company = profile?.company_memberships?.at(0)?.companies;
  const companyName = company?.slug === "big_link" ? "Big Link" : "Atlas";

  return {
    initials: initialsFromName(name) || "BL",
    name,
    role: `${companyName} administrator`,
    company: companyName,
    isDemo: false,
  };
}
