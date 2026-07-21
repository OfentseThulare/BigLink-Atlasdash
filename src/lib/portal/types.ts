import type { Cents } from "@/domain/money";
import type { BadgeTone } from "@/components/status-badge";

export type PortalUser = {
  initials: string;
  name: string;
  role: string;
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
  tone: BadgeTone;
};

export type InvoiceView = {
  id: string;
  number: string;
  client: string;
  kind: string;
  issueDate: string;
  dueDate: string;
  total: Cents;
  paid: Cents;
  status: string;
  sourceSystem: string;
};

export type ReferralView = {
  id: string;
  client: string;
  status: string;
  submittedBy: string;
  startsOn: string;
  rate: string;
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
  status: string;
  openedBy: string;
  createdAt: string;
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
