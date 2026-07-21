import { describe, expect, it } from "vitest";
import {
  basisPoints,
  cents,
  formatZar,
  percentageOf,
  proportionalAmount,
} from "../money";

describe("money", () => {
  it("rejects fractional cent values", () => {
    expect(() => cents(10.5)).toThrow(/safe integer/);
  });

  it("calculates percentages using whole cents", () => {
    expect(percentageOf(cents(11_500_000), basisPoints(1_000))).toBe(1_150_000);
    expect(percentageOf(cents(10_001), basisPoints(1_000))).toBe(1_000);
  });

  it("caps proportional release at the source total", () => {
    expect(proportionalAmount(cents(10_000), cents(120_000), cents(100_000))).toBe(10_000);
  });

  it("formats South African rand", () => {
    expect(formatZar(cents(1_150_000))).toBe("R 11 500,00".replace(/\u00a0/g, " "));
  });
});
