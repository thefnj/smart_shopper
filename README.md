# Smart Shopper

A private, installable web app for tracking grocery prices from receipts, normalising products across pack sizes, and comparing real value between Irish shops, including Dunnes basket vouchers.

Status: **Phase 1 complete** (foundation: database, security, auth, navigation, manual receipt and product entry). See `KNOWN_LIMITATIONS.md` for what is not built yet.

## What you need

- A free [Supabase](https://supabase.com) account (database, login, image storage)
- A free [Vercel](https://vercel.com) account (hosting), connected to a GitHub account
- [Node.js](https://nodejs.org) 22 or newer on your computer, only for running it locally
- Later, for receipt photo extraction (Phase 4): an OpenAI API key

## 1. Create the database (Supabase)

1. Sign in to Supabase and click **New project**. Pick a name, a strong database password (save it), and the **West EU (Ireland)** region.
2. When the project is ready, open **SQL Editor** in the left menu.
3. Open `supabase/migrations/0001_initial_schema.sql` from this repository, paste the whole file into the editor and click **Run**. It is safe to run more than once.
4. Do the same with `supabase/seed.sql`. This adds Dunnes, Lidl, Aldi, Tesco and SuperValu.
5. Go to **Authentication → URL Configuration**. Set **Site URL** to `http://localhost:3000` for now (you will change it after deploying). Under **Redirect URLs**, add `http://localhost:3000/auth/callback`.
6. Go to **Project Settings → API** and note two values: **Project URL** and the **anon / publishable** key.

That's the database done. You never need to touch the Supabase dashboard again in normal use.

## 2. Run it on your computer

```bash
git clone <your-repo-url> smart-shopper
cd smart-shopper
npm install
cp .env.example .env.local
```

Open `.env.local` in a text editor and paste in the two Supabase values from step 1.6. Leave `OPENAI_API_KEY` empty for now. Then:

```bash
npm run dev
```

Open http://localhost:3000. Enter your email, click the sign-in link in the email you receive, and you're in. Your household and default comparison groups are created automatically the first time you sign in.

## 3. Deploy it (Vercel)

1. Push the repository to GitHub (private repository recommended).
2. In Vercel, click **Add New → Project**, import the repository, and before deploying open **Environment Variables**. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = the URL Vercel will give you, e.g. `https://smart-shopper-xyz.vercel.app`
   - `OPENAI_API_KEY` (leave blank until Phase 4)
3. Click **Deploy**. Every future push to `main` redeploys automatically.
4. Back in Supabase, **Authentication → URL Configuration**: set **Site URL** to your Vercel URL and add `https://<your-vercel-url>/auth/callback` to Redirect URLs.

## 4. Install it on an iPhone

1. Open your Vercel URL in **Safari** (only Safari can install web apps on iOS).
2. Sign in with the magic link. Open the emailed link in Safari too.
3. Tap the **Share** button (the square with an arrow), then **Add to Home Screen**, then **Add**.

It now opens full screen with its own icon. Because everything is stored in Supabase, the same data appears on your desktop browser.

## 5. Day-to-day use (Phase 1)

- **Add receipt**: enter retailer, branch, date (DD/MM/YYYY), total paid and any basket vouchers, then add lines one at a time. Give either the price each or the line total; the other is worked out.
- **Map lines to products**: pick an existing product or create one without leaving the receipt. Once you confirm a mapping, the same receipt text is suggested next time.
- **Reconcile**: the receipt shows what the lines add up to versus what you paid. If they differ, you can still approve, but only with a note. Nothing is ever changed automatically to force a match.
- **Deposits and one-offs**: mark deposit lines as deposits and chopping boards as excluded. They stay on the receipt but out of price analysis.
- **Needs review**: the Home screen counts unresolved receipts and lines; tap through to fix them.

## 6. Backups and exports

The free Supabase tier has no automatic backups, so back up yourself:

- **Quick**: Supabase dashboard → **Table Editor**, open a table, and use the export option to download CSV. In-app CSV export arrives in Phase 3.
- **Full**: install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run `supabase db dump --db-url "<your connection string>" > backup.sql`. The connection string is under **Project Settings → Database**.
- Receipt images (Phase 4 onward) live in the private `receipts` storage bucket; download them from **Storage** in the dashboard.

## 7. Importing the Google Sheets prototype

Arrives in Phase 3. The field-by-field plan is in `docs/spreadsheet-import-plan.md`. The source sheet is never modified.

## 8. What costs money

| Service | Free tier | When you'd pay |
|---|---|---|
| Supabase | 500 MB database, 1 GB file storage | Only if receipt images exceed 1 GB (roughly 1,000+ photos). Free projects pause after a week of inactivity; opening the dashboard resumes them. |
| Vercel | 100 GB bandwidth/month | Never, for a household. |
| OpenAI (Phase 4) | Your existing credits | A few cents per receipt photo. Only images you upload are sent to OpenAI, and only from the server. |

## 9. Running the tests

```bash
npm test              # unit tests: quantities, formatting, reconciliation
npm run typecheck     # TypeScript
npm run lint
npm run build         # production build
npm run test:visual   # renders real pages with a stubbed database into /tmp/visual/*.html
PGURL=postgres://postgres@localhost:5432/postgres npm run db:test   # migration rerun + RLS/audit/immutability tests, needs local Postgres
```

## Project layout

```
supabase/migrations/       database schema (rerunnable)
supabase/seed.sql          shared retailers
supabase/test/             local Postgres tests and Supabase schema stubs
src/app/(app)/             signed-in screens: home, receipts, products, review, add
src/app/login, src/app/auth/   magic-link sign-in
src/lib/format.ts          euro, DD/MM/YYYY, unit price formatting (en-IE)
src/lib/quantities.ts      pack size to comparable quantity, never guessed
src/lib/reconciliation.ts  lines versus total paid
src/lib/db/types.ts        row types mirroring the migration
src/proxy.ts               session refresh and login redirect
docs/                      import plan
```

## Privacy

All data is scoped to your household by row-level security in Postgres; another signed-in user cannot read it even with the anon key. Receipt images are in a private bucket served by signed URLs. Secrets live only in environment variables; `.env.local` is git-ignored.
