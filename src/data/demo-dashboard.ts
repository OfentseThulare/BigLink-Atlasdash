import { cents } from "@/domain/money";

export const dashboardSummary = {
  period: "July 2026",
  netAtlasReceivable: cents(1_248_500),
  bigLinkOwesAtlas: cents(2_018_500),
  atlasOwesBigLink: cents(770_000),
  pendingCommission: cents(635_000),
  openDisputes: 2,
  closeProgress: 72,
};

export const recentEntries = [
  {
    id: "INV-2026-071",
    date: "18/07/2026",
    description: "Monthly lead generation services",
    client: "Big Link Consulting",
    direction: "Big Link owes Atlas",
    amount: cents(1_150_000),
    status: "Payable",
    tone: "credit" as const,
  },
  {
    id: "COM-2026-044",
    date: "17/07/2026",
    description: "Referral commission, Refilwe Maps",
    client: "Refilwe Maps Consulting",
    direction: "Atlas owes Big Link",
    amount: cents(345_000),
    status: "Payable",
    tone: "debit" as const,
  },
  {
    id: "INV-2026-068",
    date: "14/07/2026",
    description: "Advisory engagement, second instalment",
    client: "Northstar Holdings",
    direction: "Commission source",
    amount: cents(575_000),
    status: "Pending payment",
    tone: "pending" as const,
  },
  {
    id: "ADJ-2026-006",
    date: "10/07/2026",
    description: "Campaign media cost correction",
    client: "Big Link Consulting",
    direction: "Under review",
    amount: cents(95_000),
    status: "Disputed",
    tone: "disputed" as const,
  },
];

export const closeChecklist = [
  { label: "Payable items reconciled", value: "12 of 12", done: true },
  { label: "Pending commissions reviewed", value: "4 items", done: true },
  { label: "Open disputes resolved", value: "2 remaining", done: false },
  { label: "Statement approvals", value: "Not requested", done: false },
];
