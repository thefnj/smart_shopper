import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { requireHousehold } from "@/lib/db/session";
import { formatDate, formatEuro, formatQuantity, EXCLUSION_REASON_LABELS } from "@/lib/format";
import { reconcile } from "@/lib/reconciliation";
import { FormError, PageTitle, ReviewReasons, StatusBadge } from "@/components/ui";
import { ReceiptForm } from "../ReceiptForm";
import { LineForm, type ProductOption } from "../LineForm";
import { addLine, archiveReceipt, deleteLine, setReceiptStatus, updateLine, updateReceipt } from "../actions";
import type { Product, Receipt, ReceiptLine, Retailer } from "@/lib/db/types";

export default async function ReceiptDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string; line?: string; error?: string; product?: string }> }) {
  const { id } = await params;
  const { edit, line: editingLineId, error, product: newProductId } = await searchParams;
  const { supabase } = await requireHousehold();

  const [{ data: receipt }, { data: lines }, { data: retailers }, { data: products }] = await Promise.all([
    supabase.from("receipts").select("*, retailers(name)").eq("id", id).maybeSingle(),
    supabase.from("receipt_lines").select("*, products(generic_name, brand, variant)").eq("receipt_id", id).order("line_number"),
    supabase.from("retailers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("products").select("id, generic_name, brand, variant").is("archived_at", null).order("generic_name"),
  ]);
  if (!receipt) notFound();
  const r = receipt as unknown as Receipt & { retailers: Pick<Retailer, "name"> | null };
  const rows = (lines ?? []) as unknown as Array<ReceiptLine & { products: Pick<Product, "generic_name" | "brand" | "variant"> | null }>;
  const productOptions = (products ?? []) as ProductOption[];
  const recon = reconcile({ lines: rows, basket_discounts_total: r.basket_discounts_total, total_paid: r.total_paid });
  const approved = r.review_status === "approved";
  const title = `${r.retailers?.name ?? "Unknown retailer"}${r.store_location ? `, ${r.store_location}` : ""}`;

  // Alias suggestions for unmapped lines, keyed by normalised description.
  const unmappedDescriptions = rows.filter((l) => !l.product_id && l.raw_description).map((l) => l.raw_description!.trim().replace(/\s+/g, " ").toUpperCase());
  const { data: aliases } = unmappedDescriptions.length
    ? await supabase.from("receipt_aliases").select("normalised_description, product_id, retailer_id").in("normalised_description", unmappedDescriptions)
    : { data: [] };
  const suggestionFor = (l: ReceiptLine) => {
    const key = l.raw_description?.trim().replace(/\s+/g, " ").toUpperCase();
    const match = (aliases ?? []).find((a) => a.normalised_description === key && (a.retailer_id === r.retailer_id || a.retailer_id === null));
    return match?.product_id ?? null;
  };

  if (edit) {
    return (
      <>
        <PageTitle title="Edit receipt" back={{ href: `/receipts/${id}`, label: "Cancel" }} />
        <ReceiptForm action={updateReceipt.bind(null, id)} receipt={r} retailers={retailers ?? []} submitLabel="Save changes" />
      </>
    );
  }

  return (
    <>
      <PageTitle title={title} back={{ href: "/receipts", label: "Receipts" }} action={!approved ? <Link href={`/receipts/${id}?edit=1`} className="btn btn-secondary">Edit</Link> : undefined} />
      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-muted">
        <StatusBadge status={r.review_status} />
        <span>{formatDate(r.transaction_date)}{r.transaction_time ? ` ${r.transaction_time.slice(0, 5)}` : ""}</span>
        {r.reference_number && <span>Ref {r.reference_number}</span>}
      </div>
      <ReviewReasons reasons={r.review_reasons} />
      <FormError message={error} />

      <section className="card p-4 my-4">
        <h2 className="sr-only">Totals</h2>
        <dl className="grid gap-1 text-[15px]">
          <Row label="Lines before discounts" value={formatEuro(recon.grossTotal)} />
          {recon.itemDiscounts.gt(0) && <Row label="Item discounts" value={`−${formatEuro(recon.itemDiscounts)}`} />}
          {recon.basketDiscounts.gt(0) && <Row label="Basket vouchers" value={`−${formatEuro(recon.basketDiscounts)}`} />}
          {recon.deposits.gt(0) && <Row label="Deposits" value={formatEuro(recon.deposits)} />}
          <Row label="Adds up to" value={formatEuro(recon.computedTotal)} strong />
          <Row label="Total paid (as printed)" value={formatEuro(r.total_paid)} strong />
        </dl>
        <p className={`mt-3 text-sm font-medium ${recon.balanced ? "text-ok" : "text-review"}`}>
          {recon.totalPaid === null
            ? "Enter the total paid to check the receipt balances."
            : recon.balanced
              ? "✓ Balances."
              : `! Off by ${formatEuro(recon.difference!.abs())} (${recon.difference!.gt(0) ? "lines add up to more than paid" : "lines add up to less than paid"}). Nothing is changed automatically.`}
        </p>
        {r.approval_note && <p className="text-sm text-muted mt-1">Approval note: {r.approval_note}</p>}
      </section>

      <h2 className="text-lg font-semibold mb-2">Lines <span className="text-muted font-normal">({rows.length})</span></h2>
      {rows.length === 0 && <p className="text-muted mb-3">No lines yet. Add each line as it appears on the receipt.</p>}
      <ul className="grid gap-3 mb-6">
        {rows.map((l) => {
          const editing = editingLineId === l.id;
          const suggestion = suggestionFor(l);
          return (
            <li key={l.id} id={`line-${l.id}`} className={`card p-4 ${l.review_required ? "border-review" : ""} ${!l.include_in_analysis ? "opacity-80" : ""}`}>
              {editing ? (
                <LineForm action={updateLine.bind(null, id, l.id)} line={l} products={productOptions} receiptId={id} suggestedProductId={newProductId ?? suggestion} submitLabel="Save line" cancelHref={`/receipts/${id}`} />
              ) : (
                <>
                  <div className="receipt-row">
                    <div>
                      <div className="font-medium">{l.description}</div>
                      <div className="text-sm text-muted">
                        {l.is_deposit ? "Refundable deposit, kept out of prices" : l.products ? `${l.products.generic_name}${l.products.brand ? ` (${l.products.brand})` : ""}` : suggestion ? "Not mapped, suggestion available" : "Not mapped to a product"}
                        {" · qty "}{formatQuantity(l.quantity)}
                        {l.listed_unit_price ? ` @ ${formatEuro(l.listed_unit_price)}` : ""}
                      </div>
                    </div>
                    <div className="text-right num">
                      <div className="font-semibold">{formatEuro(l.is_deposit ? l.deposit_amount : l.net_line_price)}</div>
                      {new Decimal(l.item_discount).gt(0) && <div className="text-sm text-muted">was {formatEuro(l.gross_line_price)}</div>}
                      {new Decimal(l.allocated_basket_discount).gt(0) && <div className="text-sm text-ok">{formatEuro(l.effective_line_price)} after voucher</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {l.is_deposit && <span className="badge badge-draft">Deposit</span>}
                    {l.is_promotion && <span className="badge badge-draft">Promotion</span>}
                    {!l.include_in_analysis && !l.is_deposit && <span className="badge badge-draft">Excluded: {EXCLUSION_REASON_LABELS[l.exclusion_reason ?? "user_choice"]}</span>}
                    {l.corrections?.length > 0 && <span className="badge badge-draft">{l.corrections.length} correction{l.corrections.length === 1 ? "" : "s"}</span>}
                    <ReviewReasons reasons={l.review_reasons} />
                  </div>
                  {!approved && (
                    <div className="flex items-center gap-3 mt-3">
                      <Link href={`/receipts/${id}?line=${l.id}#line-${l.id}`} className="btn btn-secondary flex-1">{l.product_id || l.is_deposit ? "Edit" : "Map product"}</Link>
                      {r.review_status === "draft" && (
                        <form action={deleteLine.bind(null, id, l.id)}>
                          <button className="min-h-11 px-3 text-danger text-sm underline" type="submit">Remove</button>
                        </form>
                      )}
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {!approved && !editingLineId && (
        <section id="add-line" className="card p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Add a line</h2>
          <LineForm action={addLine.bind(null, id)} products={productOptions} receiptId={id} suggestedProductId={newProductId} submitLabel="Add line" />
        </section>
      )}

      <section className="card p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Status</h2>
        {approved ? (
          <form action={setReceiptStatus.bind(null, id, "needs_review")}>
            <p className="text-sm text-muted mb-3">Approved receipts are locked. Reopen it to make changes.</p>
            <button className="btn btn-secondary" type="submit">Reopen for review</button>
          </form>
        ) : (
          <form action={setReceiptStatus.bind(null, id, "approved")} className="grid gap-3">
            <div className="field">
              <label htmlFor="approval_note">Note {recon.balanced && !rows.some((l) => l.review_required) ? "(optional)" : "(required, because something is unresolved)"}</label>
              <input id="approval_note" name="approval_note" defaultValue={r.approval_note ?? ""} placeholder="e.g. Receipt torn, last line unreadable" />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" type="submit">Approve receipt</button>
              {r.review_status === "draft" && (
                <button className="btn btn-secondary" type="submit" formAction={setReceiptStatus.bind(null, id, "needs_review")}>Mark for review</button>
              )}
            </div>
          </form>
        )}
      </section>

      {r.notes && <p className="text-sm text-muted whitespace-pre-line mb-6">Notes: {r.notes}</p>}

      <form action={archiveReceipt.bind(null, id)}>
        <button className="btn btn-danger" type="submit">Archive receipt</button>
        <p className="text-sm text-muted mt-1">Archived receipts are hidden, not deleted. Their lines and audit trail are kept.</p>
      </form>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="receipt-row">
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={`num ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
