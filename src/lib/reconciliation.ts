import Decimal from "decimal.js";
import { toDecimal } from "@/lib/format";

export interface ReconLine {
  gross_line_price: string | number | null;
  item_discount: string | number | null;
  deposit_amount: string | number | null;
}

export interface ReconInput {
  lines: ReconLine[];
  basket_discounts_total: string | number | null;
  total_paid: string | number | null;
}

export interface ReconResult {
  grossTotal: Decimal;
  itemDiscounts: Decimal;
  deposits: Decimal;
  basketDiscounts: Decimal;
  computedTotal: Decimal;
  totalPaid: Decimal | null;
  /** computedTotal minus totalPaid. Null when totalPaid is unknown. Zero means balanced. */
  difference: Decimal | null;
  balanced: boolean;
}

/**
 * Sum of line amounts, minus item-level discounts, minus basket-level discounts, plus deposits,
 * compared with the total printed on the receipt. Never alters a line to force a match.
 */
export function reconcile(input: ReconInput): ReconResult {
  const zero = new Decimal(0);
  const grossTotal = input.lines.reduce((acc, l) => acc.plus(toDecimal(l.gross_line_price) ?? zero), zero);
  const itemDiscounts = input.lines.reduce((acc, l) => acc.plus(toDecimal(l.item_discount) ?? zero), zero);
  const deposits = input.lines.reduce((acc, l) => acc.plus(toDecimal(l.deposit_amount) ?? zero), zero);
  const basketDiscounts = toDecimal(input.basket_discounts_total) ?? zero;
  const computedTotal = grossTotal.minus(itemDiscounts).minus(basketDiscounts).plus(deposits);
  const totalPaid = toDecimal(input.total_paid);
  const difference = totalPaid === null ? null : computedTotal.minus(totalPaid).toDecimalPlaces(2);
  return { grossTotal, itemDiscounts, deposits, basketDiscounts, computedTotal, totalPaid, difference, balanced: difference !== null && difference.isZero() };
}
