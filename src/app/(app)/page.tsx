import Link from "next/link";
import { requireHousehold } from "@/lib/db/session";
import { formatDate, formatEuro } from "@/lib/format";
import { Empty, PageTitle, StatusBadge } from "@/components/ui";
import type { Receipt, Retailer, ReviewStatus } from "@/lib/db/types";

export default async function HomePage() {
  const { supabase } = await requireHousehold();
  const [{ data: recent }, { count: reviewCount }, { count: productCount }, { count: unmappedCount }] = await Promise.all([
    supabase.from("receipts").select("id, transaction_date, total_paid, review_status, store_location, retailers(name)").is("archived_at", null).order("transaction_date", { ascending: false, nullsFirst: false }).limit(5),
    supabase.from("receipts").select("id", { count: "exact", head: true }).is("archived_at", null).eq("review_status", "needs_review"),
    supabase.from("products").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("receipt_lines").select("id", { count: "exact", head: true }).is("product_id", null).eq("include_in_analysis", true),
  ]);

  type Row = Pick<Receipt, "id" | "transaction_date" | "total_paid" | "store_location"> & { review_status: ReviewStatus; retailers: Pick<Retailer, "name"> | null };
  const receipts = (recent ?? []) as unknown as Row[];

  return (
    <>
      <PageTitle title="Home" />
      <Link href="/receipts/new" className="btn btn-primary w-full text-lg mb-6">Add receipt</Link>

      <section className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Needs review" value={reviewCount ?? 0} href="/review" tone={reviewCount ? "review" : undefined} />
        <Stat label="Unmapped lines" value={unmappedCount ?? 0} href="/review" tone={unmappedCount ? "review" : undefined} />
        <Stat label="Products" value={productCount ?? 0} href="/products" />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Recent receipts</h2>
        {receipts.length === 0 ? (
          <Empty>No receipts yet. Add your first one to start building a price history.</Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link href={`/receipts/${r.id}`} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{r.retailers?.name ?? "Unknown retailer"}{r.store_location ? `, ${r.store_location}` : ""}</div>
                    <div className="text-sm text-muted">{formatDate(r.transaction_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num font-semibold">{formatEuro(r.total_paid)}</div>
                    <StatusBadge status={r.review_status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm text-muted mt-6">Price comparisons and savings appear here once the price engine (Phase 2) is in place and receipts are approved.</p>
    </>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "review" }) {
  return (
    <Link href={href} className={`card p-3 ${tone === "review" ? "border-review" : ""}`}>
      <div className={`num text-2xl font-semibold ${tone === "review" ? "text-review" : ""}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Link>
  );
}
