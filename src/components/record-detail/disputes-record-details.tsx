"use client";

import { TriangleAlert } from "lucide-react";
import { formatZar } from "@/domain/money";
import { StatusBadge } from "@/components/status-badge";
import { InlineNoteField } from "@/components/record-detail/inline-note-field";
import { RecordDetailWorkspace } from "@/components/record-detail/record-detail-workspace";
import { resolveDisputeAction } from "@/lib/portal/actions";
import type { DisputeView } from "@/lib/portal/types";

type Props = {
  disputes: DisputeView[];
  userCompanyId: string | null;
  live: boolean;
  error?: string;
};

export function DisputesRecordDetails({ disputes, userCompanyId, live, error }: Props) {
  return (
    <RecordDetailWorkspace
      records={disputes}
      emptyMessage="No disputes are currently open."
      listHeading={
        <>
          <div>
            <p className="eyebrow">Review</p>
            <h2>Dispute register</h2>
          </div>
          <TriangleAlert className="size-5 text-ink" aria-hidden="true" />
        </>
      }
      renderPanelTitle={(dispute) => dispute.reference}
      renderRow={(dispute) => (
        <>
          <div>
            <span className="reference">{dispute.reference}</span>
            <h3>{dispute.ledgerEntryDescription}</h3>
            <p>{dispute.openedBy}, {dispute.createdAt}</p>
          </div>
          <div className="record-row-meta">
            <StatusBadge tone="disputed">{dispute.status}</StatusBadge>
          </div>
        </>
      )}
      renderPanel={(dispute) => {
        const normalisedStatus = dispute.status.toLowerCase();
        const isResolved = normalisedStatus.includes("resolved");
        const isPartyToDispute =
          userCompanyId !== null &&
          (dispute.ledgerDebtorCompanyId === userCompanyId || dispute.ledgerCreditorCompanyId === userCompanyId);
        const canResolve = live && !isResolved && isPartyToDispute && userCompanyId !== dispute.openedByCompanyId;

        return (
          <div className="record-detail-panel-content">
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <div className="detail-metadata">
              <p>
                <span className="detail-label">Ledger status</span>
                <strong>{dispute.ledgerEntryStatus}</strong>
              </p>
              <p>
                <span className="detail-label">Entry amount</span>
                <strong>{formatZar(dispute.ledgerAmount)}</strong>
              </p>
              <p>
                <span className="detail-label">Opened by</span>
                <strong>{dispute.openedBy}</strong>
              </p>
            </div>

            <InlineNoteField
              recordType="dispute"
              recordId={dispute.id}
              returnPath="/disputes"
              fieldName="reason"
              label="Dispute reason"
              value={dispute.reason}
              multiline
              rows={5}
              disabled={!live}
            />

            <InlineNoteField
              recordType="dispute"
              recordId={dispute.id}
              returnPath="/disputes"
              fieldName="proposedResolution"
              label="Proposed resolution"
              value={dispute.proposedResolution ?? ""}
              multiline
              rows={4}
              disabled={!live}
              allowEmpty
            />

            {canResolve ? (
              <form action={resolveDisputeAction} className="action-form">
                <input type="hidden" name="disputeId" value={dispute.id} />
                <input type="hidden" name="returnPath" value="/disputes" />
                <label>
                  <span>Resolution choice</span>
                  <select className="text-field" name="outcome" defaultValue="restore_payable">
                    <option value="restore_payable">Restore payable</option>
                    <option value="close_with_adjustment">Close with adjustment</option>
                  </select>
                </label>
                <label>
                  <span>Resolution comment</span>
                  <textarea className="text-field" name="comment" rows={4} />
                </label>
                <button className="primary-button full-width" type="submit" disabled={!live}>
                  Resolve dispute
                </button>
              </form>
            ) : null}

            {!isResolved && !canResolve ? (
              <p className="subtle" aria-live="polite">
                This dispute can only be resolved by the other company with permission.
              </p>
            ) : null}
            {isResolved ? <p className="detail-success">This dispute has already been resolved.</p> : null}
          </div>
        );
      }}
    />
  );
}
