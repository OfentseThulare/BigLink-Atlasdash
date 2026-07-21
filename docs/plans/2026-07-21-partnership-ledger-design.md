# Big Link and Atlas Partnership Ledger

Date: 21/07/2026  
Status: Approved design  
Owners: Atlas Consulting Group and Big Link Consulting

## Purpose

Build a private, Big Link branded financial reconciliation portal for the partnership between Atlas Consulting Group and Big Link Consulting.

The portal gives both companies one agreed view of partnership related invoices, closed deals, commissions, credits, adjustments, disputes, monthly statements, and settlements. It preserves the gross obligations in each direction while calculating one live net position, so amounts owed can be offset transparently.

The portal is limited to this bilateral partnership. It is not a general accounting product, a replacement for Atlas Dash, or an extension of the existing Big Link CRM tenant model.

## Approved Commercial Rules

### Shared ledger

Every financial event records:

* the company that owes the amount;
* the company that is owed;
* the amount in ZAR;
* the source and commercial reason;
* its lifecycle state;
* its approvals and audit history.

The live balance is calculated as:

`Big Link obligations to Atlas minus Atlas obligations to Big Link`

A positive result means Big Link owes Atlas. A negative result means Atlas owes Big Link.

### Big Link referral commission

1. Big Link submits a referred client.
2. Atlas must approve the referral before it becomes commission eligible.
3. Once approved, the referral applies to all future Atlas invoices for that client unless both parties formally end the attribution.
4. Big Link earns 10% of each qualifying Atlas invoice total, including VAT.
5. The calculated 10% is the final commission amount. VAT is not added on top.
6. The commission is pending when the invoice is issued.
7. Commission becomes payable only when Atlas records customer payment in the portal.
8. Partial customer payments release commission proportionally.
9. Atlas is not required to attach evidence when declaring customer payment.
10. Once commission has become payable, a later customer refund or credit note does not reverse it.

Example:

* Atlas invoice total including VAT: R115,000.00
* Big Link total commission entitlement: R11,500.00
* Customer pays R57,500.00
* Big Link payable commission released: R5,750.00
* Remaining commission stays pending until further payment is recorded

### Atlas services supplied to Big Link

Atlas Dash remains the source of truth for invoices issued by Atlas. An invoice billed to Big Link creates an obligation from Big Link to Atlas for the invoice balance. Payments, credits, approved adjustments, and settlement offsets reduce that obligation.

### Variable partnership commissions

Some partnership deals create a commission obligation from Big Link to Atlas. Terms vary by deal.

1. Either company may propose a commission agreement.
2. The proposal records the direction, fixed amount or percentage, calculation basis, deal details, and supporting terms.
3. An authorised administrator from the counterparty must approve it.
4. The underlying customer invoice and payment confirmation are required.
5. Commission becomes payable as customer payment is received.
6. Partial customer payments release commission proportionally.

The data model permits either direction for a negotiated commission, while the launch workflow is primarily for Big Link obligations to Atlas.

### Scope of disclosure

Only partnership related deals and financial records are disclosed. The portal does not expose the full sales registers of either company.

Big Link can see the full Atlas invoice for an approved referred client, including client name, invoice number, dates, line items, VAT, total, payment entries, and PDF.

### Disputes

Either party may dispute a synced invoice, payment, commission, credit, or adjustment.

* The original record remains unchanged.
* The disputed amount is excluded from the payable balance and monthly settlement.
* Both parties can add discussion, evidence, and proposed resolutions.
* Resolution requires approval by both companies.
* Any correction is posted as a linked adjustment, preserving the original event.

## Architecture

### Portal

Create a new standalone application and repository named `Big-link-Partnership-Portal`.

Recommended stack:

* Next.js 16;
* React 19;
* TypeScript;
* Tailwind CSS 4;
* Supabase PostgreSQL, Auth, MFA, and private Storage;
* server routes for integration, statement generation, and notifications;
* Resend for transactional email;
* Vitest for domain and component tests;
* Playwright for browser verification.

The portal uses a dedicated Supabase project. It does not share the Big Link CRM database, authentication, referral tables, or tenant model.

### Atlas Dash integration

Atlas Dash remains authoritative for Atlas invoices. Its invoicing workflow will gain Big Link attribution for:

* an invoice issued directly to Big Link for Atlas services;
* an invoice issued to an approved Big Link referred client.

When a qualifying invoice is issued or updated, Atlas Dash sends a signed event to the portal. Each event contains a unique event identifier and stable Atlas Dash source identifiers.

