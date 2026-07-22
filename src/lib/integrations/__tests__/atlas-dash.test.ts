import { describe, expect, it } from "vitest";
import {
  atlasInvoiceWebhookSchema,
  signAtlasPayload,
  verifyAtlasSignature,
} from "@/lib/integrations/atlas-dash";

const basePayload = {
  eventId: "invoice-event-001",
  eventType: "invoice.upsert",
  invoice: {
    sourceId: "atlas-invoice-001",
    invoiceNumber: "AT-001",
    kind: "referral_commission_source",
    billToName: "Example Customer",
    referralId: "30000000-0000-4000-8000-000000000001",
    issueDate: "2026-07-10",
    dueDate: "2026-07-30",
    subtotalCents: 100000,
    vatCents: 15000,
    totalIncludingVatCents: 115000,
    status: "issued",
    items: [
      {
        position: 0,
        description: "Advisory services",
        quantity: 1,
        unitPriceCents: 100000,
        lineTotalCents: 100000,
      },
    ],
  },
};

const paymentPayload = {
  eventId: "payment-event-001",
  eventType: "payment.recorded",
  payment: {
    sourceId: "atlas-invoice-001",
    amountCents: 57500,
    paidOn: "2026-07-15",
    reference: "PAY-1",
  },
};

describe("atlas dash invoice integration", () => {
  it("verifies HMAC signatures with raw or prefixed headers", () => {
    const rawBody = JSON.stringify(basePayload);
    const secret = "a-test-secret-with-enough-length";
    const signature = signAtlasPayload(rawBody, secret);

    expect(verifyAtlasSignature(rawBody, signature, secret)).toBe(true);
    expect(verifyAtlasSignature(rawBody, `sha256=${signature}`, secret)).toBe(true);
    expect(verifyAtlasSignature(`${rawBody} `, signature, secret)).toBe(false);
  });

  it("accepts a valid referral commission source invoice", () => {
    const parsed = atlasInvoiceWebhookSchema.safeParse(basePayload);

    expect(parsed.success).toBe(true);
  });

  it("accepts Atlas contact attribution instead of a portal referral id", () => {
    const parsed = atlasInvoiceWebhookSchema.safeParse({
      ...basePayload,
      invoice: {
        ...basePayload.invoice,
        referralId: null,
        atlasClientSourceId: "atlas-contact-001",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invoice totals that do not match subtotal plus VAT", () => {
    const parsed = atlasInvoiceWebhookSchema.safeParse({
      ...basePayload,
      invoice: {
        ...basePayload.invoice,
        totalIncludingVatCents: 114999,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("requires the matching attribution id for each invoice kind", () => {
    const parsed = atlasInvoiceWebhookSchema.safeParse({
      ...basePayload,
      invoice: {
        ...basePayload.invoice,
        kind: "variable_commission_source",
        referralId: null,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a valid Atlas payment record event", () => {
    const parsed = atlasInvoiceWebhookSchema.safeParse(paymentPayload);

    expect(parsed.success).toBe(true);
  });

  it("accepts payment records that use invoiceSourceId", () => {
    const parsed = atlasInvoiceWebhookSchema.safeParse({
      ...paymentPayload,
      payment: {
        ...paymentPayload.payment,
        sourceId: undefined,
        invoiceSourceId: "atlas-invoice-001",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("requires a valid paid payment amount", () => {
    const parsed = atlasInvoiceWebhookSchema.safeParse({
      ...paymentPayload,
      payment: {
        ...paymentPayload.payment,
        amountCents: 0,
      },
    });

    expect(parsed.success).toBe(false);
  });
});
