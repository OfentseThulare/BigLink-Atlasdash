"use client";

import { Handshake } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { RecordDetailWorkspace } from "@/components/record-detail/record-detail-workspace";
import type { ReferralView } from "@/lib/portal/types";

type Props = {
  referrals: ReferralView[];
  error?: string;
};

export function ReferralsRecordDetails({ referrals, error }: Props) {
  return (
    <RecordDetailWorkspace
      records={referrals}
      listHeading={
        <>
          <div>
            <p className="eyebrow">Client attribution</p>
            <h2>Referral register</h2>
          </div>
          <Handshake className="size-5 text-ink" aria-hidden="true" />
        </>
      }
      emptyMessage="No referrals are currently visible."
      renderPanelTitle={(referral) => referral.client}
      renderRow={(referral) => (
        <>
          <div>
            <span className="reference">{referral.rate}</span>
            <h3>{referral.client}</h3>
            <p>{referral.submittedBy}</p>
          </div>
          <div className="record-row-meta">
            <StatusBadge tone={referral.status === "Approved" ? "credit" : "pending"}>{referral.status}</StatusBadge>
          </div>
        </>
      )}
      renderPanel={(referral) => (
        <div className="record-detail-panel-content">
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <div className="detail-metadata">
            <p>
              <span className="detail-label">Beneficiary company</span>
              <strong>{referral.beneficiaryCompanyId}</strong>
            </p>
            <p>
              <span className="detail-label">Submitted by</span>
              <strong>{referral.submittedBy}</strong>
            </p>
            <p>
              <span className="detail-label">Start date</span>
              <strong>{referral.startsOn}</strong>
            </p>
          </div>
        </div>
      )}
    />
  );
}

