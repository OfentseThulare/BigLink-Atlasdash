import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const invoiceItemSchema = z.object({
  position: z.number().int().min(0),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().min(0),
  lineTotalCents: z.number().int().min(0),
});

const invoiceSchema = z.object({
  sourceId: z.string().min(1).max(160),
  invoiceNumber: z.string().min(1).max(80),
  kind: z.enum([
    "direct_service_obligation",
    "referral_commission_source",
    "variable_commission_source",
  ]),
  billToCompanyId: z.string().uuid().nullable().optional(),
  billToName: z.string().min(2).max(160),
  referralId: z.string().uuid().nullable().optional(),
  atlasClientSourceId: z.string().min(1).max(160).nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),
  issueDate: z.string().date(),
  dueDate: z.string().date().nullable().optional(),
  subtotalCents: z.number().int().min(0),
  vatCents: z.number().int().min(0),
  totalIncludingVatCents: z.number().int().positive(),
  status: z.enum(["draft", "issued", "partially_paid", "paid", "credited", "void"]),
  sourceUpdatedAt: z.string().datetime().nullable().optional(),
  items: z.array(invoiceItemSchema).default([]),
});

const paymentSchema = z.object({
  sourceId: z.string().min(1).max(160).optional(),
  invoiceSourceId: z.string().min(1).max(160).optional(),
  amountCents: z.number().int().positive(),
  paidOn: z.string().date(),
  reference: z.string().max(120).nullable().optional(),
}).superRefine((payment, context) => {
  if (!payment.sourceId && !payment.invoiceSourceId) {
    context.addIssue({
      code: "custom",
      path: ["payment", "sourceId"],
      message: "Payment events require sourceId or invoiceSourceId.",
    });
  }
});

export const atlasInvoiceWebhookSchema = z.discriminatedUnion("eventType", [
  z.object({
    eventId: z.string().min(8).max(180),
    eventType: z.literal("invoice.upsert"),
    invoice: invoiceSchema,
  }).superRefine((payload, context) => {
    const { invoice } = payload;

    if (invoice.totalIncludingVatCents !== invoice.subtotalCents + invoice.vatCents) {
      context.addIssue({
        code: "custom",
        path: ["invoice", "totalIncludingVatCents"],
        message: "Invoice total must equal subtotal plus VAT.",
      });
    }

    if (invoice.kind === "direct_service_obligation" && !invoice.billToCompanyId) {
      context.addIssue({
        code: "custom",
        path: ["invoice", "billToCompanyId"],
        message: "Direct service invoices require billToCompanyId.",
      });
    }

    if (invoice.kind === "referral_commission_source" && !invoice.referralId && !invoice.atlasClientSourceId) {
      context.addIssue({
        code: "custom",
        path: ["invoice", "referralId"],
        message: "Referral commission invoices require referralId or atlasClientSourceId.",
      });
    }

    if (invoice.kind === "variable_commission_source" && !invoice.dealId) {
      context.addIssue({
        code: "custom",
        path: ["invoice", "dealId"],
        message: "Variable commission invoices require dealId.",
      });
    }
  }),
  z.object({
    eventId: z.string().min(8).max(180),
    eventType: z.literal("payment.recorded"),
    payment: paymentSchema,
  }),
]);

export type AtlasInvoiceWebhookPayload = z.infer<typeof atlasInvoiceWebhookSchema>;

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function signAtlasPayload(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyAtlasSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader || !secret) {
    return false;
  }

  const expected = signAtlasPayload(rawBody, secret);
  const received = signatureHeader.replace(/^sha256=/, "").trim();

  if (!/^[a-f0-9]{64}$/i.test(received)) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  return expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
}
