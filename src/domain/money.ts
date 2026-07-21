const ZAR_FORMATTER = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type Cents = number & { readonly __brand: "Cents" };
export type BasisPoints = number & { readonly __brand: "BasisPoints" };

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money must be represented as a safe integer number of cents.");
  }

  return value as Cents;
}

export function basisPoints(value: number): BasisPoints {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error("Basis points must be a whole number between 0 and 10,000.");
  }

  return value as BasisPoints;
}

export function addCents(...values: Cents[]): Cents {
  return cents(values.reduce((total, value) => total + value, 0));
}

export function subtractCents(left: Cents, right: Cents): Cents {
  return cents(left - right);
}

export function absoluteCents(value: Cents): Cents {
  return cents(Math.abs(value));
}

export function percentageOf(amount: Cents, rate: BasisPoints): Cents {
  if (amount < 0) {
    throw new Error("Percentage calculations require a non-negative amount.");
  }

  return cents(Math.round((amount * rate) / 10_000));
}

export function proportionalAmount(
  totalAmount: Cents,
  paidAmount: Cents,
  sourceTotal: Cents,
): Cents {
  if (totalAmount < 0 || paidAmount < 0 || sourceTotal <= 0) {
    throw new Error("Proportional calculations require positive source totals and non-negative amounts.");
  }

  const cappedPaidAmount = Math.min(paidAmount, sourceTotal);
  return cents(Math.round((totalAmount * cappedPaidAmount) / sourceTotal));
}

export function formatZar(value: Cents): string {
  return ZAR_FORMATTER.format(value / 100).replace("ZAR", "R").replace(/\u00a0/g, " ");
}
