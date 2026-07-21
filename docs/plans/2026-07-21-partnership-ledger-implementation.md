# Partnership Ledger Implementation Plan

Date: 21/07/2026  
Design: `docs/plans/2026-07-21-partnership-ledger-design.md`

## Delivery Assumptions

1. The portal lives in this standalone repository and uses a dedicated Supabase project.
2. Atlas Dash remains a separate repository and deployment. Its integration is delivered as a narrow companion change after the portal contract is stable.
3. ZAR amounts are stored as integer cents. Dates shown to users use DD/MM/YYYY and business time uses Africa/Johannesburg.
4. Initial production accounts are invited manually after the Supabase project and email domain are configured.
5. Secrets, production URLs, Resend credentials, and Supabase project creation may require owner access. Development must remain functional with local or test configuration before those credentials exist.
6. Big Link brand tokens will be derived from the existing CRM logo and interface before visual implementation begins.
7. No posted ledger row is updated in place. Business corrections are append only entries linked to the original record.

## Phase 1: Application Foundation

### Deliverables

* Scaffold a Next.js 16 application using React 19, TypeScript, Tailwind CSS 4, ESLint, Vitest, and Playwright.
* Add strict environment validation for public Supabase values, server credentials, integration secrets, Resend, and application URLs.
* Add core folders for domain logic, server services, database types, email templates, and interface components.
* Add Big Link assets and establish accessible design tokens.
* Add a minimal authenticated app shell with responsive navigation and loading, empty, error, and offline states.

### Primary files

* `package.json`
* `src/app/layout.tsx`
* `src/app/globals.css`
* `src/app/(portal)/layout.tsx`
* `src/components/app-shell/*`
* `src/lib/env/server.ts`
* `src/lib/env/client.ts`
* `src/lib/supabase/browser.ts`
* `src/lib/supabase/server.ts`
* `src/lib/supabase/admin.ts`
* `vitest.config.ts`
* `playwright.config.ts`
* `.env.example`

### Gate

The application builds, linting and type checks pass, and the responsive shell renders without layout overflow at desktop, tablet, and mobile sizes.

## Phase 2: Financial Domain Engine

### Deliverables

Implement pure typed functions before database workflows:

* integer cent arithmetic;
* bilateral balance calculation;
* 10% referral commission calculation;
* proportional release from partial payments;
* percentage and fixed variable commissions;
* deterministic cent rounding;
* disputed amount exclusion;
* statement netting and payment direction;
* opening and closing balance carry forward;
* no business reversal after customer refund.

### Primary files

* `src/domain/money.ts`
* `src/domain/ledger.ts`
* `src/domain/commissions.ts`
* `src/domain/statements.ts`
* `src/domain/status.ts`
* `src/domain/__tests__/money.test.ts`
* `src/domain/__tests__/commissions.test.ts`
* `src/domain/__tests__/ledger.test.ts`
* `src/domain/__tests__/statements.test.ts`

### Gate

Tests prove every calculation example and edge case in the approved design, including multiple partial payments and uneven cent rounding.

## Phase 3: Database, Security, and Audit Foundation

### Deliverables

Create ordered Supabase migrations for:

* extensions, enums, and common timestamp helpers;
* companies, profiles, memberships, and invitations;
* referrals and bilateral approvals;
* deals and commission agreements;
* source invoices, line items, and customer payments;
* ledger entries and linked adjustments;
* disputes, messages, and resolutions;
* monthly statements, statement items, and settlements;
* documents, notifications, integration events, and audit events;
* database functions for atomic approvals, posting, commission release, statement close, and settlement confirmation;
* triggers that prevent mutation of posted ledger entries and locked statements;
* row level security for every exposed table;
* private storage buckets and object policies;
* seed data for Atlas, Big Link, demonstration administrators, and realistic financial scenarios.

### Primary files

* `supabase/config.toml`
* `supabase/migrations/20260721000100_foundation.sql`
* `supabase/migrations/20260721000200_commercial_records.sql`
* `supabase/migrations/20260721000300_ledger.sql`
* `supabase/migrations/20260721000400_disputes.sql`
* `supabase/migrations/20260721000500_statements.sql`
* `supabase/migrations/20260721000600_notifications_integrations.sql`
* `supabase/migrations/20260721000700_functions.sql`
* `supabase/migrations/20260721000800_rls.sql`
* `supabase/migrations/20260721000900_storage.sql`
* `supabase/seed.sql`
* `supabase/tests/*.sql`
* `src/types/database.ts`

