import { absoluteCents, addCents, cents, type Cents } from "./money";
import { calculateBilateralBalance, type CompanyCode, type LedgerEntry } from "./ledger";

export interface StatementCalculation {
  openingNetAtlasReceivable: Cents;
  bigLinkOwesAtlas: Cents;
  atlasOwesBigLink: Cents;
  closingNetAtlasReceivable: Cents;
  payer: CompanyCode | null;
  receiver: CompanyCode | null;
  settlementAmount: Cents;
}

export function calculateStatement(
  entries: LedgerEntry[],
  openingNetAtlasReceivable: Cents = cents(0),
): StatementCalculation {
  const balance = calculateBilateralBalance(entries);
  const closingNetAtlasReceivable = addCents(
    openingNetAtlasReceivable,
    balance.netAtlasReceivable,
  );

  if (closingNetAtlasReceivable === 0) {
    return {
      openingNetAtlasReceivable,
      bigLinkOwesAtlas: balance.bigLinkOwesAtlas,
      atlasOwesBigLink: balance.atlasOwesBigLink,
      closingNetAtlasReceivable,
      payer: null,
      receiver: null,
      settlementAmount: cents(0),
    };
  }

  return {
    openingNetAtlasReceivable,
    bigLinkOwesAtlas: balance.bigLinkOwesAtlas,
    atlasOwesBigLink: balance.atlasOwesBigLink,
    closingNetAtlasReceivable,
    payer: closingNetAtlasReceivable > 0 ? "big_link" : "atlas",
    receiver: closingNetAtlasReceivable > 0 ? "atlas" : "big_link",
    settlementAmount: absoluteCents(closingNetAtlasReceivable),
  };
}
