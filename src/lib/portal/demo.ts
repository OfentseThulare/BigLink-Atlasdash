import { cents } from "@/domain/money";
import type {
  AuditEventView,
  DealView,
  DisputeView,
  InvoiceView,
  LedgerEntryView,
  NotificationView,
  PortalDashboard,
  PortalUser,
  ReferralView,
  StatementView,
} from "@/lib/portal/types";

const ATLAS_ID = "00000000-0000-4000-8000-000000000001";
const BIG_LINK_ID = "00000000-0000-4000-8000-000000000002";

export const demoUser: PortalUser = {
  initials: "OT",
  name: "Ofentse Thulare",
  role: "Atlas administrator",
  companyId: ATLAS_ID,
  company: "Atlas",
  isDemo: true,
};

export const cleanSetupUser: PortalUser = {
  initials: "BL",
  name: "Partnership Portal",
  role: "Supabase connection required",
  companyId: null,
  company: "Atlas",
  isDemo: false,
};

export const cleanDashboard: PortalDashboard = {
  user: cleanSetupUser,
  summary: {
    period: "Current period",
    netAtlasReceivable: cents(0),
    bigLinkOwesAtlas: cents(0),
    atlasOwesBigLink: cents(0),
    pendingCommission: cents(0),
    openDisputes: 0,
    closeProgress: 0,
  },
  recentEntries: [],
  closeChecklist: [
    { label: "Supabase connected", value: "Required", done: false },
    { label: "Opening balance loaded", value: "Pending", done: false },
    { label: "Current unpaid items loaded", value: "Pending", done: false },
    { label: "Statement approvals", value: "Not requested", done: false },
  ],
};

export const demoLedgerEntries: LedgerEntryView[] = [
  {
    id: "1",
    reference: "INV-2026-071",
    date: "18/07/2026",
    description: "Monthly lead generation services",
    client: "Big Link Consulting",
    direction: "Big Link owes Atlas",
    amount: cents(1_150_000),
    status: "Payable",
    statusCode: "payable",
    tone: "credit",
    debtorCompanyId: BIG_LINK_ID,
    creditorCompanyId: ATLAS_ID,
    disputeId: null,
    disputeStatus: null,
    settlementProposal: null,
  },
  {
    id: "2",
    reference: "COM-2026-044",
    date: "17/07/2026",
    description: "Referral commission, Refilwe Maps",
    client: "Refilwe Maps Consulting",
    direction: "Atlas owes Big Link",
    amount: cents(345_000),
    status: "Payable",
    statusCode: "payable",
    tone: "debit",
    debtorCompanyId: ATLAS_ID,
    creditorCompanyId: BIG_LINK_ID,
    disputeId: null,
    disputeStatus: null,
    settlementProposal: null,
  },
  {
    id: "3",
    reference: "COM-2026-043",
    date: "14/07/2026",
    description: "Advisory engagement commission release",
    client: "Northstar Holdings",
    direction: "Atlas owes Big Link",
    amount: cents(575_000),
    status: "Pending payment",
    statusCode: "pending_trigger",
    tone: "pending",
    debtorCompanyId: ATLAS_ID,
    creditorCompanyId: BIG_LINK_ID,
    disputeId: null,
    disputeStatus: null,
    settlementProposal: {
      paidOn: "2026-07-20",
      reference: "ADV-043",
      proposedByCompanyId: ATLAS_ID,
    },
  },
  {
    id: "4",
    reference: "ADJ-2026-006",
    date: "10/07/2026",
    description: "Campaign media cost correction",
    client: "Big Link Consulting",
    direction: "Under review",
    amount: cents(95_000),
    status: "Disputed",
    statusCode: "disputed",
    tone: "disputed",
    debtorCompanyId: BIG_LINK_ID,
    creditorCompanyId: ATLAS_ID,
    disputeId: "dispute-demo-1",
    disputeStatus: "Open",
    settlementProposal: null,
  },
];

export const demoDashboard: PortalDashboard = {
  user: demoUser,
  summary: {
    period: "July 2026",
    netAtlasReceivable: cents(1_248_500),
    bigLinkOwesAtlas: cents(2_018_500),
    atlasOwesBigLink: cents(770_000),
    pendingCommission: cents(635_000),
    openDisputes: 2,
    closeProgress: 72,
  },
  recentEntries: demoLedgerEntries,
  closeChecklist: [
    { label: "Payable items reconciled", value: "12 of 12", done: true },
    { label: "Pending commissions reviewed", value: "4 items", done: true },
    { label: "Open disputes resolved", value: "2 remaining", done: false },
    { label: "Statement approvals", value: "Not requested", done: false },
  ],
};

