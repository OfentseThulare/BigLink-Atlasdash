import { describe, expect, it } from "vitest";
import {
  calculateReferralCommission,
  calculateVariableCommissionRelease,
} from "../commissions";
import { basisPoints, cents } from "../money";

describe("referral commissions", () => {
  it("calculates 10% of the invoice total including VAT", () => {
    const result = calculateReferralCommission(cents(11_500_000), cents(0));
    expect(result.totalEntitlement).toBe(1_150_000);
    expect(result.payableToDate).toBe(0);
  });

  it("releases commission proportionally on partial payment", () => {
    const result = calculateReferralCommission(cents(11_500_000), cents(5_750_000));
    expect(result.payableToDate).toBe(575_000);
    expect(result.remainingPending).toBe(575_000);
  });

  it("releases only the incremental amount", () => {
    const result = calculateReferralCommission(
      cents(11_500_000),
      cents(8_625_000),
      cents(575_000),
    );
    expect(result.payableToDate).toBe(862_500);
    expect(result.newlyPayable).toBe(287_500);
  });

  it("does not reverse earned commission when cumulative payment later decreases", () => {
    const result = calculateReferralCommission(
      cents(11_500_000),
      cents(2_875_000),
      cents(575_000),
    );
    expect(result.payableToDate).toBe(575_000);
    expect(result.newlyPayable).toBe(0);
  });
});

describe("variable commissions", () => {
  it("releases a fixed commission proportionally", () => {
    const result = calculateVariableCommissionRelease(
      { kind: "fixed", amount: cents(300_000) },
      cents(500_000),
      cents(1_000_000),
    );
    expect(result.payableToDate).toBe(150_000);
  });

  it("releases a percentage commission proportionally", () => {
    const result = calculateVariableCommissionRelease(
      {
        kind: "percentage",
        rate: basisPoints(750),
        calculationBasis: cents(2_000_000),
      },
      cents(500_000),
      cents(2_000_000),
    );
    expect(result.totalEntitlement).toBe(150_000);
    expect(result.payableToDate).toBe(37_500);
  });
});