### Gate

Database tests prove company isolation, dual approval, immutable posting, statement locking, document privacy, idempotency, and audit creation. Every public table has enabled row level security and explicit policies.

## Phase 4: Authentication and Administration

### Deliverables

* Big Link branded sign in, password reset, invitation acceptance, and mandatory MFA enrolment and challenge.
* Route guards that reject users without an active membership or required assurance level.
* Named administrator management with invite, suspend, and resend actions.
* Notification preferences and company profile settings.
* Complete session expiry and unauthorised states.

### Primary files

* `src/app/(auth)/*`
* `src/app/auth/callback/route.ts`
* `src/app/(portal)/settings/*`
* `src/components/auth/*`
* `src/lib/auth/guards.ts`
* `src/lib/auth/mfa.ts`
* `src/middleware.ts`

### Gate

Browser tests prove invitation, MFA enrolment, MFA challenge, company membership enforcement, session expiry, and administrator suspension.

## Phase 5: Core Portal Views

### Deliverables

* Overview with live net balance, gross direction totals, pending commission, disputes, current period, and recent activity.
* Ledger table with search, filters, sorting, pagination, exports, and a detailed transaction view.
* Referrals submission, review, approval, rejection, amendment request, and mutually approved termination.
* Invoice list and detail views that distinguish direct bilateral invoices from commission source invoices.
* Full Atlas invoice line items and private PDF access.
* Shared activity timeline using audit records.

### Primary files

* `src/app/(portal)/page.tsx`
* `src/app/(portal)/ledger/*`
* `src/app/(portal)/referrals/*`
* `src/app/(portal)/invoices/*`
* `src/components/dashboard/*`
* `src/components/ledger/*`
* `src/components/referrals/*`
* `src/components/invoices/*`
* `src/server/queries/*`
* `src/server/actions/*`

### Gate

Both company personas see the same authorised financial facts, can perform only their permitted actions, and can trace every displayed total back to source records.

## Phase 6: Deals, Commissions, Payments, and Disputes

### Deliverables

* Partnership deal disclosure with customer, value, close date, owner, and supporting documents.
* Fixed or percentage commission proposal with direction and calculation basis.
* Counterparty approval and rejection workflow.
* Atlas customer payment declaration for synced referral invoices.
* Big Link customer invoice and payment confirmation workflow.
* Proportional release of payable commission through atomic database functions.
* Dispute creation, evidence, discussion, dual approval resolution, and linked adjustment posting.
* Clear separation of pending, payable, disputed, and settled amounts.

### Primary files

* `src/app/(portal)/deals/*`
* `src/app/(portal)/commissions/*`
* `src/app/(portal)/disputes/*`
* `src/components/deals/*`
* `src/components/commissions/*`
* `src/components/disputes/*`
* `src/server/actions/deals.ts`
* `src/server/actions/commissions.ts`
* `src/server/actions/payments.ts`
* `src/server/actions/disputes.ts`

### Gate

Tests prove both approved commission flows, proportional release, dispute exclusion, correction entries, and audit coverage.

## Phase 7: Monthly Close, Statements, and Settlement

### Deliverables

* Month close readiness view with included, pending, disputed, and excluded items.
* Deterministic statement preview with gross obligations and automatic offset.
* Configurable settlement due date.
* Atlas and Big Link approval controls with optimistic concurrency protection.
* Atomic statement lock and carry forward.
* Branded PDF statement and CSV export.
* Payer payment submission with proof upload.
* Receiver receipt confirmation.
* Overdue and completed settlement states.

### Primary files

* `src/app/(portal)/statements/*`
* `src/components/statements/*`
* `src/domain/statement-document.ts`
* `src/app/api/statements/[id]/pdf/route.ts`
* `src/app/api/statements/[id]/csv/route.ts`
* `src/server/actions/statements.ts`
* `src/server/actions/settlements.ts`

### Gate

