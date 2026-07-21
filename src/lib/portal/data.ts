import { cents, type Cents } from "@/domain/money";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/auth";
import {
  demoAuditEvents,
  demoDashboard,
  demoDeals,
  demoDisputes,
  demoInvoices,
  demoLedgerEntries,
  demoNotifications,
  demoReferrals,
  demoStatements,
} from "@/lib/portal/demo";
import type {
  AuditEventView,
  DealView,
  DisputeView,
  InvoiceView,
  LedgerEntryView,
  NotificationView,
  PortalDashboard,
  ReferralView,
  StatementView,
} from "@/lib/portal/types";

const ATLAS_ID = "00000000-0000-4000-8000-000000000001";
const BIG_LINK_ID = "00000000-0000-4000-8000-000000000002";

type LedgerRow = {
  id: string;
  reference: string;
  entry_type: string;
  debtor_company_id: string;
  creditor_company_id: string;
  amount_cents: number;
  status: string;
  occurred_on: string;
  description: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function humanStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ledgerTone(row: LedgerRow): LedgerEntryView["tone"] {
  if (row.status === "disputed") {
    return "disputed";
  }

  if (row.status === "pending_trigger" || row.status === "awaiting_approval") {
    return "pending";
  }

  return row.creditor_company_id === ATLAS_ID ? "credit" : "debit";
}

function ledgerDirection(row: LedgerRow) {
  if (row.debtor_company_id === BIG_LINK_ID && row.creditor_company_id === ATLAS_ID) {
    return "Big Link owes Atlas";
  }

  if (row.debtor_company_id === ATLAS_ID && row.creditor_company_id === BIG_LINK_ID) {
    return "Atlas owes Big Link";
  }

  return "Partnership obligation";
}

function mapLedgerEntry(row: LedgerRow): LedgerEntryView {
  return {
    id: row.id,
    reference: row.reference,
    date: formatDate(row.occurred_on),
    description: row.description,
    client: row.entry_type === "service_invoice" ? "Big Link Consulting" : "Commission item",
    direction: ledgerDirection(row),
    amount: cents(row.amount_cents),
    status: humanStatus(row.status),
    tone: ledgerTone(row),
  };
}

function sumByDirection(rows: LedgerRow[], debtor: string, creditor: string): Cents {
  return cents(
    rows
      .filter((row) => row.status === "payable")
      .filter((row) => row.debtor_company_id === debtor && row.creditor_company_id === creditor)
      .reduce((total, row) => total + row.amount_cents, 0),
  );
}

async function getLiveLedgerRows() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, reference, entry_type, debtor_company_id, creditor_company_id, amount_cents, status, occurred_on, description")
    .order("occurred_on", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LedgerRow[];
}

export async function getDashboardData(): Promise<PortalDashboard> {
  if (!isSupabaseConfigured()) {
    return demoDashboard;
  }

  const [user, rows, pendingCommission, openDisputes] = await Promise.all([
    getPortalUser(),
    getLiveLedgerRows(),
    getPendingCommission(),
    getOpenDisputeCount(),
  ]);

  const bigLinkOwesAtlas = sumByDirection(rows, BIG_LINK_ID, ATLAS_ID);
  const atlasOwesBigLink = sumByDirection(rows, ATLAS_ID, BIG_LINK_ID);
  const payableCount = rows.filter((row) => row.status === "payable").length;
  const proposedStatement = await getLatestStatement();

  return {
    user,
    summary: {
      period: "July 2026",
      netAtlasReceivable: cents(bigLinkOwesAtlas - atlasOwesBigLink),
      bigLinkOwesAtlas,
      atlasOwesBigLink,
      pendingCommission,
      openDisputes,
      closeProgress: proposedStatement ? 88 : Math.min(80, Math.round((payableCount / 12) * 100)),
    },
    recentEntries: rows.slice(0, 8).map(mapLedgerEntry),
    closeChecklist: [
      { label: "Payable items reconciled", value: `${payableCount} open`, done: payableCount > 0 },
      { label: "Pending commissions reviewed", value: pendingCommission > 0 ? "Items pending" : "Clear", done: true },
      { label: "Open disputes resolved", value: `${openDisputes} remaining`, done: openDisputes === 0 },
      { label: "Statement approvals", value: proposedStatement?.status ?? "Not requested", done: proposedStatement?.status === "settled" },
    ],
  };
}

export async function getLedgerEntries(): Promise<LedgerEntryView[]> {
  if (!isSupabaseConfigured()) {
    return demoLedgerEntries;
  }

  await getPortalUser();
  return (await getLiveLedgerRows()).map(mapLedgerEntry);
}

export async function getInvoices(): Promise<InvoiceView[]> {
  if (!isSupabaseConfigured()) {
    return demoInvoices;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_invoices")
    .select("id, invoice_number, bill_to_name, kind, issue_date, due_date, total_including_vat_cents, status, source_system, invoice_payments(amount_cents)")
    .order("issue_date", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    number: row.invoice_number,
    client: row.bill_to_name,
    kind: humanStatus(row.kind),
    issueDate: formatDate(row.issue_date),
    dueDate: formatDate(row.due_date),
    total: cents(row.total_including_vat_cents),
    paid: cents((row.invoice_payments ?? []).reduce((total, payment) => total + payment.amount_cents, 0)),
    status: humanStatus(row.status),
    sourceSystem: row.source_system === "atlas_dash" ? "Atlas Dash" : "Portal",
  }));
}

