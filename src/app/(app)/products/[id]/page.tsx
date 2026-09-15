import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHousehold } from "@/lib/db/session";
import { PageTitle, ReviewReasons } from "@/components/ui";
import { formatDate, formatEuro, formatUnitPrice } from "@/lib/format";
import { ProductForm } from "../ProductForm";
import { archiveProduct, updateProduct } from "../actions";
import Decimal from "decimal.js";
import type { ComparableGroup, Product, ReceiptLine, Receipt, Retailer } from "@/lib/db/types";

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params;
  const { edit } = await searchParams;
  const { supabase } = await requireHousehold();
  const [{ data: product }, { data: groups }, { data: lines }] = await Promise.all([
    supabase.from("products").select("*, comparable_groups(*)").eq("id", id).maybeSingle(),
    supabase.from("comparable_groups").select("*").is("archived_at", null).order("name"),
    supabase.from("receipt_lines").select("id, quantity, net_line_price, effective_line_price, include_in_analysis, receipts!inner(id, transaction_date, review_status, archived_at, retailers(name))").eq("product_id", id).is("receipts.archived_at", null).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!product) notFound();
  const p = product as unknown as Product & { comparable_groups: ComparableGroup | null };
  type LineRow = Pick<ReceiptLine, "id" | "quantity" | "net_line_price" | "effective_line_price" | "include_in_analysis"> & { receipts: Pick<Receipt, "id" | "transaction_date" | "review_status"> & { retailers: Pick<Retailer, "name"> | null } };
  const history = (lines ?? []) as unknown as LineRow[];
  const group = p.comparable_groups;
  const total = p.total_comparable_quantity ? new Decimal(p.total_comparable_quantity) : null;

  const updateWithId = updateProduct.bind(null, id);
  const archiveWithId = archiveProduct.bind(null, id);

  if (edit) {
    return (
      <>
        <PageTitle title={p.generic_name} back={{ href: `/products/${id}`, label: "Cancel" }} />
        <ProductForm action={updateWithId} product={p} groups={(groups ?? []) as ComparableGroup[]} submitLabel="Save changes" />
      </>
    );
  }

  return (
    <>
      <PageTitle title={p.generic_name} back={{ href: "/products", label: "Products" }} action={<Link href={`/products/${id}?edit=1`} className="btn btn-secondary">Edit</Link>} />
      <dl className="card p-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 mb-4 text-[15px]">
        <dt className="text-muted">Brand</dt><dd>{p.brand ?? "Not recorded"}</dd>
        <dt className="text-muted">Variant</dt><dd>{p.variant ?? "–"}</dd>
        <dt className="text-muted">Category</dt><dd>{p.category ?? "–"}</dd>
        <dt className="text-muted">Comparison group</dt><dd>{group ? `${group.name}, per ${group.display_unit_label}` : "None"}</dd>
        <dt className="text-muted">Comparable quantity</dt>
        <dd>{total && group ? `${total.toString()} ${group.base_unit}` : "Unknown, comparison unavailable"}</dd>
        {Object.entries(p.attributes ?? {}).map(([k, v]) => (
          <span key={k} className="contents"><dt className="text-muted">{group?.comparison_attributes.find((a) => a.key === k)?.label ?? k}</dt><dd>{v.replace(/_/g, " ")}</dd></span>
        ))}
        <dt className="text-muted">Analysis</dt><dd>{p.include_in_analysis ? "Included" : "Excluded"}{p.is_recurring ? "" : ", not bought regularly"}</dd>
      </dl>
      {p.review_required && <div className="mb-4"><ReviewReasons reasons={p.review_reasons} /></div>}

      <h2 className="text-lg font-semibold mb-2">Purchase history</h2>
      {history.length === 0 ? (
        <p className="text-muted">No receipt lines mapped to this product yet.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {history.map((l) => {
            const eff = l.effective_line_price ?? l.net_line_price;
            const unit = eff && total ? new Decimal(eff).div(new Decimal(l.quantity)).div(total).mul(group ? new Decimal(group.display_unit_quantity) : 1) : null;
            return (
              <li key={l.id} className="p-4 flex justify-between gap-3">
                <div>
                  <Link href={`/receipts/${l.receipts.id}`} className="font-medium hover:underline">{l.receipts.retailers?.name ?? "Unknown retailer"}</Link>
                  <div className="text-sm text-muted">{formatDate(l.receipts.transaction_date)} · qty {l.quantity}{l.receipts.review_status !== "approved" ? " · not yet approved" : ""}</div>
                </div>
                <div className="text-right">
                  <div className="num font-semibold">{formatEuro(eff)}</div>
                  <div className="num text-sm text-muted">{group ? formatUnitPrice(unit, group.display_unit_label) : ""}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form action={archiveWithId} className="mt-8">
        <button className="btn btn-danger" type="submit" onClick={undefined}>Archive product</button>
        <p className="text-sm text-muted mt-1">Archiving hides it from lists. Receipt lines keep their link and nothing is deleted.</p>
      </form>
    </>
  );
}
