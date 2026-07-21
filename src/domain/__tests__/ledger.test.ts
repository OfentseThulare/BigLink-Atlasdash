import { describe, expect, it } from "vitest";
import { calculateBilateralBalance, type LedgerEntry } from "../ledger";
import { cents } from "../money";

describe("bilateral ledger", () => {
  it("keeps gross obligations and calculates Atlas net receivable", () => {
    const entries: LedgerEntry[] = [
      {
        id: "atlas-invoice",
        debtor: "big_link",
        creditor: "atlas",
        amount: cents(1_500_000),
        status: "payable",
      },
      {
        id: "referral-commission",
        debtor: "atlas",
        creditor: "big_link",
        amount: cents(400_000),
        status: "payable",
      },
    ];

    expect(calculateBilateralBalance(entries)).toEqual({
      bigLinkOwesAtlas: 1_500_000,
      atlasOwesBigLink: 400_000,
      netAtlasReceivable: 1_100_000,
    });
  });

  it("excludes pending, disputed, rejected, and settled entries", () => {
    const statuses = ["pending_trigger", "disputed", "rejected", "settled"] as const;
    const entries = statuses.map((status, index) => ({
      id: String(index),
      debtor: "big_link" as const,
      creditor: "atlas" as const,
      amount: cents(100_000),
      status,
    }));

    expect(calculateBilateralBalance(entries).netAtlasReceivable).toBe(0);
  });
});
