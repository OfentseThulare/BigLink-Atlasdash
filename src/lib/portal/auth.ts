import { redirect } from "next/navigation";
import { isSupabaseConfigured, shouldUseDemoData } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanSetupUser, demoUser } from "@/lib/portal/demo";
import type { PortalUser } from "@/lib/portal/types";

type CompanyRef = { slug: string | null; display_name: string | null };
type MembershipRef = { companies: CompanyRef | CompanyRef[] | null };

type ProfileRow = {
  full_name: string | null;
  // One-to-one embeds come back as an object, one-to-many as an array.
  company_memberships: MembershipRef | MembershipRef[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value.at(0) ?? null;
  }

  return value ?? null;
}

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

  // company_memberships references profiles twice (profile_id and invited_by), so the
  // embed must name the foreign key. Without it PostgREST errors and the company
  // silently fell back to Atlas, mislabelling Big Link administrators.
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, company_memberships!company_memberships_profile_id_fkey(companies(slug, display_name))",
    )
    .eq("auth_user_id", userResult.user.id)
    .single<ProfileRow>();

  const name = profile?.full_name || userResult.user.email || "Portal administrator";
  const company = unwrap(unwrap(profile?.company_memberships)?.companies);
  const companyName = company?.slug === "big_link" ? "Big Link" : "Atlas";

  return {
    initials: initialsFromName(name) || "BL",
    name,
    role: `${companyName} administrator`,
    company: companyName,
    isDemo: false,
  };
}
