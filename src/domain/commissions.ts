import {
  basisPoints,
  cents,
  percentageOf,
  proportionalAmount,
  subtractCents,
  type BasisPoints,
  type Cents,
} from "./money";

export const BIG_LINK_REFERRAL_RATE = basisPoints(1_000);

export interface CommissionRelease {
  totalEntitlement: Cents;
  payableToDate: Cents;
  newlyPayable: Cents;
  remainingPending: Cents;
}

export function calculateReferralCommission(
  invoiceTotalIncludingVat: Cents,
  cumulativeCustomerPayments: Cents,
  alreadyReleased: Cents = cents(0),
): CommissionRelease {
  if (invoiceTotalIncludingVat <= 0) {
    throw new Error("A referral invoice total must be greater than zero.");
  }

  const totalEntitlement = percentageOf(invoiceTotalIncludingVat, BIG_LINK_REFERRAL_RATE);
  const calculatedPayable = proportionalAmount(
    totalEntitlement,
    cumulativeCustomerPayments,
    invoiceTotalIncludingVat,
  );
  const payableToDate = cents(Math.max(calculatedPayable, alreadyReleased));
  const newlyPayable = cents(Math.max(0, payableToDate - alreadyReleased));

  return {
    totalEntitlement,
    payableToDate,
    newlyPayable,
    remainingPending: subtractCents(totalEntitlement, payableToDate),
  };
}

export type VariableCommissionTerms =
  | { kind: "fixed"; amount: Cents }
  | { kind: "percentage"; rate: BasisPoints; calculationBasis: Cents };

export function calculateVariableCommissionEntitlement(
  terms: VariableCommissionTerms,
): Cents {
  return terms.kind === "fixed"
    ? terms.amount
    : percentageOf(terms.calculationBasis, terms.rate);
}

export function calculateVariableCommissionRelease(
  terms: VariableCommissionTerms,
  cumulativeCustomerPayments: Cents,
  customerInvoiceTotal: Cents,
  alreadyReleased: Cents = cents(0),
): CommissionRelease {
  if (customerInvoiceTotal <= 0) {
    throw new Error("A customer invoice total must be greater than zero.");
  }

  const totalEntitlement = calculateVariableCommissionEntitlement(terms);
  const calculatedPayable = proportionalAmount(
    totalEntitlement,
    cumulativeCustomerPayments,
    customerInvoiceTotal,
  );
  const payableToDate = cents(Math.max(calculatedPayable, alreadyReleased));

  return {
    totalEntitlement,
    payableToDate,
    newlyPayable: cents(Math.max(0, payableToDate - alreadyReleased)),
    remainingPending: subtractCents(totalEntitlement, payableToDate),
  };
}
