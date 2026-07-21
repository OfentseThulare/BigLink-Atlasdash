import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoUser } from "@/lib/portal/demo";
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
    return demoUser;
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    redirect("/login");
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assurance?.currentLevel !== "aal2") {
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