The integration must provide:

* timestamped request signatures;
* secret rotation support;
* replay protection;
* idempotent event processing;
* safe retries;
* integration health and failure visibility;
* manual retry and reconciliation tools.

Synced invoices are read only in the portal. Source corrections are made in Atlas Dash and synchronised again.

## Core Records

The database will include:

* `companies` for the fixed Atlas and Big Link parties;
* `profiles` and `company_memberships` for named administrators;
* `referrals` and `referral_approvals`;
* `deals` and `commission_agreements`;
* `source_invoices` and `source_invoice_items`;
* `invoice_payments`;
* `ledger_entries` and linked `ledger_adjustments`;
* `disputes`, `dispute_messages`, and `dispute_resolutions`;
* `monthly_statements` and `statement_items`;
* `settlements` and payment confirmations;
* `documents`;
* `notifications`;
* `integration_events`;
* immutable `audit_events`.

Money is stored as integer cents. Every transaction is in ZAR at launch. Commission entries store the calculation inputs and resulting amount used when posted, so historical balances do not change when future rules change.

## Record Lifecycles

The general financial lifecycle is:

`Draft -> Awaiting approval -> Pending trigger -> Payable -> Included in statement -> Settled`

A record can also enter `Disputed`, `Rejected`, `Voided by adjustment`, or `Carried forward` where the relevant workflow permits it.

Posted financial records cannot be deleted or silently edited. Corrections create linked entries with a full reason and audit trail.

## Portal Experience

The application opens on the working dashboard. It does not use a marketing landing page.

### Overview

Show:

* the live net balance and payment direction;
* gross Atlas obligations to Big Link;
* gross Big Link obligations to Atlas;
* pending commissions;
* open disputes;
* the current statement period;
* unsettled statements;
* recent financial and approval activity.

### Ledger

Provide a dense, searchable table with filters for company direction, transaction type, client, source, status, statement period, and due date. Each row opens a full record view with source documents, calculation details, approvals, linked entries, and audit history.

### Referrals

Big Link submits a client with identifying and relationship details. Atlas approves, rejects, or requests changes. Approved referrals link to all future qualifying Atlas invoices. Ending an attribution requires mutual approval and affects future invoices only.

### Deals and commissions

Either party records a partnership deal and proposes variable commission terms. The counterparty approves or rejects the proposal. Customer invoices and payment confirmations support proportional commission release.

### Invoices

Show full synced Atlas invoices and Big Link disclosed customer invoices. Clearly distinguish invoices that create a direct bilateral obligation from invoices that are only a commission source.

### Disputes

Provide an exception queue with the disputed amount, reason, evidence, discussion, proposed resolution, and approval state. Disputed amounts do not contribute to the payable balance.

### Monthly close

At month end the portal:

1. gathers all undisputed payable items not previously settled;
2. shows gross obligations in both directions;
3. offsets the obligations and calculates one net settlement;
4. carries pending and disputed items forward visibly;
5. lets either party propose a configurable payment due date;
6. requires one authorised approval from Atlas and one from Big Link;
7. locks the statement;
8. generates a PDF statement and CSV export;
9. lets the payer submit payment date, amount, reference, and proof;
10. lets the receiver confirm receipt;
11. carries the closing balance into the next period.

Locked statements never change. Late transactions and corrections enter the next open period as linked adjustments.

### Audit and settings

Show the immutable activity history, named administrators, MFA state, notification preferences, document settings, and Atlas Dash integration health.

## Permissions and Approvals

Launch access is limited to invited administrators:

* Atlas administrators, initially Ofentse Thulare and Chirag Joshi;
* Big Link administrators, initially Byron Pinheiro and any specifically invited Big Link leader.

Each user belongs to one company. A user cannot approve on behalf of the counterparty.

Mutual approval is required for:

* referral attribution and termination;
* variable commission terms;
* manual credits and adjustments;
* dispute resolutions;
* monthly statements.

Synced Atlas invoices and Atlas customer payment declarations do not require counterparty approval, but they can be disputed.

Database row level security enforces company membership, visibility, and approval boundaries. MFA is mandatory for every administrator.

## Documents and Notifications

Documents are private and accessed through short lived signed links. Supported records include source invoice PDFs, customer invoices, deal terms, dispute evidence, monthly statements, and settlement proof.

Email and in portal notifications cover:

* new approval requests;
* approvals and rejections;
* disputes and dispute responses;
* approaching due dates;
* monthly close readiness;
* statement proposals and approvals;
* settlement payment submissions;
* receipt confirmations;
* integration failures that require attention.

