import { describe, expect, it } from "vitest";
import { reconcile } from "@/lib/reconciliation";

describe("reconcile", () => {
  it("balances a simple receipt", () => {
    const r = reconcile({
      lines: [
        { gross_line_price: "6.50", item_discount: "0", deposit_amount: "0" },
        { gross_line_price: "4.50", item_discount: "0.50", deposit_amount: "0" },
        { gross_line_price: "0", item_discount: "0", deposit_amount: "1.80" },
      ],
      basket_discounts_total: "0",
      total_paid: "12.30",
    });
    expect(r.computedTotal.toString()).toBe("12.3");
    expect(r.balanced).toBe(true);
  });
  it("subtracts basket vouchers", () => {
    const r = reconcile({ lines: [{ gross_line_price: "60", item_discount: "0", deposit_amount: "0" }], basket_discounts_total: "10", total_paid: "50" });
    expect(r.balanced).toBe(true);
  });
  it("reports the difference without changing anything", () => {
    const r = reconcile({ lines: [{ gross_line_price: "10", item_discount: "0", deposit_amount: "0" }], basket_discounts_total: "0", total_paid: "9.50" });
    expect(r.difference?.toString()).toBe("0.5");
    expect(r.balanced).toBe(false);
  });
  it("cannot balance when total paid is unknown", () => {
    const r = reconcile({ lines: [], basket_discounts_total: "0", total_paid: null });
    expect(r.difference).toBeNull();
    expect(r.balanced).toBe(false);
  });
});
