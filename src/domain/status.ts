export type LedgerStatus =
  | "draft"
  | "awaiting_approval"
  | "pending_trigger"
  | "payable"
  | "included_in_statement"
  | "settled"
  | "disputed"
  | "rejected"
  | "voided_by_adjustment"
  | "carried_forward";

export const BALANCE_STATUSES: ReadonlySet<LedgerStatus> = new Set([
  "payable",
  "included_in_statement",
  "carried_forward",
]);
