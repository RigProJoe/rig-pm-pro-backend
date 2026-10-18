# Rig PM Pro Handoff Log

Status key: open, answered, reviewed, needs Joe, approved, closed.

## H-001: Payment provider comparison

- From: Joe (through Claude)
- To: Payments role (formerly Hino)
- Request: Confirm Paddle's fees and compare with Dodo. Cover merchant-of-record handling, subscriptions, monthly and annual billing, credits applied to next bill, refunds, and transaction exports. Use official pricing pages only.
- Needed by: before Joe's decision
- Status: answered
- Answer: Paddle 5% + $0.50 per checkout transaction; merchant of record; subscriptions yes. Dodo 4% + $0.40 per domestic US card transaction, +1.5% international, +0.5% subscriptions; merchant of record; $1 per refund request. Credits on next bill, monthly/annual billing, and transaction exports are not stated on either pricing page for either provider.
- Sources: paddle.com/pricing; dodopayments.com/pricing (no publication dates shown)
- Review: reviewed. Prices match the pages. Items marked "not stated" remain open and must be confirmed with the provider before choosing.
- Note: Research was done by Claude directly before this log existed. Recorded here for the team record.

## H-002: Hosting, database, and export comparison

- From: Joe (through Claude)
- To: Hosting role
- Request: Compare hosting, database, and data-export options and costs using official pricing pages. Confirm the planned database before recommending it.
- Status: answered
- Answer: Supabase Free $0; Pro from $25/month (8 GB database, daily backups kept 7 days). Render Postgres from about $6/month; web service from about $7/month; workspace Pro $25/month. Vercel Pro $20/month, front-end hosting only. Data export is not confirmed on the Supabase or Render pricing pages.
- Database confirmed: Supabase's official documentation states every project gets a full Postgres database.
- Sources: supabase.com/pricing; supabase.com/docs/guides/database/overview; render.com/pricing; vercel.com/pricing
- Review: reviewed. Prices and database claim match the sources. Data export remains open.
- Note: Research was done by Claude directly before this log existed. Recorded here for the team record.

## H-003: Quality check of H-001 and H-002

- From: Claude (supervisor)
- To: Quality Assurance role
- Request: Check prices, dates, and claims in H-001 and H-002 against their sources. Flag anything unsupported.
- Status: reviewed, with caveat
- Result: No price errors found. Both sets of fee figures and the Supabase PostgreSQL claim match the cited pages. Monthly estimates in the summary were recalculated and are correct.
- Caveat: Quality Assurance and the research were both done by the same process in this session, so this check is not fully independent. A fresh check is recommended before a final decision.
- Open items: credit support, billing options, and transaction exports for both payment providers; data export for hosting; pages show no publication dates, so prices should be re-checked before purchase.

## H-005: Dodo limitations check

- From: Joe (through Claude)
- To: Payments role
- Request: Check Dodo's documentation for credits applied to next bill, refund policy, payouts, and exports.
- Status: answered
- Exports: Yes. CSV or XLSX from Settings > Reports, live mode only. Transactions Report, Adjustments Report, Payout Report, and Ledger Reconciliation Report. Limits: 100,000 rows for CSV and 50,000 for XLSX on most reports (500,000 and 100,000 for the reconciliation report). Exports over the limit are refused until the date range is narrowed. No API or scheduled export is described.
- Credits to next invoice: Not found. Discount codes exist, but the docs don't say whether they apply to renewals. Credit-based billing tracks credit entitlements but doesn't describe applying them to a specific invoice. This is the main open issue, since the referral credit depends on it.
- Refunds: $1 fee per refund. Refund policy and eligibility windows not found.
- Disputes: $30 per dispute, plus smaller fees for certain dispute types.
- Payouts: Free, except a $5 fee on payouts under $1,000. $25 for international SWIFT payouts to non-US businesses. Payout schedule and minimum amount not found.
- Sources: docs.dodopayments.com/features/reports; dodopayments.com/llms-full.txt
- Review: not yet reviewed. Quality Assurance should check that the referral-credit answer is marked "not found," not assumed.

## H-004: Decisions for Joe

- Status: needs Joe
- Payment provider: Dodo has lower published rates on these prices. Confirm credit support, billing options, and export with both before choosing.
- Hosting: Supabase Pro at $25/month covers the database, storage, and backups in one place. Render is cheaper for the database alone but needs separate site hosting.
- Data export: confirm before database-architect builds the tax export.