Email is a notification channel, not the financial source of truth.

## Security and Reliability

The implementation must provide:

* mandatory MFA;
* private file storage;
* database enforced company and approval boundaries;
* immutable audit events;
* append only correction patterns for posted financial data;
* version checks for concurrent edits and approvals;
* idempotent financial posting;
* atomic database transactions for calculations and status changes;
* safe integration retries;
* explicit user facing failure states;
* no partial statement or ledger posting;
* monitoring for failed synchronisation and notification delivery.

The audit trail records the actor, company, timestamp, action, affected record, and before and after values where applicable.

## Branding and Interface Quality

Use the existing Big Link logo and recognised brand colours, refined into a focused financial workspace.

The design should be quiet, professional, and optimised for repeated financial review. It should favour clear tables, legible figures, restrained summary cards, familiar icons, visible status, and direct access to supporting evidence. Desktop is primary, with complete tablet and mobile support.

The portal must not use oversized marketing sections, decorative card grids, nested cards, unstyled native financial forms, or ambiguous colour only status indicators.

## Historical Opening

Launch migration consists of:

* one mutually approved opening balance;
* current unpaid Atlas invoices owed by Big Link;
* current unpaid commissions owed by either party;
* current open disputes;
* approved active Big Link referred clients.

The portal will not reconstruct the full historical partnership ledger at launch.

## Verification

### Domain tests

Test:

* 10% commission on invoice total including VAT;
* proportional release across multiple partial payments;
* no business reversal after a later refund or credit note;
* fixed and percentage variable commissions;
* gross obligations and net balance calculation;
* disputed amount exclusion;
* opening and closing balance carry forward;
* statement offsets and settlement direction;
* integer cent rounding behaviour.

### Database and security tests

Test:

* company visibility and mutation boundaries;
* mandatory counterparty approval;
* prevention of self approval as the other company;
* immutable posted entries and locked statements;
* MFA access restrictions;
* document access control;
* idempotent event processing and ledger posting;
* concurrent approval protection;
* audit event creation for every controlled action.

### Integration tests

Test:

* valid and invalid Atlas Dash signatures;
* expired timestamps and replayed events;
* duplicate delivery;
* invoice creation and update events;
* retry behaviour;
* source correction handling;
* integration failure visibility.

### Browser tests

Verify the complete flow:

1. Big Link submits a referral.
2. Atlas approves it.
3. Atlas Dash synchronises a qualifying invoice.
4. Atlas records partial customer payment.
5. The correct commission becomes payable.
6. Big Link discloses a partnership deal.
7. Atlas proposes or approves variable commission terms.
8. The underlying invoice and customer payment are recorded.
9. A dispute is opened and resolved.
10. The monthly statement offsets obligations.
11. Both companies approve the statement.
12. The payer submits settlement proof.
13. The receiver confirms receipt.
14. The next period opens with the correct balance.

Run visual checks on desktop, tablet, and mobile. Verify that financial values, tables, dialogs, navigation, and document views do not overlap or resize unexpectedly.

## Acceptance Criteria

The product is complete when:

1. Both companies can authenticate with mandatory MFA and see the same authorised partnership ledger.
2. Atlas Dash can synchronise attributed invoices without duplicates.
3. Approved referral invoices calculate Big Link commission exactly as specified.
4. Partial customer payments release commission proportionally.
5. Variable commissions require counterparty approval and supporting financial records.
6. Direct Atlas invoices to Big Link create the correct opposite obligation.
7. Credits, adjustments, disputes, and corrections remain fully traceable.
8. The dashboard shows gross obligations and the correct live net position.
9. Monthly close produces a mutually approved, immutable PDF statement and CSV.
10. Settlement submission and receipt confirmation close the statement correctly.
11. Email and in portal alerts cover every agreed event.
12. Company boundaries, approval rules, private documents, and audit history are enforced at database level.
13. The opening balance and current unpaid items can be imported and approved.
14. Automated tests and browser verification prove the complete workflow.
15. The finished interface consistently reflects the refined Big Link brand across desktop, tablet, and mobile.

## Explicit Non Goals

The first release does not include:

* other Atlas referral partners;
* other Big Link commercial partners;
* currencies other than ZAR;
* automatic bank feed reconciliation;
* migration of the full partnership history;
* direct editing of synced Atlas invoices;
* replacing Atlas Dash invoicing;
* replacing either company’s statutory accounting system.
