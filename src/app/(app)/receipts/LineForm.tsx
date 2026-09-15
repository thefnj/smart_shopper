"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import type { Product, ReceiptLine } from "@/lib/db/types";
import type { FormState } from "./actions";
import { EXCLUSION_REASON_LABELS } from "@/lib/format";
import { FormError } from "@/components/ui";

export type ProductOption = Pick<Product, "id" | "generic_name" | "brand" | "variant">;

export function LineForm({ action, line, products, receiptId, suggestedProductId, submitLabel, cancelHref }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  line?: Partial<ReceiptLine>;
  products: ProductOption[];
  receiptId: string;
  suggestedProductId?: string | null;
  submitLabel: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [isDeposit, setIsDeposit] = useState(line?.is_deposit ?? false);
  const [included, setIncluded] = useState(line?.include_in_analysis ?? true);
  const [description, setDescription] = useState(line?.description ?? "");
  const err = state.fieldErrors ?? {};
  const defaultProduct = line?.product_id ?? suggestedProductId ?? "";

  return (
    <form action={formAction} className="grid gap-3">
      <FormError message={state.error} />
      {line?.raw_description && line.raw_description !== line.description && (
        <p className="text-sm text-muted">Originally entered as <span className="font-medium">{line.raw_description}</span>. The original is kept.</p>
      )}
      <div className="field">
        <label htmlFor="description">Description as printed</label>
        <input id="description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="MILTON 1L" autoCapitalize="characters" />
        {err.description && <span className="error">{err.description}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="field">
          <label htmlFor="quantity">Qty</label>
          <input id="quantity" name="quantity" inputMode="decimal" defaultValue={line?.quantity ?? "1"} />
          {err.quantity && <span className="error">{err.quantity}</span>}
        </div>
        <div className="field">
          <label htmlFor="listed_unit_price">Each</label>
          <input id="listed_unit_price" name="listed_unit_price" inputMode="decimal" defaultValue={line?.listed_unit_price ?? ""} placeholder="1.65" />
          {err.listed_unit_price && <span className="error">{err.listed_unit_price}</span>}
        </div>
        <div className="field">
          <label htmlFor="gross_line_price">Line total</label>
          <input id="gross_line_price" name="gross_line_price" inputMode="decimal" defaultValue={line?.gross_line_price ?? ""} placeholder="6.50" />
          {err.gross_line_price && <span className="error">{err.gross_line_price}</span>}
        </div>
      </div>
      <p className="text-xs text-muted -mt-1">Fill in either “each” or “line total”; the other is worked out. Line total wins if both are given.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="field">
          <label htmlFor="item_discount">Discount on this line</label>
          <input id="item_discount" name="item_discount" inputMode="decimal" defaultValue={line?.item_discount && line.item_discount !== "0" ? line.item_discount : ""} placeholder="0.50" />
          {err.item_discount && <span className="error">{err.item_discount}</span>}
        </div>
        <div className="field">
          <label htmlFor="product_id">Product</label>
          <select id="product_id" name="product_id" defaultValue={defaultProduct}>
            <option value="">Not mapped yet</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.generic_name}{p.brand ? ` (${p.brand})` : ""}{p.variant ? `, ${p.variant}` : ""}</option>
            ))}
          </select>
          {suggestedProductId && !line?.product_id && <span className="hint">Suggested from a previous receipt. Change it if it’s wrong.</span>}
          <Link href={`/products/new?return_to=${encodeURIComponent(`/receipts/${receiptId}${line?.id ? `?line=${line.id}` : ""}`)}&name=${encodeURIComponent(description)}`} className="hint underline">Create a new product</Link>
        </div>
      </div>

      <div className="grid gap-1">
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" name="is_deposit" checked={isDeposit} onChange={(e) => setIsDeposit(e.target.checked)} className="w-5 h-5" />
          Refundable container deposit
        </label>
        {isDeposit && (
          <div className="field">
            <label htmlFor="deposit_amount">Deposit amount (leave blank to use the line total)</label>
            <input id="deposit_amount" name="deposit_amount" inputMode="decimal" defaultValue={line?.deposit_amount && line.deposit_amount !== "0" ? line.deposit_amount : ""} placeholder="1.80" />
          </div>
        )}
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" name="is_promotion" defaultChecked={line?.is_promotion ?? false} className="w-5 h-5" />
          Bought on promotion
        </label>
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" name="voucher_eligible" defaultChecked={line?.voucher_eligible ?? true} className="w-5 h-5" disabled={isDeposit} />
          Counts towards basket voucher
        </label>
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" name="include_in_analysis" checked={!isDeposit && included} onChange={(e) => setIncluded(e.target.checked)} className="w-5 h-5" disabled={isDeposit} />
          Include in grocery price analysis
        </label>
        {!isDeposit && !included && (
          <div className="field">
            <label htmlFor="exclusion_reason">Why exclude it?</label>
            <select id="exclusion_reason" name="exclusion_reason" defaultValue={line?.exclusion_reason ?? "one_off_household"}>
              {Object.entries(EXCLUSION_REASON_LABELS).filter(([k]) => k !== "deposit").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" name="review_note_uncertain_price" defaultChecked={line?.review_reasons?.includes("uncertain_price") ?? false} className="w-5 h-5" />
          I’m not sure about the price
        </label>
      </div>
      <div className="field">
        <label htmlFor="user_notes">Notes</label>
        <input id="user_notes" name="user_notes" defaultValue={line?.user_notes ?? ""} />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        {cancelHref && <Link href={cancelHref} className="btn btn-secondary">Cancel</Link>}
      </div>
    </form>
  );
}
