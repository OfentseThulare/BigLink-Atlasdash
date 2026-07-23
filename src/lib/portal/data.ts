import { cents, type Cents } from "@/domain/money";
import { isSupabaseConfigured, shouldUseDemoData } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/auth";
import {
  demoAuditEvents,
  cleanDashboard,
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
const UNRESOLVED_DISPUTE_STATUSES = ["open", "under_review", "resolution_pending"] as const;

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
  metadata: Record<string, unknown>;
};

type InvoiceRow = {
  id: string;
  issuer_company_id: string;
  bill_to_company_id: string | null;
  invoice_number: string;
  invoice_items?: {
    description: string;
    position: number;
  }[];
  bill_to_name: string;
  kind: string;
  issue_date: string;
  due_date: string | null;
  total_including_vat_cents: number;
  status: string;
  source_system: string;
  invoice_payments: { amount_cents: number }[] | null;
};

type DisputeLedgerEntry = {
  id: string;
  reference: string;
  description: string;
  status: string;
  debtor_company_id: string;
  creditor_company_id: string;
  amount_cents: number;
};

type DisputeRow = {
  id: string;
  reason: string;
  proposed_resolution: string | null;
  status: string;
  created_at: string;
  opened_by_company_id: string;
  opened_by: string;
  ledger_entry_id: string;
  ledger_entries: DisputeLedgerEntry | DisputeLedgerEntry[] | null;
};

