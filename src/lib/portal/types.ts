import type { Cents } from "@/domain/money";
import type { BadgeTone } from "@/components/status-badge";

export type PortalUser = {
  initials: string;
  name: string;
  role: string;
  companyId: string | null;
  company: "Atlas" | "Big Link";
  isDemo: boolean;
};

export type DashboardSummary = {
  period: string;
  netAtlasReceivable: Cents;
  bigLinkOwesAtlas: Cents;
  atlasOwesBigLink: Cents;
  pendingCommission: Cents;
  openDisputes: number;
  closeProgress: number;
};

export type LedgerEntryView = {
  id: string;
  reference: string;
  date: string;
  description: string;
  client: string;
  direction: string;
  amount: Cents;
  status: string;
  statusCode: string;
  tone: BadgeTone;
  debtorCompanyId: string;
  creditorCompanyId: string;
  disputeId: string | null;
  disputeStatus: string | null;
  settlementProposal: {
    paidOn: string;
    reference: string | null;
    proposedByCompanyId: string;
  } | null;
};

export type InvoiceView = {
  id: string;
  number: string;
  client: string;
  description: string;
  kind: string;
  issueDate: string;
  dueDate: string;
  total: Cents;
  paid: Cents;
  status: string;
  paidState: "unpaid" | "partial" | "paid";
  sourceSystem: string;
  issuerCompanyId: string;
  billToCompanyId: string | null;
};

export type ReferralView = {
  id: string;
  client: string;
  status: string;
  submittedBy: string;
  startsOn: string;
  rate: string;
  referredByCompanyId: string;
  beneficiaryCompanyId: string;
  submittedByCompanyId: string;
};

export type DealView = {
  id: string;
  title: string;
  customer: string;
  closedOn: string;
  value: Cents;
  status: string;
};

export type StatementView = {
  id: string;
  period: string;
  status: string;
  settlementAmount: Cents;
  payer: string;
  dueOn: string;
};

export type DisputeView = {
  id: string;
  reference: string;
  reason: string;
  proposedResolution: string | null;
  status: string;
  openedBy: string;
  openedByCompanyId: string;
  createdAt: string;
  ledgerEntryId: string;
  ledgerEntryDescription: string;
  ledgerEntryStatus: string;
  ledgerDebtorCompanyId: string;
  ledgerCreditorCompanyId: string;
  ledgerAmount: Cents;
};

export type NotificationView = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type AuditEventView = {
  id: string;
  action: string;
  subject: string;
  actor: string;
  createdAt: string;
};

export type PortalDashboard = {
  user: PortalUser;
  summary: DashboardSummary;
  recentEntries: LedgerEntryView[];
  closeChecklist: Array<{ label: string; value: string; done: boolean }>;
};
