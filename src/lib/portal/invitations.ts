import { createHash, randomBytes } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/resend";
import { invitationEmail } from "@/lib/email/templates";
import { getActiveSession, isSessionVerified } from "@/lib/portal/mfa";

export const INVITE_TTL_DAYS = 7;

export type CompanySlug = "atlas" | "big_link";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function baseUrl() {
  const configured = process.env.PORTAL_BASE_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

// Only a signed in administrator who has already cleared the email second factor may
// hand out access. Without the MFA check a stolen password alone would be enough.
async function requireVerifiedAdmin() {
  const session = await getActiveSession();

  if (!session) {
    throw new Error("Sign in before sending invitations.");
  }

  if (!(await isSessionVerified())) {
    throw new Error("Complete the emailed code step before sending invitations.");
  }

  const service = createSupabaseServiceClient();
  const { data: membership } = await service
    .from("company_memberships")
    .select("company_id, role, status, profiles(full_name)")
    .eq("profile_id", session.profileId)
    .maybeSingle<{
      company_id: string;
      role: string;
      status: string;
      profiles: { full_name: string } | null;
    }>();

  if (!membership || membership.status !== "active" || membership.role !== "administrator") {
    throw new Error("Only an active administrator can send invitations.");
  }

  return {
    profileId: session.profileId,
    companyId: membership.company_id,
    name: membership.profiles?.full_name ?? "An administrator",
  };
}

export async function sendInvitation(rawEmail: string, companySlug: CompanySlug) {
  const email = rawEmail.trim().toLowerCase();
  const actor = await requireVerifiedAdmin();
  const service = createSupabaseServiceClient();

  const { data: company } = await service
    .from("companies")
    .select("id, display_name")
    .eq("slug", companySlug)
    .maybeSingle<{ id: string; display_name: string }>();

  if (!company) {
    throw new Error("Unknown company.");
  }

  const { data: existingProfile } = await service
    .from("profiles")
    .select("id, company_memberships(status)")
    .eq("email", email)
    .maybeSingle<{ id: string; company_memberships: Array<{ status: string }> | null }>();

  if (existingProfile?.company_memberships?.some((m) => m.status === "active")) {
    throw new Error("That person already has an active portal account.");
  }

  // One live invitation per address per company, enforced by a partial unique index.
  await service
    .from("invitations")
    .delete()
    .eq("company_id", company.id)
    .eq("email", email)
    .is("accepted_at", null);

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();

  const { error } = await service.from("invitations").insert({
    company_id: company.id,
    email,
    token_hash: hashToken(token),
    invited_by: actor.profileId,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  const message = invitationEmail(
    `${baseUrl()}/invite/${token}`,
    company.display_name,
    actor.name,
    INVITE_TTL_DAYS,
  );

  await sendEmail({ to: email, ...message });

  return { email, company: company.display_name };
}

export interface InvitationPreview {
  email: string;
  companyName: string;
}

export async function loadInvitation(token: string): Promise<InvitationPreview | null> {
  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("invitations")
    .select("email, expires_at, accepted_at, companies(display_name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle<{
      email: string;
      expires_at: string;
      accepted_at: string | null;
      companies: { display_name: string } | null;
    }>();

  if (!data || data.accepted_at || new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  return { email: data.email, companyName: data.companies?.display_name ?? "the portal" };
}

export async function acceptInvitation(token: string, fullName: string, password: string) {
  const service = createSupabaseServiceClient();
  const { data: invitation } = await service
    .from("invitations")
    .select("id, company_id, email, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle<{
      id: string;
      company_id: string;
      email: string;
      expires_at: string;
      accepted_at: string | null;
    }>();

  if (!invitation || invitation.accepted_at) {
    throw new Error("This invitation has already been used.");
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    throw new Error("This invitation has expired. Ask for a new one.");
  }

  const { data: existingProfile } = await service
    .from("profiles")
    .select("id, auth_user_id")
    .eq("email", invitation.email)
    .maybeSingle<{ id: string; auth_user_id: string }>();

  let profileId = existingProfile?.id ?? null;

  if (existingProfile) {
    // Re-invite of a known address: reset the password rather than duplicate the user.
    const { error } = await service.auth.admin.updateUserById(existingProfile.auth_user_id, {
      password,
      email_confirm: true,
    });

    if (error) {
      throw new Error(error.message);
    }

    await service
      .from("profiles")
      .update({ full_name: fullName, status: "active" })
      .eq("id", existingProfile.id);
  } else {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created.user) {
      throw new Error(createError?.message ?? "Could not create the account.");
    }

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .insert({
        auth_user_id: created.user.id,
        full_name: fullName,
        email: invitation.email,
        status: "active",
      })
      .select("id")
      .single<{ id: string }>();

    if (profileError) {
      throw new Error(profileError.message);
    }

    profileId = profile.id;
  }

  const { error: membershipError } = await service.from("company_memberships").upsert(
    {
      profile_id: profileId,
      company_id: invitation.company_id,
      role: "administrator",
      status: "active",
      activated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const { error: acceptError } = await service
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  if (acceptError) {
    throw new Error(acceptError.message);
  }

  return { email: invitation.email };
}
