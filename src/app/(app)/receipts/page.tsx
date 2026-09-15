import Link from "next/link";
import { requireHousehold } from "@/lib/db/session";
import { formatDate, formatEuro } from "@/lib/format";
import { Empty, PageTitle, StatusBadge } from "@/components/ui";
import type { Receipt, Retailer } from "@/lib/db/types";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ status?: string; retailer?: string }> }) {
  const { status, retailer } = await searchParams;
  const { supabase } = await requireHousehold();
  let q = supabase.from("receipts").select("id, transaction_date, total_paid, review_status, store_location, retailer_id, retailers(name)").is("archived_at", null).order("transaction_date", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false });
  if (status) q = q.eq("review_status", status);
  if (retailer) q = q.eq("retailer_id", retailer);
  const [{ data }, { data: retailers }] = await Promise.all([q.limit(200), supabase.from("retailers").select("id, name").eq("is_active", true).order("name")]);
  type Row = Pick<Receipt, "id" | "transaction_date" | "total_paid" | "review_status" | "store_location" | "retailer_id"> & { retailers: Pick<Retailer, "name"> | null };
  const receipts = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageTitle title="Receipts" action={<Link href="/receipts/new" className="btn btn-primary">Add receipt</Link>} />
      <form className="flex gap-2 mb-4">
        <select name="status" defaultValue={status ?? ""} className="min-h-11 px-3 rounded-[10px] border border-line bg-surface flex-1" aria-label="Status">
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="needs_review">Needs review</option>
          <option value="approved">Approved</option>
        </select>
        <select name="retailer" defaultValue={retailer ?? ""} className="min-h-11 px-3 rounded-[10px] border border-line bg-surface flex-1" aria-label="Retailer">
          <option value="">Any retailer</option>
          {(retailers ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      {receipts.length === 0 ? (
        <Empty>No receipts match. Add one to get started.</Empty>
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
    </>
  );
}
