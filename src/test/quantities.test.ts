import { describe, expect, it } from "vitest";
import { deriveComparableQuantity } from "@/lib/quantities";

describe("deriveComparableQuantity", () => {
  it("counts eggs by pack count", () => {
    const r = deriveComparableQuantity({ packCount: "10", amountPerItem: null, measurementUnit: null }, "each");
    expect(r.total?.toString()).toBe("10");
    expect(r.reasons).toEqual([]);
  });
  it("converts kg to g", () => {
    const r = deriveComparableQuantity({ packCount: null, amountPerItem: "1", measurementUnit: "kg" }, "g");
    expect(r.total?.toString()).toBe("1000");
  });
  it("multiplies pack count by volume", () => {
    const r = deriveComparableQuantity({ packCount: 4, amountPerItem: 330, measurementUnit: "ml" }, "ml");
    expect(r.total?.toString()).toBe("1320");
  });
  it("flags missing pack count rather than guessing", () => {
    const r = deriveComparableQuantity({ packCount: null, amountPerItem: null, measurementUnit: null }, "each");
    expect(r.total).toBeNull();
    expect(r.reasons).toEqual(["missing_pack_count"]);
  });
  it("flags Moretti Zero 4 pack with no container volume", () => {
    const r = deriveComparableQuantity({ packCount: 4, amountPerItem: null, measurementUnit: null }, "ml");
    expect(r.total).toBeNull();
    expect(r.reasons).toEqual(["missing_weight_or_volume"]);
  });
  it("rejects a unit that does not match the group base unit", () => {
    const r = deriveComparableQuantity({ packCount: 1, amountPerItem: 500, measurementUnit: "g" }, "ml");
    expect(r.total).toBeNull();
    expect(r.reasons).toEqual(["unknown_unit"]);
  });
  it("needs a group before it can compare", () => {
    const r = deriveComparableQuantity({ packCount: 10, amountPerItem: null, measurementUnit: null }, null);
    expect(r.reasons).toEqual(["missing_comparable_group"]);
  });
});
