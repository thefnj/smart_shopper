// Hand-maintained mirror of supabase/migrations. NUMERIC columns arrive as strings.
// Regenerate with `npx supabase gen types typescript` once you have a project linked.

export type ReviewStatus = "draft" | "needs_review" | "approved";
export type ExtractionStatus = "none" | "pending" | "extracted" | "failed" | "manual";
export type BaseUnit = "g" | "ml" | "each";
export type MeasurementUnit = "g" | "kg" | "ml" | "l" | "each";
export type DiscountType = "item_promotion" | "multibuy" | "basket_voucher" | "loyalty" | "manual";
export type AllocationMethod = "proportional" | "single_line" | "manual" | "unallocated";
export type ExclusionReason = "deposit" | "non_grocery" | "one_off_household" | "non_recurring" | "insufficient_data" | "user_choice";
export type ReviewReason =
  | "unclear_description"
  | "missing_product_mapping"
  | "missing_pack_count"
  | "missing_weight_or_volume"
  | "unknown_unit"
  | "uncertain_price"
  | "uncertain_discount"
  | "does_not_reconcile"
  | "possible_duplicate"
  | "missing_comparable_group"
  | "voucher_eligibility_uncertain"
  | "missing_date"
  | "missing_retailer"
  | "imported_needs_check";

export interface Household {
  id: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  freshness_days: number;
}

export interface Retailer {
  id: string;
  household_id: string | null;
  name: string;
  country: string;
  is_active: boolean;
}

export interface ComparisonAttributeDef {
  key: string;
  label: string;
  values: string[];
}

export interface ComparableGroup {
  id: string;
  household_id: string;
  name: string;
  base_unit: BaseUnit;
  display_unit_quantity: string;
  display_unit_label: string;
  comparison_attributes: ComparisonAttributeDef[];
  allow_cross_attribute_comparison: boolean;
  notes: string | null;
  archived_at: string | null;
}

export interface Product {
  id: string;
  household_id: string;
  generic_name: string;
  brand: string | null;
  variant: string | null;
  category: string | null;
  comparable_group_id: string | null;
  pack_count: string | null;
  amount_per_item: string | null;
  measurement_unit: MeasurementUnit | null;
  total_comparable_quantity: string | null;
  attributes: Record<string, string>;
  barcode: string | null;
  is_recurring: boolean;
  include_in_analysis: boolean;
  exclusion_reason: ExclusionReason | null;
  review_required: boolean;
  review_reasons: ReviewReason[];
  external_id: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  household_id: string;
  retailer_id: string | null;
  store_location: string | null;
  transaction_date: string | null;
  transaction_time: string | null;
  reference_number: string | null;
  image_path: string | null;
  extraction_status: ExtractionStatus;
  review_status: ReviewStatus;
  review_reasons: ReviewReason[];
  subtotal_before_discounts: string | null;
  item_discounts_total: string;
  basket_discounts_total: string;
  deposits_total: string;
  total_paid: string | null;
  voucher_eligible_subtotal: string | null;
  voucher_efficiency: string | null;
  reconciliation_difference: string | null;
  approval_note: string | null;
  external_id: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceiptLine {
  id: string;
  household_id: string;
  receipt_id: string;
  line_number: number;
  raw_description: string | null;
  description: string | null;
  quantity: string;
  listed_unit_price: string | null;
  gross_line_price: string | null;
  item_discount: string;
  net_line_price: string | null;
  allocated_basket_discount: string;
  effective_line_price: string | null;
  deposit_amount: string;
  product_id: string | null;
  is_deposit: boolean;
  voucher_eligible: boolean;
  include_in_analysis: boolean;
  exclusion_reason: ExclusionReason | null;
  is_promotion: boolean;
  extraction_confidence: string | null;
  review_required: boolean;
  review_reasons: ReviewReason[];
  original_values: Record<string, unknown> | null;
  corrections: Array<{ at: string; field: string; from: unknown; to: unknown }>;
  user_notes: string | null;
}

export interface ReceiptDiscount {
  id: string;
  receipt_id: string;
  receipt_line_id: string | null;
  discount_type: DiscountType;
  description: string | null;
  value: string;
  minimum_spend: string | null;
  eligible_subtotal: string | null;
  allocation_method: AllocationMethod;
  eligibility_uncertain: boolean;
  notes: string | null;
}

export interface ReceiptAlias {
  id: string;
  retailer_id: string | null;
  raw_description: string;
  normalised_description: string;
  product_id: string;
  confidence: string;
  confirmed_by_user: boolean;
  confirmed_at: string | null;
  times_used: number;
}
