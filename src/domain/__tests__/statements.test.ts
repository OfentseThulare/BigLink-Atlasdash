import { describe, expect, it } from "vitest";
import { type LedgerEntry } from "../ledger";
import { cents } from "../money";
import { calculateStatement } from "../statements";

describe("monthly statements", () => {
  const entries: LedgerEntry[] = [
    {
      id: "service-invoice",
      debtor: "big_link",
      creditor: "atlas",
      amount: cents(2_000_000),
      status: "payable",
    },
    {
      id: "referral-commission",
      debtor: "atlas",
      creditor: "big_link",
      amount: cents(750_000),
      status: "payable",
    },
  ];

  it("offsets obligations and identifies Big Link as payer", () => {
    expect(calculateStatement(entries)).toEqual({
      openingNetAtlasReceivable: 0,
      bigLinkOwesAtlas: 2_000_000,
      atlasOwesBigLink: 750_000,
      closingNetAtlasReceivable: 1_250_000,
      payer: "big_link",
      receiver: "atlas",
      settlementAmount: 1_250_000,
    });
  });

  it("carries a negative opening balance and can reverse payment direction", () => {
    const result = calculateStatement(entries, cents(-1_500_000));
    expect(result.closingNetAtlasReceivable).toBe(-250_000);
    expect(result.payer).toBe("atlas");
    expect(result.receiver).toBe("big_link");
    expect(result.settlementAmount).toBe(250_000);
  });
});
