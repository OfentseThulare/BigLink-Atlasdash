"use client";

import { WalletCards } from "lucide-react";
import { formatZar } from "@/domain/money";
import { StatusBadge } from "@/components/status-badge";
import { InlineNoteField } from "@/components/record-detail/inline-note-field";
import {
  decideLedgerSettlementAction,
  openDisputeAction,
  proposeLedgerSettlementAction,
} from "@/lib/portal/actions";
import type { LedgerEntryView } from "@/lib/portal/types";
import { RecordDetailWorkspace } from "@/components/record-detail/record-detail-workspace";

type Props = {
  entries: LedgerEntryView[];
  userCompanyId: string | null;
  live: boolean;
  error?: string;
};

export function LedgerRecordDetails({ entries, userCompanyId, live, error }: Props) {
  return (
    <RecordDetailWorkspace
      records={entries}
      listHeading={
        <>
          <div>
            <p className="eyebrow">All records</p>
            <h2>Shared ledger</h2>
          </div>
          <WalletCards className="size-5 text-ink" aria-hidden="true" />
        </>
      }
      emptyMessage="No ledger entries are available for your account."
      renderPanelTitle={(entry) => entry.reference}
      renderRow={(entry, isSelected) => (
        <>
          <div>
            <span className="reference">{entry.reference}</span>
            <h3>{entry.description}</h3>
            <p>
              {entry.date}, {entry.direction}
            </p>
          </div>
          <div className="record-row-meta">
            <strong>{formatZar(entry.amount)}</strong>
            <StatusBadge tone={entry.tone}>{entry.status}</StatusBadge>
          </div>
        </>
      )}
      renderPanel={(entry, closePanel) => {
        const canPropose =
          live &&
          entry.statusCode === "payable" &&
          userCompanyId !== null &&
          entry.debtorCompanyId === userCompanyId &&
          entry.settlementProposal === null;
        const canDecide =
          live &&
          entry.statusCode === "payable" &&
          userCompanyId !== null &&
          entry.creditorCompanyId === userCompanyId &&
          entry.settlementProposal !== null;
        const canOpenDispute =
          live &&
          entry.statusCode !== "disputed" &&
          userCompanyId !== null &&
          (entry.debtorCompanyId === userCompanyId || entry.creditorCompanyId === userCompanyId);

        return (
          <div className="record-detail-panel-content">
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <div className="detail-metadata">
              <p>
                <span className="detail-label">Direction</span>
                <strong>{entry.direction}</strong>
              </p>
              <p>
                <span className="detail-label">Date</span>
                <strong>{entry.date}</strong>
              </p>
              <p>
                <span className="detail-label">Amount</span>
                <strong>{formatZar(entry.amount)}</strong>
              </p>
              <p>
                <span className="detail-label">Status</span>
                <strong>{entry.status}</strong>
              </p>
              {entry.disputeStatus ? (
                <p>
                  <span className="detail-label">Dispute</span>
                  <strong>{entry.disputeStatus}</strong>
                </p>
              ) : null}
            </div>

            <InlineNoteField
              recordType="ledger_entry"
              recordId={entry.id}
              returnPath="/ledger"
              fieldName="description"
              label="Description"
              value={entry.description}
              disabled={!live}
            />
            <InlineNoteField
              recordType="ledger_entry"
              recordId={entry.id}
              returnPath="/ledger"
              fieldName="reference"
              label="Reference"
              value={entry.reference}
              disabled={!live}
              allowEmpty
            />

            {canPropose ? (
              <form action={proposeLedgerSettlementAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <input type="hidden" name="returnPath" value="/ledger" />
                <label>
                  <span>Paid on</span>
                  <input type="date" className="text-field" name="paidOn" required />
                </label>
                <label>
                  <span>Settlement reference</span>
                  <input className="text-field" name="reference" placeholder="Optional" />
                </label>
                <button className="primary-button full-width" type="submit" disabled={!live}>
                  Propose settlement
                </button>
              </form>
            ) : null}

            {canDecide ? (
              <form action={decideLedgerSettlementAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <input type="hidden" name="returnPath" value="/ledger" />
                <label>
                  <span>Decision comment</span>
                  <textarea className="text-field" name="comment" rows={4} />
                </label>
                <label>
                  <span>Current proposal</span>
                  <input
                    className="text-field"
                    value={`${entry.settlementProposal?.paidOn ?? ""}${
                      entry.settlementProposal?.reference ? `, ${entry.settlementProposal.reference}` : ""
                    }`}
                    readOnly
                    disabled
                  />
                </label>
                <div className="detail-form-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    name="approved"
                    value="true"
                    disabled={!live}
                  >
                    Confirm settlement
                  </button>
                  <button
                    className="secondary-button"
                    type="submit"
                    name="approved"
                    value="false"
                    disabled={!live}
                  >
                    Reject settlement
                  </button>
                </div>
              </form>
            ) : null}

            {canOpenDispute ? (
              <form action={openDisputeAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <label>
                  <span>Open dispute reason</span>
                  <textarea className="text-field" name="reason" rows={4} />
                </label>
                <button className="secondary-button full-width" type="submit" disabled={!live}>
                  Open dispute
                </button>
              </form>
            ) : null}

            <div className="detail-actions">
              <button className="link-button" type="button" onClick={closePanel}>
                Dismiss
              </button>
            </div>
          </div>
        );
      }}
    />
  );
}
