"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireHousehold } from "@/lib/db/session";
import { deriveComparableQuantity } from "@/lib/quantities";
import type { ComparableGroup, ReviewReason } from "@/lib/db/types";

const optionalText = z.string().trim().transform((v) => (v === "" ? null : v));
const optionalNumber = z.string().trim().transform((v, ctx) => {
  if (v === "") return null;
  const n = v.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(n) || Number(n) <= 0) {
    ctx.addIssue({ code: "custom", message: "Must be a number greater than zero" });
    return z.NEVER;
  }
  return n;
});

const productSchema = z.object({
  generic_name: z.string().trim().min(1, "Product name is required"),
  brand: optionalText,
  variant: optionalText,
  category: optionalText,
  comparable_group_id: optionalText,
  pack_count: optionalNumber,
  amount_per_item: optionalNumber,
  measurement_unit: z.enum(["", "g", "kg", "ml", "l", "each"]).transform((v) => (v === "" ? null : v)),
  barcode: optionalText,
  is_recurring: z.coerce.boolean(),
  include_in_analysis: z.coerce.boolean(),
  exclusion_reason: z.enum(["", "deposit", "non_grocery", "one_off_household", "non_recurring", "insufficient_data", "user_choice"]).transform((v) => (v === "" ? null : v)),
  notes: optionalText,
  attributes: z.record(z.string(), z.string()).default({}),
});

function readForm(formData: FormData) {
  const attributes: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("attr:") && typeof v === "string" && v !== "") attributes[k.slice(5)] = v;
  }
  const raw = Object.fromEntries(Array.from(formData.entries()).filter(([k]) => !k.startsWith("attr:")));
  return productSchema.safeParse({ ...raw, is_recurring: raw.is_recurring === "on", include_in_analysis: raw.include_in_analysis === "on", attributes });
}

export type ProductFormState = { error?: string; fieldErrors?: Record<string, string> };

async function buildRecord(formData: FormData) {
  const { supabase, household } = await requireHousehold();
  const parsed = readForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false as const, fieldErrors, supabase, household };
  }
  const d = parsed.data;
  let group: ComparableGroup | null = null;
  if (d.comparable_group_id) {
    const { data } = await supabase.from("comparable_groups").select("*").eq("id", d.comparable_group_id).maybeSingle();
    group = data as ComparableGroup | null;
  }
  const derived = deriveComparableQuantity({ packCount: d.pack_count, amountPerItem: d.amount_per_item, measurementUnit: d.measurement_unit }, group?.base_unit ?? null);
  const reasons: ReviewReason[] = [...derived.reasons];
  if (!d.comparable_group_id && !reasons.includes("missing_comparable_group")) reasons.push("missing_comparable_group");

  const record = {
    household_id: household.id,
    generic_name: d.generic_name,
    brand: d.brand,
    variant: d.variant,
    category: d.category,
    comparable_group_id: d.comparable_group_id,
    pack_count: d.pack_count,
    amount_per_item: d.amount_per_item,
    measurement_unit: d.measurement_unit,
    total_comparable_quantity: derived.total?.toString() ?? null,
    attributes: d.attributes,
    barcode: d.barcode,
    is_recurring: d.is_recurring,
    include_in_analysis: d.include_in_analysis,
    exclusion_reason: d.include_in_analysis ? null : d.exclusion_reason ?? "user_choice",
    review_required: d.include_in_analysis && reasons.length > 0,
    review_reasons: d.include_in_analysis ? reasons : [],
    notes: d.notes,
  };
  return { ok: true as const, record, supabase };
}

export async function createProduct(_: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const built = await buildRecord(formData);
  if (!built.ok) return { fieldErrors: built.fieldErrors };
  const { data, error } = await built.supabase.from("products").insert(built.record).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/products");
  const returnTo = formData.get("return_to");
  redirect(typeof returnTo === "string" && returnTo.startsWith("/") ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}product=${data.id}` : `/products/${data.id}`);
}

export async function updateProduct(id: string, _: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const built = await buildRecord(formData);
  if (!built.ok) return { fieldErrors: built.fieldErrors };
  const changes: Partial<typeof built.record> = { ...built.record };
  delete changes.household_id;
  const { error } = await built.supabase.from("products").update(changes).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function archiveProduct(id: string) {
  const { supabase } = await requireHousehold();
  await supabase.from("products").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/products");
  redirect("/products");
}
