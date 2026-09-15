import Link from "next/link";
import { requireHousehold } from "@/lib/db/session";
import { formatDate, formatEuro } from "@/lib/format";
import { Empty, PageTitle, ReviewReasons } from "@/components/ui";
import type { Receipt, ReceiptLine, Retailer } from "@/lib/db/types";

export const metadata = { title: "Needs review" };

export default async function ReviewPage() {
  const { supabase } = await requireHousehold();
  const [{ data: receipts }, { data: lines }] = await Promise.all([
    supabase.from("receipts").select("id, transaction_date, total_paid, review_reasons, retailers(name)").is("archived_at", null).neq("review_status", "approved").or("review_status.eq.needs_review,review_reasons.neq.{}").order("transaction_date", { ascending: false, nullsFirst: true }).limit(100),
    supabase.from("receipt_lines").select("id, receipt_id, description, net_line_price, review_reasons, receipts!inner(transaction_date, archived_at, retailers(name))").eq("review_required", true).is("receipts.archived_at", null).order("created_at", { ascending: false }).limit(200),
  ]);
  type R = Pick<Receipt, "id" | "transaction_date" | "total_paid" | "review_reasons"> & { retailers: Pick<Retailer, "name"> | null };
  type L = Pick<ReceiptLine, "id" | "receipt_id" | "description" | "net_line_price" | "review_reasons"> & { receipts: Pick<Receipt, "transaction_date"> & { retailers: Pick<Retailer, "name"> | null } };
  const rs = (receipts ?? []) as unknown as R[];
  const ls = (lines ?? []) as unknown as L[];

  return (
    <>
      <PageTitle title="Needs review" back={{ href: "/", label: "Home" }} />
      <h2 className="text-lg font-semibold mb-2">Receipts</h2>
      {rs.length === 0 ? <Empty>No receipts need attention.</Empty> : (
        <ul className="card divide-y divide-line mb-6">
          {rs.map((r) => (
            <li key={r.id}>
              <Link href={`/receipts/${r.id}`} className="block p-4">
                <div className="flex justify-between gap-3">
                  <div className="font-medium">{r.retailers?.name ?? "Unknown retailer"} <span className="text-muted font-normal">{formatDate(r.transaction_date)}</span></div>
                  <div className="num font-semibold">{formatEuro(r.total_paid)}</div>
                </div>
                <div className="mt-1"><ReviewReasons reasons={r.review_reasons} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-lg font-semibold mb-2 mt-6">Lines</h2>
      {ls.length === 0 ? <Empty>Every line is mapped and priced.</Empty> : (
        <ul className="card divide-y divide-line">
          {ls.map((l) => (
            <li key={l.id}>
              <Link href={`/receipts/${l.receipt_id}?line=${l.id}#line-${l.id}`} className="block p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-medium">{l.description}</div>
                    <div className="text-sm text-muted">{l.receipts.retailers?.name ?? "Unknown retailer"}, {formatDate(l.receipts.transaction_date)}</div>
                  </div>
                  <div className="num font-semibold">{formatEuro(l.net_line_price)}</div>
                </div>
                <div className="mt-1"><ReviewReasons reasons={l.review_reasons} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