type ReferralRow = {
  id: string;
  client_name: string;
  status: string;
  starts_on: string | null;
  commission_rate_basis_points: number;
  referred_by_company_id: string;
  beneficiary_company_id: string;
  submitted_by: string;
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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSettlementProposal(metadata: Record<string, unknown>) {
  const proposal = metadata.settlement_proposal;
  if (typeof proposal !== "object" || proposal === null) {
    return null;
  }

  const paidOn = getString((proposal as Record<string, unknown>).paid_on);
  const proposedByCompanyId = getString((proposal as Record<string, unknown>).proposed_by_company_id);
  const reference = getString((proposal as Record<string, unknown>).reference);

  if (!paidOn || !proposedByCompanyId) {
    return null;
  }

  return {
    paidOn,
    proposedByCompanyId,
    reference: reference || null,
  };
}

function mapLedgerEntry(
  row: LedgerRow,
  dispute: { id: string; status: string } | null,
): LedgerEntryView {
  return {
    id: row.id,
    reference: row.reference,
    date: formatDate(row.occurred_on),
    description: row.description,
    client: row.entry_type === "service_invoice" ? "Big Link Consulting" : "Commission item",
    direction: ledgerDirection(row),
    amount: cents(row.amount_cents),
    status: humanStatus(row.status),
    statusCode: row.status,
    tone: ledgerTone(row),
    debtorCompanyId: row.debtor_company_id,
    creditorCompanyId: row.creditor_company_id,
    disputeId: dispute?.id ?? null,
    disputeStatus: dispute?.status ?? null,
    settlementProposal: getSettlementProposal(row.metadata),
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
    .select(
      "id, reference, entry_type, debtor_company_id, creditor_company_id, amount_cents, status, occurred_on, description, metadata",
    )
    .order("occurred_on", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LedgerRow[];
}

async function getDisputesForEntries(entries: LedgerRow[]) {
  if (entries.length === 0) {
    return new Map<string, { id: string; status: string }>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("disputes")
    .select("id, ledger_entry_id, status")
    .in("ledger_entry_id", entries.map((row) => row.id))
    .in("status", ["open", "under_review", "resolution_pending"]);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [row.ledger_entry_id, { id: row.id, status: row.status }]));
}

export async function getDashboardData(): Promise<PortalDashboard> {
  if (!isSupabaseConfigured()) {
    return shouldUseDemoData() ? demoDashboard : cleanDashboard;
  }

  const [user, rows, pendingCommission, openDisputes] = await Promise.all([
    getPortalUser(),
    getLiveLedgerRows(),
    getPendingCommission(),
    getUnresolvedDisputeCount(),
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
    recentEntries: rows.slice(0, 8).map((row) => mapLedgerEntry(row, null)),
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
    return shouldUseDemoData() ? demoLedgerEntries : [];
  }

  await getPortalUser();
  const rows = await getLiveLedgerRows();
  const disputeRows = await getDisputesForEntries(rows);

  return rows.map((row) => mapLedgerEntry(row, disputeRows.get(row.id) ?? null));
}

export async function getInvoices(): Promise<InvoiceView[]> {
  if (!isSupabaseConfigured()) {
    return shouldUseDemoData() ? demoInvoices : [];
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_invoices")
    .select(
      `
        id, invoice_number, bill_to_name, issuer_company_id, bill_to_company_id, kind, invoice_items(description, position),
        issue_date, due_date, total_including_vat_cents, status, source_system,
        invoice_payments(amount_cents)
      `,
    )
    .order("issue_date", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    description: (row.invoice_items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)[0]?.description?.trim() || "No line description",
    id: row.id,
    number: row.invoice_number,
    client: row.bill_to_name,
    kind: humanStatus(row.kind),
    issueDate: formatDate(row.issue_date),
    dueDate: formatDate(row.due_date),
    total: cents(row.total_including_vat_cents),
    paid: cents((row.invoice_payments ?? []).reduce((total, payment) => total + payment.amount_cents, 0)),
    status: humanStatus(row.status),
    paidState: (() => {
      const paidAmount = (row.invoice_payments ?? []).reduce((total, payment) => total + payment.amount_cents, 0);
      if (paidAmount <= 0) {
        return "unpaid";
      }
      if (paidAmount < row.total_including_vat_cents) {
        return "partial";
      }
      return "paid";
    })(),
    sourceSystem: row.source_system === "atlas_dash" ? "Atlas Dash" : "Portal",
    issuerCompanyId: row.issuer_company_id,
    billToCompanyId: row.bill_to_company_id,
  }));
}

export async function getReferrals(): Promise<ReferralView[]> {
  if (!isSupabaseConfigured()) {
    return shouldUseDemoData() ? demoReferrals : [];
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referrals")
    .select(
      "id, client_name, referred_by_company_id, beneficiary_company_id, submitted_by, status, starts_on, commission_rate_basis_points",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    client: row.client_name,
    status: humanStatus(row.status),
    submittedBy: "Big Link",
    referredByCompanyId: row.referred_by_company_id,
    beneficiaryCompanyId: row.beneficiary_company_id,
    submittedByCompanyId: row.submitted_by,
    startsOn: formatDate(row.starts_on),
    rate: `${row.commission_rate_basis_points / 100}% of invoice value inc VAT`,
  }));
}

export async function getDeals(): Promise<DealView[]> {
  if (!isSupabaseConfigured()) {
    return shouldUseDemoData() ? demoDeals : [];
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
    return shouldUseDemoData() ? demoStatements : [];
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
    return shouldUseDemoData() ? demoDisputes : [];
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("disputes")
    .select(`
      id, reason, proposed_resolution, status, created_at, opened_by_company_id, opened_by, ledger_entry_id,
      ledger_entries!disputes_ledger_entry_id_fkey(id, reference, description, status, debtor_company_id, creditor_company_id, amount_cents)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const linkedRaw = (row.ledger_entries as DisputeRow["ledger_entries"] | null | undefined) ?? null;
    const linkedLedger = Array.isArray(linkedRaw) ? linkedRaw[0] ?? null : linkedRaw;
    const mappedAmount = linkedLedger?.amount_cents ? linkedLedger.amount_cents : 0;

    return {
      id: row.id,
      reference: linkedLedger?.reference ?? "Ledger item",
      reason: row.reason,
      proposedResolution: row.proposed_resolution,
      status: humanStatus(row.status),
      openedBy: row.opened_by_company_id === ATLAS_ID ? "Atlas" : "Big Link",
      openedByCompanyId: row.opened_by_company_id,
      createdAt: formatDate(row.created_at),
      ledgerEntryId: row.ledger_entry_id,
      ledgerEntryDescription: linkedLedger?.description ?? "Ledger item",
      ledgerEntryStatus: linkedLedger?.status ? humanStatus(linkedLedger.status) : "Unknown",
      ledgerDebtorCompanyId: linkedLedger?.debtor_company_id ?? "",
      ledgerCreditorCompanyId: linkedLedger?.creditor_company_id ?? "",
      ledgerAmount: cents(mappedAmount),
    };
  });
}

export async function getNotifications(): Promise<NotificationView[]> {
  if (!isSupabaseConfigured()) {
    return shouldUseDemoData() ? demoNotifications : [];
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
    return shouldUseDemoData() ? demoAuditEvents : [];
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

function isUnresolvedDisputeStatus(status: string) {
  return UNRESOLVED_DISPUTE_STATUSES.includes(status.toLowerCase() as (typeof UNRESOLVED_DISPUTE_STATUSES)[number]);
}

export async function getUnresolvedDisputeCount(): Promise<number> {
  if (!isSupabaseConfigured()) {
    if (!shouldUseDemoData()) {
      return 0;
    }

    return demoDisputes.filter((dispute) => isUnresolvedDisputeStatus(dispute.status)).length;
  }

  await getPortalUser();
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .in("status", UNRESOLVED_DISPUTE_STATUSES);

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
