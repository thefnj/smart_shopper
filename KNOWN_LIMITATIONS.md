# Known limitations (end of Phase 1)

Things that are deliberately not there yet, and things to be aware of.

## Not built yet (planned phases)
- Basket voucher allocation across lines, effective unit prices and the Dunnes efficiency score (Phase 2). Until then `effective_line_price` equals the net line price and `allocated_basket_discount` is always 0.
- The Compare screen, price history charts and dashboard recommendations (Phases 2 and 5). The Home screen says so rather than showing invented numbers.
- CSV import and export, and the Google Sheets migration (Phase 3). The field-mapping plan is in `docs/spreadsheet-import-plan.md`.
- Receipt photo upload and AI extraction (Phase 4). The `receipts` storage bucket and its access policy already exist in the migration.
- Settings screen (Phase 5). Household name, freshness period and locale live in the `households` table and can be edited in the Supabase dashboard for now.
- Retailer management screen. The five Irish retailers are seeded; add more with a SQL insert until the screen exists.

## Behaviour to be aware of
- Reconciliation in Phase 1 is `sum of line totals − item discounts − basket vouchers + deposits` versus `total paid`. It flags differences and blocks approval without a note. It does not yet allocate the voucher to lines.
- A manually entered line stores what you typed as both `raw_description` and `description`. Editing the description later keeps the original and records the change in `corrections`.
- Alias suggestions only appear for an unmapped line whose description matches a previously confirmed mapping exactly (case and whitespace insensitive). Fuzzy matching is not attempted.
- Duplicate detection compares retailer + date + total paid, or the reference number. It warns via a review flag and a note; it never blocks or deletes.
- Deleting a line is only possible while the receipt is a draft. After that, exclude it instead. Receipts and products are archived, never hard-deleted, from the UI.
- Magic-link sign-in relies on Supabase's built-in email sender, which is rate-limited to a handful of emails per hour on the free tier. Fine for a household; configure custom SMTP in Supabase if it becomes a problem.
- `src/lib/db/types.ts` is hand-written to mirror the migration. Once you have a Supabase project, `npx supabase gen types typescript` produces the authoritative version.

## Testing gaps
- Responsive checks were done by rendering the real page components with a stubbed database at 390 px and 1280 px (see `npm run test:visual`). There is no end-to-end browser test against a live Supabase yet.
- The Postgres schema tests use small stand-ins for Supabase's `auth` and `storage` schemas (`supabase/test/local_stubs.sql`). They prove RLS isolation, immutability triggers, the audit trail and the signup bootstrap, but not Supabase's own auth or storage behaviour.
