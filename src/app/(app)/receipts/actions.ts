"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Decimal from "decimal.js";
import { requireHousehold } from "@/lib/db/session";
import { parseIrishDate } from "@/lib/format";
import { reconcile } from "@/lib/reconciliation";
import type { ReceiptLine, ReviewReason } from "@/lib/db/types";

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

const optionalText = z.string().trim().transform((v) => (v === "" ? null : v));
const money = (allowEmpty: boolean) =>
  z.string().trim().transform((v, ctx) => {
    if (v === "") {
      if (allowEmpty) return null;
      ctx.addIssue({ code: "custom", message: "Required" });
      return z.NEVER;
    }
    const n = v.replace(/[€,\s]/g, "");
    if (!/^-?\d+(\.\d{1,4})?$/.test(n)) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 4.50" });
      return z.NEVER;
    }
    return n;
  });
const irishDate = z.string().trim().transform((v, ctx) => {
  if (v === "") return null;
  const iso = parseIrishDate(v) ?? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  if (!iso) {
    ctx.addIssue({ code: "custom", message: "Use DD/MM/YYYY" });
    return z.NEVER;
  }
  return iso;
});

const receiptSchema = z.object({
  retailer_id: optionalText,
  store_location: optionalText,
  transaction_date: irishDate,
  transaction_time: optionalText,
  reference_number: optionalText,
  subtotal_before_discounts: money(true),
  item_discounts_total: money(true).transform((v) => v ?? "0"),
  basket_discounts_total: money(true).transform((v) => v ?? "0"),
  deposits_total: money(true).transform((v) => v ?? "0"),
  total_paid: money(true),
  notes: optionalText,
});

function issuesToFieldErrors(issues: z.ZodIssue[]) {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[String(i.path[0])] = i.message;
  return fieldErrors;
}

async function findPossibleDuplicate(supabase: Awaited<ReturnType<typeof requireHousehold>>["supabase"], d: z.infer<typeof receiptSchema>, excludeId?: string) {
  if (!d.transaction_date || !d.total_paid) return null;
  let q = supabase.from("receipts").select("id").is("archived_at", null).eq("transaction_date", d.transaction_date).eq("total_paid", d.total_paid);
  if (d.retailer_id) q = q.eq("retailer_id", d.retailer_id);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.limit(1);
  if (data && data.length > 0) return data[0].id as string;
  if (d.reference_number) {
    let r = supabase.from("receipts").select("id").is("archived_at", null).eq("reference_number", d.reference_number);
    if (excludeId) r = r.neq("id", excludeId);
    const { data: byRef } = await r.limit(1);
    if (byRef && byRef.length > 0) return byRef[0].id as string;
  }
  return null;
}

function headerReviewReasons(d: z.infer<typeof receiptSchema>, duplicateId: string | null): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (!d.transaction_date) reasons.push("missing_date");
  if (!d.retailer_id) reasons.push("missing_retailer");
  if (duplicateId) reasons.push("possible_duplicate");
  return reasons;
}

export async function createReceipt(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, household } = await requireHousehold();
  const parsed = receiptSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const duplicateId = await findPossibleDuplicate(supabase, d);
  const reasons = headerReviewReasons(d, duplicateId);
  const { data, error } = await supabase
    .from("receipts")
    .insert({ household_id: household.id, ...d, extraction_status: "manual", review_status: "draft", review_reasons: reasons, notes: duplicateId ? [d.notes, `Possible duplicate of receipt ${duplicateId}`].filter(Boolean).join("\n") : d.notes })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/receipts");
  redirect(`/receipts/${data.id}`);
}

export async function updateReceipt(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireHousehold();
  const parsed = receiptSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const duplicateId = await findPossibleDuplicate(supabase, d, id);
  const { data: current } = await supabase.from("receipts").select("review_reasons").eq("id", id).single();
  const keep = ((current?.review_reasons ?? []) as ReviewReason[]).filter((r) => !["missing_date", "missing_retailer", "possible_duplicate"].includes(r));
  const { error } = await supabase.from("receipts").update({ ...d, review_reasons: [...keep, ...headerReviewReasons(d, duplicateId)] }).eq("id", id);
  if (error) return { error: error.message };
  await refreshReceiptTotals(id);
  revalidatePath(`/receipts/${id}`);
  redirect(`/receipts/${id}`);
}

const lineSchema = z.object({
  description: z.string().trim().min(1, "Describe the line as printed on the receipt"),
  quantity: z.string().trim().transform((v, ctx) => {
    const n = (v === "" ? "1" : v).replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(n) || Number(n) <= 0) {
      ctx.addIssue({ code: "custom", message: "Quantity must be greater than zero" });
      return z.NEVER;
    }
    return n;
  }),
  listed_unit_price: money(true),
  gross_line_price: money(true),
  item_discount: money(true).transform((v) => v ?? "0"),
  deposit_amount: money(true).transform((v) => v ?? "0"),
  product_id: optionalText,
  is_deposit: z.coerce.boolean(),
  is_promotion: z.coerce.boolean(),
  voucher_eligible: z.coerce.boolean(),
  include_in_analysis: z.coerce.boolean(),
  exclusion_reason: z.enum(["", "deposit", "non_grocery", "one_off_household", "non_recurring", "insufficient_data", "user_choice"]).transform((v) => (v === "" ? null : v)),
  user_notes: optionalText,
  review_note_uncertain_price: z.coerce.boolean(),
});

