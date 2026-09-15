import Decimal from "decimal.js";
import type { BaseUnit, MeasurementUnit, ReviewReason } from "@/lib/db/types";
import { toDecimal } from "@/lib/format";

const TO_BASE: Record<MeasurementUnit, { base: BaseUnit; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  each: { base: "each", factor: 1 },
};

export interface QuantityInput {
  packCount: string | number | null | undefined;
  amountPerItem: string | number | null | undefined;
  measurementUnit: MeasurementUnit | null | undefined;
}

export interface QuantityResult {
  /** Total quantity in the group's base unit, or null when it cannot be derived. Never guessed. */
  total: Decimal | null;
  reasons: ReviewReason[];
}

/**
 * Derives the comparable quantity of a product in its group's base unit.
 * 10 eggs -> 10 each. 4 x 330 ml -> 1320 ml. 1 kg -> 1000 g.
 * Anything missing produces null plus the review reason explaining what is missing.
 */
export function deriveComparableQuantity(input: QuantityInput, baseUnit: BaseUnit | null | undefined): QuantityResult {
  const reasons: ReviewReason[] = [];
  if (!baseUnit) return { total: null, reasons: ["missing_comparable_group"] };

  const pack = toDecimal(input.packCount);
  const amount = toDecimal(input.amountPerItem);

  if (baseUnit === "each") {
    if (pack === null) return { total: null, reasons: ["missing_pack_count"] };
    return { total: pack, reasons };
  }

  if (amount === null) return { total: null, reasons: ["missing_weight_or_volume"] };
  if (!input.measurementUnit) return { total: null, reasons: ["unknown_unit"] };
  const conv = TO_BASE[input.measurementUnit];
  if (conv.base !== baseUnit) return { total: null, reasons: ["unknown_unit"] };

  const perItem = amount.mul(conv.factor);
  return { total: perItem.mul(pack ?? 1), reasons };
}

/** Human label for what a product contains, e.g. "10 eggs", "4 × 330 ml", "1 kg". */
export function describePack(input: QuantityInput, displayLabel?: string): string {
  const pack = toDecimal(input.packCount);
  const amount = toDecimal(input.amountPerItem);
  const unit = input.measurementUnit;
  if (amount !== null && unit && unit !== "each") {
    const amountText = `${amount.toString()} ${unit}`;
    return pack !== null && !pack.eq(1) ? `${pack.toString()} × ${amountText}` : amountText;
  }
  if (pack !== null) return `${pack.toString()} ${displayLabel ?? "items"}${pack.eq(1) && displayLabel ? "" : ""}`;
  return "Pack size unknown";
}
