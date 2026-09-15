import Decimal from "decimal.js";

/** Values coming from Postgres NUMERIC arrive as strings. Normalise to Decimal without float loss. */
export function toDecimal(value: string | number | Decimal | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return new Decimal(value);
  } catch {
    return null;
  }
}

/** €1,234.56 using the Irish locale. Rounds for display only. */
export function formatEuro(value: string | number | Decimal | null | undefined, opts: { dash?: boolean } = {}): string {
  const d = toDecimal(value);
  if (d === null) return opts.dash === false ? "" : "–";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber());
}

/** Unit prices need more precision than money: €0.333 per egg, €0.60 per 100 g. */
export function formatUnitPrice(value: string | number | Decimal | null | undefined, unitLabel: string): string {
  const d = toDecimal(value);
  if (d === null) return "Comparison unavailable";
  const rounded = d.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  const text = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(rounded.toNumber());
  return `${text} per ${unitLabel}`;
}

/** DD/MM/YYYY from an ISO date string (YYYY-MM-DD) or Date. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const date = typeof value === "string" ? parseIsoDate(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("en-IE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Dublin" }).format(date);
}

/** Parses YYYY-MM-DD as a calendar date without timezone drift. */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

/** Parses user-entered DD/MM/YYYY into YYYY-MM-DD. Returns null when it is not a real date. */
export function parseIrishDate(value: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(value);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatQuantity(value: string | number | Decimal | null | undefined): string {
  const d = toDecimal(value);
  if (d === null) return "–";
  return d.toDecimalPlaces(3).toString();
}

export function daysBetween(isoDate: string, now: Date = new Date()): number | null {
  const d = parseIsoDate(isoDate);
  if (!d) return null;
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

export const REVIEW_REASON_LABELS: Record<string, string> = {
  unclear_description: "Unclear receipt description",
  missing_product_mapping: "Not mapped to a product",
  missing_pack_count: "Pack count missing",
  missing_weight_or_volume: "Weight or volume missing",
  unknown_unit: "Measurement unit unknown",
  uncertain_price: "Price uncertain",
  uncertain_discount: "Discount uncertain",
  does_not_reconcile: "Receipt does not reconcile",
  possible_duplicate: "Possible duplicate receipt",
  missing_comparable_group: "No comparison group",
  voucher_eligibility_uncertain: "Voucher eligibility uncertain",
  missing_date: "Date missing",
  missing_retailer: "Retailer missing",
  imported_needs_check: "Imported, needs a check",
};

export const EXCLUSION_REASON_LABELS: Record<string, string> = {
  deposit: "Refundable deposit",
  non_grocery: "Not groceries",
  one_off_household: "One-off household item",
  non_recurring: "Not bought regularly",
  insufficient_data: "Not enough data to compare",
  user_choice: "Excluded by you",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
};
