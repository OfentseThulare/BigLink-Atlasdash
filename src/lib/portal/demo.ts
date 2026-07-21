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

export const demoUser: PortalUser = {
  initials: "OT",
  name: "Ofentse Thulare",
  role: "Atlas administrator",
  company: "Atlas",
  isDemo: true,
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
    tone: "credit",
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
    tone: "debit",
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
    tone: "pending",
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
    tone: "disputed",
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
    sourceSystem: "Atlas Dash",
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
    sourceSystem: "Portal",
  },
];

export const demoReferrals: ReferralView[] = [
  {
    id: "referral-1",
    client: "Example Customer",
    status: "Approved",
    submittedBy: "Big Link",
    startsOn: "01/07/2026",
    rate: "10% of invoice value inc VAT",
  },
  {
    id: "referral-2",
    client: "Northstar Holdings",
    status: "Awaiting approval",
    submittedBy: "Big Link",
    startsOn: "Pending",
    rate: "10% of invoice value inc VAT",
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
    status: "Open",
    openedBy: "Atlas",
    createdAt: "10/07/2026",
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