The generated PDF and CSV reconcile exactly to the locked database statement. A locked period cannot be changed, and the next period opens with the correct balance.

## Phase 8: Atlas Dash Integration

### Portal deliverables

* Versioned invoice event schema.
* HMAC signature verification with timestamp tolerance and replay protection.
* Idempotent create and update processing.
* Source invoice classification for direct Big Link billing and referred client billing.
* Integration event log, health status, error details, and manual retry controls.

### Atlas Dash deliverables

* Add Big Link attribution fields to the invoice data model.
* Add polished attribution controls to both live invoice editor forks.
* Keep shared generated database types aligned.
* Emit signed events after qualifying invoice persistence.
* Store delivery state and retry safely without blocking normal invoice use.
* Backfill selected current unpaid invoices through an explicit administrative action.

### Portal files

* `src/contracts/atlas-dash-invoice.ts`
* `src/app/api/integrations/atlas-dash/invoices/route.ts`
* `src/server/integrations/signatures.ts`
* `src/server/integrations/invoice-events.ts`
* `src/app/(portal)/settings/integrations/*`

### Atlas Dash files to inspect before editing

* `apps/dash/src/app/employee/invoices/[id]/PageClient.tsx`
* `apps/inbound/src/app/invoices/[id]/PageClient.tsx`
* the corresponding `employee-invoices.ts` and `crm.ts` query modules;
* both `InvoicePDF.tsx` files if attribution must appear on documents;
* `packages/types/src/database.ts`;
* Supabase invoice migrations and row level security policies.

### Gate

Contract tests prove valid, invalid, duplicate, expired, replayed, retried, and updated events. A real local Atlas Dash event creates exactly one correctly classified portal invoice.

## Phase 9: Notifications, Imports, and Operational Tools

### Deliverables

* In portal notification centre.
* Resend email templates for every approved event.
* Delivery log and retry behaviour.
* Opening balance creation with mutual approval.
* Current unpaid item import with validation and preview.
* Active referral import.
* Audit viewer and integration operations view.
* Administrator runbook for invitations, month close, disputes, failed sync, and settlement correction.

### Primary files

* `src/app/(portal)/notifications/*`
* `src/app/(portal)/settings/imports/*`
* `src/app/(portal)/audit/*`
* `src/emails/*`
* `src/server/notifications/*`
* `src/server/imports/*`
* `docs/operations/runbook.md`

### Gate

Every agreed event creates an in portal notification and a traceable email delivery attempt. Imports are previewed, validated, idempotent, and auditable.

## Phase 10: Complete Verification and Release

### Automated verification

Run:

* formatting and lint checks;
* TypeScript checks;
* domain and component tests;
* Supabase database tests;
* integration contract tests;
* Playwright tests for Atlas and Big Link personas;
* production build.

### Complete browser story

Verify:

1. Big Link submits a referral.
2. Atlas approves it.
3. Atlas Dash synchronises a qualifying invoice.
4. Atlas records partial customer payment.
5. The correct 10% commission becomes payable.
6. Big Link discloses a partnership deal and customer invoice.
7. Both parties approve variable commission terms.
8. Customer payment releases commission proportionally.
9. A disputed item leaves the payable balance and later resolves through an adjustment.
10. Month close offsets both directions and produces the correct net payment.
11. Atlas and Big Link approve the statement.
12. The payer uploads proof and the receiver confirms receipt.
13. The statement remains immutable and the next period opens correctly.

### Visual verification

Capture and inspect desktop, tablet, and mobile screenshots for every primary page and controlled state. Check overflow, focus states, contrast, status clarity, table behaviour, dialogs, currency formatting, date formatting, document previews, and empty and error states.

### Security verification

Confirm:

* every exposed table has active row level security;
* no service role credential reaches the browser;
* private documents cannot be fetched without authorisation;
* one company cannot approve as the other;
* MFA is required for portal access;
* signatures are compared safely and replayed events are rejected;
* posted financial records and locked statements cannot be mutated;
* audit records exist for all controlled actions.

### Release outputs

* production portal deployment;
* production database migrations;
* configured email delivery;
* connected Atlas Dash production integration;
* invited named administrators;
* approved opening balance and imported open items;
* operational runbook;
* verification report mapping every design acceptance criterion to evidence.
