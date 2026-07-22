import { createSupabaseServiceClient } from "@/lib/supabase/service";

export interface PortalPerson {
  name: string;
  email: string;
  company: string;
}

export interface PendingInvite {
  email: string;
  company: string;
}

// Read through the service client: the RLS policies on profiles and invitations are
// scoped to the caller's own company, and this list is deliberately both sides.
export async function listPortalPeople(): Promise<{
  members: PortalPerson[];
  pending: PendingInvite[];
}> {
  const service = createSupabaseServiceClient();

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    service
      .from("company_memberships")
      .select("status, profiles(full_name, email), companies(display_name)")
      .eq("status", "active"),
    service
      .from("invitations")
      .select("email, companies(display_name)")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);

  // supabase-js types embedded relations as arrays, so unwrap the first row of each.
  type Embedded<T> = T | T[] | null;

  function first<T>(value: Embedded<T>): T | null {
    return Array.isArray(value) ? (value.at(0) ?? null) : value;
  }

  type MembershipRow = {
    profiles: Embedded<{ full_name: string; email: string }>;
    companies: Embedded<{ display_name: string }>;
  };
  type InviteRow = { email: string; companies: Embedded<{ display_name: string }> };

  const members = ((memberships ?? []) as unknown as MembershipRow[])
    .map((row) => ({ profile: first(row.profiles), company: first(row.companies) }))
    .filter((row) => row.profile)
    .map((row) => ({
      name: row.profile?.full_name ?? "Unknown",
      email: row.profile?.email ?? "",
      company: row.company?.display_name ?? "Unknown",
    }));

  const pending = ((invitations ?? []) as unknown as InviteRow[]).map((row) => ({
    email: row.email,
    company: first(row.companies)?.display_name ?? "Unknown",
  }));

  return { members, pending };
}