export async function getReferrals(): Promise<ReferralView[]> {
  if (!isSupabaseConfigured()) {
    return demoReferrals;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referrals")
    .select("id, client_name, status, starts_on, commission_rate_basis_points")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    client: row.client_name,
    status: humanStatus(row.status),
    submittedBy: "Big Link",
    startsOn: formatDate(row.starts_on),
    rate: `${row.commission_rate_basis_points / 100}% of invoice value inc VAT`,
  }));
}

export async function getDeals(): Promise<DealView[]> {
  if (!isSupabaseConfigured()) {
    return demoDeals;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("deals")
    .select("id, title, customer_name, closed_on, deal_value_cents, status")
    .order("closed_on", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    customer: row.customer_name,
    closedOn: formatDate(row.closed_on),
    value: cents(row.deal_value_cents),
    status: humanStatus(row.status),
  }));
}

export async function getStatements(): Promise<StatementView[]> {
  if (!isSupabaseConfigured()) {
    return demoStatements;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("monthly_statements")
    .select("id, period_start, period_end, status, settlement_amount_cents, payer_company_id, due_on")
    .order("period_end", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    period: `${formatDate(row.period_start)} to ${formatDate(row.period_end)}`,
    status: humanStatus(row.status),
    settlementAmount: cents(row.settlement_amount_cents),
    payer: row.settlement_amount_cents === 0
      ? "No settlement due"
      : row.payer_company_id === BIG_LINK_ID
        ? "Big Link pays Atlas"
        : "Atlas pays Big Link",
    dueOn: formatDate(row.due_on),
  }));
}

export async function getDisputes(): Promise<DisputeView[]> {
  if (!isSupabaseConfigured()) {
    return demoDisputes;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("disputes")
    .select("id, reason, status, created_at, opened_by_company_id, ledger_entries(reference)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const ledgerEntry = Array.isArray(row.ledger_entries)
      ? row.ledger_entries.at(0)
      : row.ledger_entries;

    return {
      id: row.id,
      reference: ledgerEntry?.reference ?? "Ledger item",
      reason: row.reason,
      status: humanStatus(row.status),
      openedBy: row.opened_by_company_id === ATLAS_ID ? "Atlas" : "Big Link",
      createdAt: formatDate(row.created_at),
    };
  });
}

export async function getNotifications(): Promise<NotificationView[]> {
  if (!isSupabaseConfigured()) {
    return demoNotifications;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: formatDate(row.created_at),
    read: Boolean(row.read_at),
  }));
}

export async function getAuditEvents(): Promise<AuditEventView[]> {
  if (!isSupabaseConfigured()) {
    return demoAuditEvents;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, action, subject_type, actor_profile_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    subject: row.subject_type,
    actor: row.actor_profile_id ?? "System",
    createdAt: formatDate(row.created_at),
  }));
}

async function getPendingCommission(): Promise<Cents> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("commission_entitlements")
    .select("total_entitlement_cents, released_cents, status")
    .in("status", ["pending_trigger", "partially_payable"]);

  if (error) {
    throw new Error(error.message);
  }

  return cents(
    (data ?? []).reduce(
      (total, row) => total + Math.max(row.total_entitlement_cents - row.released_cents, 0),
      0,
    ),
  );
}

async function getOpenDisputeCount() {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "under_review", "resolution_pending"]);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function getLatestStatement() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("monthly_statements")
    .select("status")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