function parseLine(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return lineSchema.safeParse({
    ...raw,
    is_deposit: raw.is_deposit === "on",
    is_promotion: raw.is_promotion === "on",
    voucher_eligible: raw.voucher_eligible === "on",
    include_in_analysis: raw.include_in_analysis === "on",
    review_note_uncertain_price: raw.review_note_uncertain_price === "on",
  });
}

function computeLineAmounts(d: z.infer<typeof lineSchema>) {
  const qty = new Decimal(d.quantity);
  let gross = d.gross_line_price ? new Decimal(d.gross_line_price) : null;
  if (gross === null && d.listed_unit_price) gross = qty.mul(new Decimal(d.listed_unit_price)).toDecimalPlaces(2);
  const itemDiscount = new Decimal(d.item_discount);
  const net = gross === null ? null : gross.minus(itemDiscount);
  const reasons: ReviewReason[] = [];
  if (gross === null) reasons.push("uncertain_price");
  if (d.review_note_uncertain_price && !reasons.includes("uncertain_price")) reasons.push("uncertain_price");
  if (!d.product_id && d.include_in_analysis) reasons.push("missing_product_mapping");
  const amounts = {
    quantity: d.quantity,
    listed_unit_price: d.listed_unit_price,
    gross_line_price: gross?.toString() ?? null,
    item_discount: itemDiscount.toString(),
    net_line_price: net?.toString() ?? null,
    // Basket voucher allocation is applied by the price engine (Phase 2); until then effective = net.
    effective_line_price: net?.toString() ?? null,
    deposit_amount: d.is_deposit ? (d.deposit_amount !== "0" ? d.deposit_amount : gross?.toString() ?? "0") : d.deposit_amount,
  };
  return { amounts, reasons };
}

export async function addLine(receiptId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, household } = await requireHousehold();
  const parsed = parseLine(formData);
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const { amounts, reasons } = computeLineAmounts(d);
  const { count } = await supabase.from("receipt_lines").select("id", { count: "exact", head: true }).eq("receipt_id", receiptId);
  const include = d.is_deposit ? false : d.include_in_analysis;
  const record = {
    household_id: household.id,
    receipt_id: receiptId,
    line_number: (count ?? 0) + 1,
    raw_description: d.description,
    description: d.description,
    ...amounts,
    product_id: d.product_id,
    is_deposit: d.is_deposit,
    voucher_eligible: d.is_deposit ? false : d.voucher_eligible,
    include_in_analysis: include,
    exclusion_reason: include ? null : d.is_deposit ? "deposit" : d.exclusion_reason ?? "user_choice",
    is_promotion: d.is_promotion || new Decimal(amounts.item_discount).gt(0),
    review_required: include && reasons.length > 0,
    review_reasons: include ? reasons : [],
    user_notes: d.user_notes,
  };
  const { error } = await supabase.from("receipt_lines").insert({
    ...record,
    original_values: { entered_manually: true, description: d.description, quantity: d.quantity, gross_line_price: amounts.gross_line_price, item_discount: amounts.item_discount, deposit_amount: amounts.deposit_amount },
  });
  if (error) return { error: error.message };
  await refreshReceiptTotals(receiptId);
  revalidatePath(`/receipts/${receiptId}`);
  redirect(`/receipts/${receiptId}#add-line`);
}

const TRACKED_FIELDS = ["description", "quantity", "listed_unit_price", "gross_line_price", "item_discount", "net_line_price", "deposit_amount", "product_id", "is_deposit", "voucher_eligible", "include_in_analysis", "exclusion_reason", "is_promotion"] as const;

