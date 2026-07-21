import { NextResponse } from "next/server";
import {
  atlasInvoiceWebhookSchema,
  sha256Hex,
  verifyAtlasSignature,
} from "@/lib/integrations/atlas-dash";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const ATLAS_COMPANY_ID = "00000000-0000-4000-8000-000000000001";

export async function POST(request: Request) {
  const secret = process.env.ATLAS_DASH_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-atlas-signature");

  if (!verifyAtlasSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let json: unknown;

  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = atlasInvoiceWebhookSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = createSupabaseServiceClient();
  const payloadSha = sha256Hex(rawBody);

  const { error: eventError } = await supabase.from("integration_events").insert({
    integration: "atlas_dash",
    event_id: payload.eventId,
    event_type: payload.eventType,
    source_record_id: payload.invoice.sourceId,
    payload_sha256: payloadSha,
    status: "processing",
  });

  if (eventError) {
    if (eventError.code === "23505") {
      return NextResponse.json({ ok: true, status: "duplicate" });
    }

    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  try {
    const { invoice } = payload;
    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("source_invoices")
      .upsert({
        source_system: "atlas_dash",
        source_id: invoice.sourceId,
        invoice_number: invoice.invoiceNumber,
        kind: invoice.kind,
        issuer_company_id: ATLAS_COMPANY_ID,
        bill_to_company_id: invoice.billToCompanyId ?? null,
        bill_to_name: invoice.billToName,
        referral_id: invoice.referralId ?? null,
        deal_id: invoice.dealId ?? null,
        issue_date: invoice.issueDate,
        due_date: invoice.dueDate ?? null,
        subtotal_cents: invoice.subtotalCents,
        vat_cents: invoice.vatCents,
        total_including_vat_cents: invoice.totalIncludingVatCents,
        status: invoice.status,
        source_updated_at: invoice.sourceUpdatedAt ?? null,
        synced_at: new Date().toISOString(),
        raw_source: payload,
      }, {
        onConflict: "source_system,source_id",
      })
      .select("id")
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    const { error: deleteError } = await supabase
      .from("source_invoice_items")
      .delete()
      .eq("invoice_id", invoiceRow.id);

    if (deleteError) {
      throw deleteError;
    }

    if (invoice.items.length > 0) {
      const { error: itemsError } = await supabase.from("source_invoice_items").insert(
        invoice.items.map((item) => ({
          invoice_id: invoiceRow.id,
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          line_total_cents: item.lineTotalCents,
        })),
      );

      if (itemsError) {
        throw itemsError;
      }
    }

    await supabase
      .from("integration_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("integration", "atlas_dash")
      .eq("event_id", payload.eventId);

    return NextResponse.json({ ok: true, invoiceId: invoiceRow.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown integration error.";

    await supabase
      .from("integration_events")
      .update({
        status: "failed",
        last_error: message,
        attempts: 1,
      })
      .eq("integration", "atlas_dash")
      .eq("event_id", payload.eventId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
