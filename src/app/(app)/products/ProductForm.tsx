"use client";
import { useActionState, useState } from "react";
import type { ComparableGroup, Product } from "@/lib/db/types";
import type { ProductFormState } from "./actions";
import { EXCLUSION_REASON_LABELS } from "@/lib/format";
import { FormError } from "@/components/ui";

export function ProductForm({ action, product, groups, returnTo, submitLabel }: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: Partial<Product>;
  groups: ComparableGroup[];
  returnTo?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [groupId, setGroupId] = useState(product?.comparable_group_id ?? "");
  const [included, setIncluded] = useState(product?.include_in_analysis ?? true);
  const group = groups.find((g) => g.id === groupId) ?? null;
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <FormError message={state.error} />

      <div className="field">
        <label htmlFor="generic_name">Product name</label>
        <input id="generic_name" name="generic_name" defaultValue={product?.generic_name ?? ""} required placeholder="Sterilising Fluid" />
        <span className="hint">What the thing is, without the brand. “Sterilising Fluid”, not “Milton Sterilising Fluid”.</span>
        {err.generic_name && <span className="error">{err.generic_name}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="brand">Brand</label>
          <input id="brand" name="brand" defaultValue={product?.brand ?? ""} placeholder="Milton" />
        </div>
        <div className="field">
          <label htmlFor="variant">Variant</label>
          <input id="variant" name="variant" defaultValue={product?.variant ?? ""} placeholder="Crunchy" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="category">Category</label>
          <input id="category" name="category" defaultValue={product?.category ?? ""} placeholder="Household" list="category-list" />
        </div>
        <div className="field">
          <label htmlFor="comparable_group_id">Comparison group</label>
          <select id="comparable_group_id" name="comparable_group_id" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">None yet</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} (per {g.display_unit_label})</option>)}
          </select>
        </div>
      </div>

      <fieldset className="card p-4 grid gap-3">
        <legend className="px-1 text-sm text-muted">Pack size</legend>
        <div className="grid grid-cols-3 gap-3">
          <div className="field">
            <label htmlFor="pack_count">Items in pack</label>
            <input id="pack_count" name="pack_count" inputMode="decimal" defaultValue={product?.pack_count ?? ""} placeholder="10" />
            {err.pack_count && <span className="error">{err.pack_count}</span>}
          </div>
          <div className="field">
            <label htmlFor="amount_per_item">Amount per item</label>
            <input id="amount_per_item" name="amount_per_item" inputMode="decimal" defaultValue={product?.amount_per_item ?? ""} placeholder="330" />
            {err.amount_per_item && <span className="error">{err.amount_per_item}</span>}
          </div>
          <div className="field">
            <label htmlFor="measurement_unit">Unit</label>
            <select id="measurement_unit" name="measurement_unit" defaultValue={product?.measurement_unit ?? ""}>
              <option value="">–</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="each">each</option>
            </select>
          </div>
        </div>
        <p className="hint text-sm text-muted">
          {group
            ? group.base_unit === "each"
              ? `This group compares per ${group.display_unit_label}, so “items in pack” is what matters.`
              : `This group compares per ${group.display_unit_label}. Enter the weight or volume; leave blank if the receipt or pack doesn’t say and it will be flagged rather than guessed.`
            : "Leave anything you don’t know blank. Blanks are flagged for review, never guessed."}
        </p>
      </fieldset>

      {group && group.comparison_attributes.length > 0 && (
        <fieldset className="card p-4 grid gap-3">
          <legend className="px-1 text-sm text-muted">{group.name} details</legend>
          <div className="grid grid-cols-2 gap-3">
            {group.comparison_attributes.map((attr) => (
              <div className="field" key={attr.key}>
                <label htmlFor={`attr:${attr.key}`}>{attr.label}</label>
                <select id={`attr:${attr.key}`} name={`attr:${attr.key}`} defaultValue={product?.attributes?.[attr.key] ?? ""}>
                  <option value="">Not recorded</option>
                  {attr.values.map((v) => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-2">
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" name="is_recurring" defaultChecked={product?.is_recurring ?? true} className="w-5 h-5" />
          Bought regularly
        </label>
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" name="include_in_analysis" checked={included} onChange={(e) => setIncluded(e.target.checked)} className="w-5 h-5" />
          Include in grocery price analysis
        </label>
        {!included && (
          <div className="field">
            <label htmlFor="exclusion_reason">Why exclude it?</label>
            <select id="exclusion_reason" name="exclusion_reason" defaultValue={product?.exclusion_reason ?? "user_choice"}>
              {Object.entries(EXCLUSION_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="barcode">Barcode</label>
          <input id="barcode" name="barcode" inputMode="numeric" defaultValue={product?.barcode ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <input id="notes" name="notes" defaultValue={product?.notes ?? ""} />
        </div>
      </div>

      <datalist id="category-list">
        {["Produce", "Dairy", "Dairy & Eggs", "Bakery", "Meat", "Fish", "Deli", "Frozen", "Grocery", "Drinks", "Household", "Personal Care", "Baby", "Garden", "Deposit"].map((c) => <option key={c} value={c} />)}
      </datalist>

      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
