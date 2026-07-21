"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requireLivePortal() {
  if (!isSupabaseConfigured()) {
    throw new Error("Connect Supabase before submitting portal changes.");
  }
}

function centsFromRand(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return Math.round(parsed * 100);
}

const referralSchema = z.object({
  clientName: z.string().trim().min(2).max(160),
  clientEmail: z.string().trim().email().optional().or(z.literal("")),
  registrationNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function submitReferralAction(formData: FormData) {
  requireLivePortal();
  const values = referralSchema.parse({
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    registrationNumber: formData.get("registrationNumber"),
    notes: formData.get("notes"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_referral", {
    p_client_name: values.clientName,
    p_client_email: values.clientEmail || null,
    p_client_registration_number: values.registrationNumber || null,
    p_relationship_notes: values.notes || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/referrals");
  redirect("/referrals");
}

const dealSchema = z.object({
  title: z.string().trim().min(2).max(180),
  customerName: z.string().trim().min(2).max(160),
  closedOn: z.string().trim().min(10),
});

export async function createDealAction(formData: FormData) {
  requireLivePortal();
  const values = dealSchema.parse({
    title: formData.get("title"),
    customerName: formData.get("customerName"),
    closedOn: formData.get("closedOn"),
  });
  const amountCents = centsFromRand(formData.get("dealValue"));
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, company_memberships(company_id)")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const companyId = profile.company_memberships?.at(0)?.company_id;

  if (!companyId) {
    throw new Error("No active company membership found.");
  }

  const { error } = await supabase.from("deals").insert({
    reporting_company_id: companyId,
    customer_name: values.customerName,
    title: values.title,
    closed_on: values.closedOn,
    deal_value_cents: amountCents,
    status: "draft",
    created_by: profile.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/deals");
  redirect("/deals");
}

export async function recordInvoicePaymentAction(formData: FormData) {
  requireLivePortal();
  const invoiceId = z.string().uuid().parse(formData.get("invoiceId"));
  const amountCents = centsFromRand(formData.get("amount"));
  const paidOn = z.string().trim().min(10).parse(formData.get("paidOn"));
  const reference = z.string().trim().max(120).optional().parse(formData.get("reference") || undefined);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount_cents: amountCents,
    p_paid_on: paidOn,
    p_reference: reference ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/invoices");
  revalidatePath("/");
  redirect("/invoices");
}

export async function openDisputeAction(formData: FormData) {
  requireLivePortal();
  const ledgerEntryId = z.string().uuid().parse(formData.get("ledgerEntryId"));
  const reason = z.string().trim().min(10).max(2000).parse(formData.get("reason"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("open_ledger_dispute", {
    p_ledger_entry_id: ledgerEntryId,
    p_reason: reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/disputes");
  revalidatePath("/ledger");
  redirect("/disputes");
}

export async function proposeMonthlyStatementAction(formData: FormData) {
  requireLivePortal();
  const periodStart = z.string().trim().min(10).parse(formData.get("periodStart"));
  const periodEnd = z.string().trim().min(10).parse(formData.get("periodEnd"));
  const dueOn = z.string().trim().min(10).parse(formData.get("dueOn"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("propose_monthly_statement", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_due_on: dueOn,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/statements");
  revalidatePath("/");
  redirect("/statements");
}

export async function signInAction(formData: FormData) {
  requireLivePortal();
  const email = z.string().email().parse(formData.get("email"));
  const password = z.string().min(8).parse(formData.get("password"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
