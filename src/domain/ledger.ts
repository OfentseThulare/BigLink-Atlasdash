import { addCents, cents, subtractCents, type Cents } from "./money";
import { BALANCE_STATUSES, type LedgerStatus } from "./status";

export type CompanyCode = "atlas" | "big_link";

export interface LedgerEntry {
  id: string;
  debtor: CompanyCode;
  creditor: CompanyCode;
  amount: Cents;
  status: LedgerStatus;
}

export interface BilateralBalance {
  bigLinkOwesAtlas: Cents;
  atlasOwesBigLink: Cents;
  netAtlasReceivable: Cents;
}

export function calculateBilateralBalance(entries: LedgerEntry[]): BilateralBalance {
  let bigLinkOwesAtlas = cents(0);
  let atlasOwesBigLink = cents(0);

  for (const entry of entries) {
    if (!BALANCE_STATUSES.has(entry.status)) {
      continue;
    }

    if (entry.amount <= 0 || entry.debtor === entry.creditor) {
      throw new Error(`Ledger entry ${entry.id} has an invalid obligation.`);
    }

    if (entry.debtor === "big_link" && entry.creditor === "atlas") {
      bigLinkOwesAtlas = addCents(bigLinkOwesAtlas, entry.amount);
    } else {
      atlasOwesBigLink = addCents(atlasOwesBigLink, entry.amount);
    }
  }

  return {
    bigLinkOwesAtlas,
    atlasOwesBigLink,
    netAtlasReceivable: subtractCents(bigLinkOwesAtlas, atlasOwesBigLink),
  };
}
