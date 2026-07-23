"use client";

import { ReceiptText } from "lucide-react";
import { formatZar } from "@/domain/money";
import { StatusBadge } from "@/components/status-badge";
import { RowAction } from "@/components/record-detail/row-action";
import { RecordDetailWorkspace } from "@/components/record-detail/record-detail-workspace";
import { recordInvoicePaymentAction } from "@/lib/portal/actions";
import type { InvoiceView } from "@/lib/portal/types";

type Props = {
  invoices: InvoiceView[];
  userCompanyId: string | null;
  live: boolean;
  error?: string;
};

const paidStateTone: Record<InvoiceView["paidState"], "credit" | "pending" | "disputed"> = {
  unpaid: "disputed",
  partial: "pending",
  paid: "credit",
};

const invoiceActionHint = "invoice-record-payment";

export function InvoicesRecordDetails({ invoices, userCompanyId, live, error }: Props) {
  return (
    <RecordDetailWorkspace
      records={invoices}
      listHeading={
        <>
          <div>
            <p className="eyebrow">Source records</p>
            <h2>Partnership invoices</h2>
          </div>
          <ReceiptText className="size-5 text-ink" aria-hidden="true" />
        </>
      }
      emptyMessage="No invoice records were loaded yet."
      renderPanelTitle={(invoice) => invoice.number}
      renderRow={(invoice, isSelected, openRecord) => {
        const normalisedStatus = invoice.status.toLowerCase();
        const canRecordPayment =
          live &&
          userCompanyId !== null &&
          invoice.issuerCompanyId === userCompanyId &&
          (normalisedStatus === "issued" || normalisedStatus === "partially paid") &&
          invoice.paidState !== "paid";

        const noActionReason = !live
          ? "Actions are unavailable while disconnected."
          : userCompanyId === null
            ? "Sign in to record payment."
            : invoice.issuerCompanyId !== userCompanyId
              ? "Only the invoice issuer can record payment."
              : invoice.paidState === "paid"
                ? "Paid"
                : "No quick action";

        return (
          <>
            <div>
              <span className="reference">{invoice.number}</span>
              <h3>{invoice.client}</h3>
              <p>
                {invoice.kind}, {invoice.sourceSystem}
              </p>
              <p>{invoice.description}</p>
            </div>
            <div className="record-row-meta">
              <strong>{formatZar(invoice.total)}</strong>
              <span className="subtle">Paid {formatZar(invoice.paid)}</span>
              <StatusBadge tone={paidStateTone[invoice.paidState]}>{invoice.status}</StatusBadge>
              {canRecordPayment ? (
                <RowAction
                  mode="open"
                  label="Record payment"
                  onActivate={() => openRecord(invoice.id, invoiceActionHint)}
                />
              ) : (
                <RowAction reason={noActionReason} />
              )}
            </div>
          </>
        );
      }}
      renderPanel={(invoice, closePanel, rowActionHint) => {
        const normalisedStatus = invoice.status.toLowerCase();
        const canRecordPayment =
          live &&
          userCompanyId !== null &&
          invoice.issuerCompanyId === userCompanyId &&
          (normalisedStatus === "issued" || normalisedStatus === "partially paid") &&
          invoice.paidState !== "paid";
        const isPaid = invoice.paidState === "paid";

        return (
          <div className="record-detail-panel-content">
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <div className="detail-metadata">
              <p>
                <span className="detail-label">Reference</span>
                <strong>{invoice.number}</strong>
              </p>
              <p>
                <span className="detail-label">Due on</span>
                <strong>{invoice.dueDate}</strong>
              </p>
              <p>
                <span className="detail-label">Amount</span>
                <strong>{formatZar(invoice.total)}</strong>
              </p>
              <p>
                <span className="detail-label">Description</span>
                <strong>{invoice.description}</strong>
              </p>
              <p>
                <span className="detail-label">Status</span>
                <strong>{invoice.status}</strong>
              </p>
              <p>
                <span className="detail-label">Issuer company</span>
                <strong>{invoice.issuerCompanyId}</strong>
              </p>
            </div>

            {canRecordPayment ? (
              <form action={recordInvoicePaymentAction} className="action-form">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <label>
                  <span>Amount received</span>
                  <input
                    className="text-field"
                    name="amount"
                    inputMode="decimal"
                    placeholder="575.00"
                    required
                    data-record-action-focus={
                      rowActionHint === invoiceActionHint
                        ? `${invoice.id}:${rowActionHint}`
                        : undefined
                    }
                  />
                </label>
                <label>
                  <span>Paid on</span>
                  <input className="text-field" name="paidOn" type="date" required />
                </label>
                <label>
                  <span>Reference</span>
                  <input className="text-field" name="reference" />
                </label>
                <button className="primary-button full-width" type="submit" disabled={!live}>
                  Record payment
                </button>
              </form>
            ) : null}

            {isPaid ? <p className="detail-success">This invoice is fully paid.</p> : null}
            {!isPaid && !canRecordPayment ? <p className="subtle">Payment cannot be recorded from this account.</p> : null}
          </div>
        );
      }}
    />
  );
}
