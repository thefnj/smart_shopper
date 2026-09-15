"use client";
import { useActionState } from "react";
import type { Receipt, Retailer } from "@/lib/db/types";
import type { FormState } from "./actions";
import { formatDate } from "@/lib/format";
import { FormError } from "@/components/ui";

export function ReceiptForm({ action, receipt, retailers, submitLabel }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  receipt?: Partial<Receipt>;
  retailers: Pick<Retailer, "id" | "name">[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const err = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="grid gap-4">
      <FormError message={state.error} />
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="retailer_id">Retailer</label>
          <select id="retailer_id" name="retailer_id" defaultValue={receipt?.retailer_id ?? ""}>
            <option value="">Not known</option>
            {retailers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="store_location">Branch</label>
          <input id="store_location" name="store_location" defaultValue={receipt?.store_location ?? ""} placeholder="Bray, Boghall Road" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="transaction_date">Date</label>
          <input id="transaction_date" name="transaction_date" inputMode="numeric" placeholder="DD/MM/YYYY" defaultValue={receipt?.transaction_date ? formatDate(receipt.transaction_date) : ""} />
          {err.transaction_date && <span className="error">{err.transaction_date}</span>}
        </div>
        <div className="field">
          <label htmlFor="transaction_time">Time</label>
          <input id="transaction_time" name="transaction_time" type="time" defaultValue={receipt?.transaction_time ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="reference_number">Receipt or reference number</label>
        <input id="reference_number" name="reference_number" defaultValue={receipt?.reference_number ?? ""} />
        <span className="hint">Helps spot the same receipt being added twice.</span>
      </div>
      <fieldset className="card p-4 grid gap-3">
        <legend className="px-1 text-sm text-muted">Totals as printed</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label htmlFor="total_paid">Total paid</label>
            <input id="total_paid" name="total_paid" inputMode="decimal" defaultValue={receipt?.total_paid ?? ""} placeholder="89.50" />
            {err.total_paid && <span className="error">{err.total_paid}</span>}
          </div>
          <div className="field">
            <label htmlFor="basket_discounts_total">Basket vouchers</label>
            <input id="basket_discounts_total" name="basket_discounts_total" inputMode="decimal" defaultValue={receipt?.basket_discounts_total ?? ""} placeholder="10.00" />
            <span className="hint">e.g. Dunnes €10 off €50. Total of all vouchers.</span>
            {err.basket_discounts_total && <span className="error">{err.basket_discounts_total}</span>}
          </div>
        </div>
        <p className="hint text-sm text-muted">Item discounts and deposits are worked out from the lines you add next.</p>
      </fieldset>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={receipt?.notes ?? ""} />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