export const demoInvoices: InvoiceView[] = [
  {
    id: "invoice-1",
    number: "AT-INV-071",
    client: "Example Customer",
    kind: "Referral commission source",
    issueDate: "10/07/2026",
    dueDate: "30/07/2026",
    total: cents(115_000),
    paid: cents(57_500),
    status: "Partially paid",
    paidState: "partial",
    sourceSystem: "Atlas Dash",
    issuerCompanyId: ATLAS_ID,
    billToCompanyId: BIG_LINK_ID,
  },
  {
    id: "invoice-2",
    number: "BL-SVC-018",
    client: "Big Link Consulting",
    kind: "Direct service obligation",
    issueDate: "01/07/2026",
    dueDate: "15/07/2026",
    total: cents(1_150_000),
    paid: cents(0),
    status: "Issued",
    paidState: "unpaid",
    sourceSystem: "Portal",
    issuerCompanyId: BIG_LINK_ID,
    billToCompanyId: ATLAS_ID,
  },
  {
    id: "invoice-3",
    number: "AT-INV-090",
    client: "Northstar Holdings",
    kind: "Referral commission source",
    issueDate: "02/07/2026",
    dueDate: "20/07/2026",
    total: cents(200_000),
    paid: cents(200_000),
    status: "Paid",
    paidState: "paid",
    sourceSystem: "Atlas Dash",
    issuerCompanyId: ATLAS_ID,
    billToCompanyId: ATLAS_ID,
  },
];

export const demoReferrals: ReferralView[] = [
  {
    id: "referral-1",
    client: "Example Customer",
    status: "Approved",
    submittedBy: "Big Link",
    submittedByCompanyId: BIG_LINK_ID,
    startsOn: "01/07/2026",
    rate: "10% of invoice value inc VAT",
    referredByCompanyId: BIG_LINK_ID,
    beneficiaryCompanyId: ATLAS_ID,
  },
  {
    id: "referral-2",
    client: "Northstar Holdings",
    status: "Awaiting approval",
    submittedBy: "Big Link",
    submittedByCompanyId: BIG_LINK_ID,
    startsOn: "Pending",
    rate: "10% of invoice value inc VAT",
    referredByCompanyId: BIG_LINK_ID,
    beneficiaryCompanyId: ATLAS_ID,
  },
];

export const demoDeals: DealView[] = [
  {
    id: "deal-1",
    title: "Infrastructure advisory commission",
    customer: "Northstar Holdings",
    closedOn: "14/07/2026",
    value: cents(575_000),
    status: "Awaiting approval",
  },
  {
    id: "deal-2",
    title: "Closed platform services deal",
    customer: "Big Link Consulting",
    closedOn: "08/07/2026",
    value: cents(1_150_000),
    status: "Closed",
  },
];

export const demoStatements: StatementView[] = [
  {
    id: "statement-1",
    period: "01/07/2026 to 31/07/2026",
    status: "Proposed",
    settlementAmount: cents(1_248_500),
    payer: "Big Link pays Atlas",
    dueOn: "07/08/2026",
  },
];

export const demoDisputes: DisputeView[] = [
  {
    id: "dispute-1",
    reference: "ADJ-2026-006",
    reason: "Campaign media cost correction requires review.",
    proposedResolution: null,
    status: "Open",
    openedBy: "Atlas",
    openedByCompanyId: ATLAS_ID,
    createdAt: "10/07/2026",
    ledgerEntryId: "4",
    ledgerEntryDescription: "Campaign media cost correction",
    ledgerEntryStatus: "Disputed",
    ledgerDebtorCompanyId: BIG_LINK_ID,
    ledgerCreditorCompanyId: ATLAS_ID,
    ledgerAmount: cents(95_000),
  },
  {
    id: "dispute-2",
    reference: "COM-2026-043",
    reason: "Commission adjustment request for partial settlement review.",
    proposedResolution: "Close with adjustment",
    status: "resolved",
    openedBy: "Atlas",
    openedByCompanyId: ATLAS_ID,
    createdAt: "02/07/2026",
    ledgerEntryId: "3",
    ledgerEntryDescription: "Advisory engagement commission release",
    ledgerEntryStatus: "Payable",
    ledgerDebtorCompanyId: ATLAS_ID,
    ledgerCreditorCompanyId: BIG_LINK_ID,
    ledgerAmount: cents(575_000),
  },
];

export const demoNotifications: NotificationView[] = [
  {
    id: "notification-1",
    title: "Statement proposed",
    body: "July 2026 partnership statement is ready for approval.",
    createdAt: "21/07/2026",
    read: false,
  },
];

export const demoAuditEvents: AuditEventView[] = [
  {
    id: "audit-1",
    action: "insert",
    subject: "monthly_statements",
    actor: "Ofentse Thulare",
    createdAt: "21/07/2026",
  },
];