export async function updateLine(receiptId: string, lineId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireHousehold();
  const parsed = parseLine(formData);
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const { data: existing } = await supabase.from("receipt_lines").select("*").eq("id", lineId).single();
  if (!existing) return { error: "Line not found" };
  const current = existing as ReceiptLine;
  const { amounts, reasons } = computeLineAmounts(d);
  const include = d.is_deposit ? false : d.include_in_analysis;
  const keep = (current.review_reasons ?? []).filter((r) => !["uncertain_price", "missing_product_mapping"].includes(r));
  const next = {
    description: d.description,
    ...amounts,
    product_id: d.product_id,
    is_deposit: d.is_deposit,
    voucher_eligible: d.is_deposit ? false : d.voucher_eligible,
    include_in_analysis: include,
    exclusion_reason: include ? null : d.is_deposit ? "deposit" : d.exclusion_reason ?? "user_choice",
    is_promotion: d.is_promotion || new Decimal(amounts.item_discount).gt(0),
    review_reasons: (include ? [...keep, ...reasons] : []) as ReviewReason[],
    user_notes: d.user_notes,
  };
  const reviewRequired = next.review_reasons.length > 0;

  const corrections = [...(current.corrections ?? [])];
  const at = new Date().toISOString();
  for (const f of TRACKED_FIELDS) {
    const before = current[f];
    const after = (next as Record<string, unknown>)[f];
    const same = before === after || (before != null && after != null && String(before) === String(after));
    if (!same) corrections.push({ at, field: f, from: before, to: after });
  }

  const { error } = await supabase.from("receipt_lines").update({ ...next, review_required: reviewRequired, corrections }).eq("id", lineId);
  if (error) return { error: error.message };

  // Remember the mapping so the same receipt text is suggested next time.
  if (d.product_id) {
    const { data: receipt } = await supabase.from("receipts").select("retailer_id, household_id").eq("id", receiptId).single();
    if (receipt && current.raw_description) {
      await supabase.from("receipt_aliases").upsert(
        { household_id: receipt.household_id, retailer_id: receipt.retailer_id, raw_description: current.raw_description, product_id: d.product_id, confidence: 1, confirmed_by_user: true, confirmed_at: at },
        { onConflict: "household_id,retailer_id,normalised_description", ignoreDuplicates: false },
      );
    }
  }
  await refreshReceiptTotals(receiptId);
  revalidatePath(`/receipts/${receiptId}`);
  redirect(`/receipts/${receiptId}`);
}

export async function deleteLine(receiptId: string, lineId: string) {
  const { supabase } = await requireHousehold();
  const { data: receipt } = await supabase.from("receipts").select("review_status").eq("id", receiptId).single();
  if (receipt?.review_status === "approved") redirect(`/receipts/${receiptId}?error=${encodeURIComponent("Approved receipts keep all their lines. Exclude the line instead.")}`);
  await supabase.from("receipt_lines").delete().eq("id", lineId);
  await refreshReceiptTotals(receiptId);
  revalidatePath(`/receipts/${receiptId}`);
  redirect(`/receipts/${receiptId}`);
}

/** Recomputes reconciliation and stores the difference on the receipt. Never edits lines. */
async function refreshReceiptTotals(receiptId: string) {
  const { supabase } = await requireHousehold();
  const [{ data: receipt }, { data: lines }] = await Promise.all([
    supabase.from("receipts").select("basket_discounts_total, total_paid, review_reasons, review_status").eq("id", receiptId).single(),
    supabase.from("receipt_lines").select("gross_line_price, item_discount, deposit_amount").eq("receipt_id", receiptId),
  ]);
  if (!receipt) return;
  const r = reconcile({ lines: lines ?? [], basket_discounts_total: receipt.basket_discounts_total, total_paid: receipt.total_paid });
  const reasons: ReviewReason[] = ((receipt.review_reasons ?? []) as ReviewReason[]).filter((x) => x !== "does_not_reconcile");
  if (r.difference !== null && !r.balanced) reasons.push("does_not_reconcile");
  await supabase.from("receipts").update({ reconciliation_difference: r.difference?.toString() ?? null, item_discounts_total: r.itemDiscounts.toString(), deposits_total: r.deposits.toString(), subtotal_before_discounts: r.grossTotal.toString(), review_reasons: reasons }).eq("id", receiptId);
}

export async function setReceiptStatus(receiptId: string, status: "draft" | "needs_review" | "approved", formData: FormData) {
  const { supabase } = await requireHousehold();
  await refreshReceiptTotals(receiptId);
  const [{ data: receipt }, { count: unreviewed }] = await Promise.all([
    supabase.from("receipts").select("reconciliation_difference, total_paid, review_reasons").eq("id", receiptId).single(),
    supabase.from("receipt_lines").select("id", { count: "exact", head: true }).eq("receipt_id", receiptId).eq("review_required", true),
  ]);
  if (!receipt) return;
  const note = String(formData.get("approval_note") ?? "").trim();
  if (status === "approved") {
    if (receipt.total_paid === null) redirect(`/receipts/${receiptId}?error=${encodeURIComponent("Enter the total paid before approving.")}`);
    const diff = new Decimal(receipt.reconciliation_difference ?? "0");
    if (!diff.isZero() && !note) redirect(`/receipts/${receiptId}?error=${encodeURIComponent("The lines don't add up to the total paid. Add a note explaining the difference to approve anyway.")}`);
    if ((unreviewed ?? 0) > 0 && !note) redirect(`/receipts/${receiptId}?error=${encodeURIComponent(`${unreviewed} line(s) still need review. Fix them or add a note to approve anyway.`)}`);
  }
  await supabase.from("receipts").update({ review_status: status, approval_note: note || null }).eq("id", receiptId);
  revalidatePath(`/receipts/${receiptId}`);
  revalidatePath("/receipts");
  revalidatePath("/");
  redirect(`/receipts/${receiptId}`);
}

export async function archiveReceipt(receiptId: string) {
  const { supabase } = await requireHousehold();
  await supabase.from("receipts").update({ archived_at: new Date().toISOString() }).eq("id", receiptId);
  revalidatePath("/receipts");
  redirect("/receipts");
}
