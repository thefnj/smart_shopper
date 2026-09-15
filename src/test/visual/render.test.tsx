import { describe, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { fakeSupabase } from "./fake-supabase";

const receipt = {
  id: "r1", household_id: "h1", retailer_id: "ret1", store_location: null, transaction_date: "2026-07-10", transaction_time: "18:42:00", reference_number: "DS001",
  review_status: "draft", review_reasons: ["does_not_reconcile"], subtotal_before_discounts: "109.50", item_discounts_total: "5.99", basket_discounts_total: "20.00", deposits_total: "1.80", total_paid: "89.50",
  reconciliation_difference: "-2.19", approval_note: null, notes: null, archived_at: null, retailers: { name: "Dunnes Stores" },
};
const lines = [
  { id: "l1", receipt_id: "r1", line_number: 1, raw_description: "MILTON 1L", description: "MILTON 1L", quantity: "1", listed_unit_price: null, gross_line_price: "6.50", item_discount: "0", net_line_price: "6.50", allocated_basket_discount: "0", effective_line_price: "6.50", deposit_amount: "0", product_id: "p1", is_deposit: false, voucher_eligible: true, include_in_analysis: true, exclusion_reason: null, is_promotion: false, review_required: false, review_reasons: [], corrections: [], user_notes: null, products: { generic_name: "Sterilising Fluid", brand: "Milton", variant: null } },
  { id: "l2", receipt_id: "r1", line_number: 2, raw_description: "K/BERG N/A", description: "K/BERG N/A", quantity: "2", listed_unit_price: "2.25", gross_line_price: "4.50", item_discount: "0.50", net_line_price: "4.00", allocated_basket_discount: "0", effective_line_price: "4.00", deposit_amount: "0", product_id: null, is_deposit: false, voucher_eligible: true, include_in_analysis: true, exclusion_reason: null, is_promotion: true, review_required: true, review_reasons: ["missing_product_mapping"], corrections: [{ at: "", field: "quantity", from: "1", to: "2" }], user_notes: null, products: null },
  { id: "l3", receipt_id: "r1", line_number: 3, raw_description: "MORETTI ZERO 4PK", description: "MORETTI ZERO 4PK", quantity: "1", listed_unit_price: null, gross_line_price: "7.50", item_discount: "0", net_line_price: "7.50", allocated_basket_discount: "0", effective_line_price: "7.50", deposit_amount: "0", product_id: null, is_deposit: false, voucher_eligible: true, include_in_analysis: true, exclusion_reason: null, is_promotion: false, review_required: true, review_reasons: ["missing_product_mapping", "uncertain_price"], corrections: [], user_notes: null, products: null },
  { id: "l4", receipt_id: "r1", line_number: 4, raw_description: "12 @ 0.15 DEPOSIT", description: "12 @ 0.15 DEPOSIT", quantity: "12", listed_unit_price: "0.15", gross_line_price: "0", item_discount: "0", net_line_price: "0", allocated_basket_discount: "0", effective_line_price: "0", deposit_amount: "1.80", product_id: null, is_deposit: true, voucher_eligible: false, include_in_analysis: false, exclusion_reason: "deposit", is_promotion: false, review_required: false, review_reasons: [], corrections: [], user_notes: null, products: null },
  { id: "l5", receipt_id: "r1", line_number: 5, raw_description: "CHOPPING BOARD", description: "CHOPPING BOARD", quantity: "1", listed_unit_price: null, gross_line_price: "3.49", item_discount: "0", net_line_price: "3.49", allocated_basket_discount: "0", effective_line_price: "3.49", deposit_amount: "0", product_id: "p2", is_deposit: false, voucher_eligible: true, include_in_analysis: false, exclusion_reason: "one_off_household", is_promotion: false, review_required: false, review_reasons: [], corrections: [], user_notes: null, products: { generic_name: "Chopping Board", brand: null, variant: null } },
];
const tables = {
  receipts: [receipt],
  receipt_lines: lines,
  retailers: [{ id: "ret1", name: "Dunnes Stores" }, { id: "ret2", name: "Lidl" }],
  products: [{ id: "p1", generic_name: "Sterilising Fluid", brand: "Milton", variant: null }, { id: "p2", generic_name: "Chopping Board", brand: null, variant: null }],
  receipt_aliases: [],
  comparable_groups: [{ id: "g1", name: "Eggs", base_unit: "each", display_unit_quantity: "1", display_unit_label: "egg", comparison_attributes: [{ key: "egg_size", label: "Egg size", values: ["medium", "large", "unknown"] }, { key: "free_range", label: "Free range", values: ["yes", "no", "unknown"] }], allow_cross_attribute_comparison: true, notes: null, archived_at: null }],
};

vi.mock("@/lib/db/session", () => ({
  requireHousehold: async () => ({ supabase: fakeSupabase(tables), user: { id: "u1", email: "thomas@example.com" }, household: { id: "h1", name: "Home" } }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/receipts", notFound: () => { throw new Error("nf"); }, redirect: () => { throw new Error("redirect"); } }));

async function write(name: string, body: React.ReactNode) {
  const cssDir = path.join(process.cwd(), ".next/static");
  const css = fs.readdirSync(cssDir, { recursive: true }).map(String).filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(cssDir, f), "utf8")).join("\n");
  const { AppShell } = await import("@/components/AppShell");
  const html = renderToStaticMarkup(<AppShell email="thomas@example.com">{body}</AppShell>);
  fs.mkdirSync("/tmp/visual", { recursive: true });
  fs.writeFileSync(`/tmp/visual/${name}.html`, `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="min-h-full flex flex-col">${html}</body></html>`);
}

describe("visual render", () => {
  it("receipt detail", async () => {
    const Page = (await import("@/app/(app)/receipts/[id]/page")).default;
    await write("receipt", await Page({ params: Promise.resolve({ id: "r1" }), searchParams: Promise.resolve({}) }));
  });
  it("receipt detail editing a line", async () => {
    const Page = (await import("@/app/(app)/receipts/[id]/page")).default;
    await write("receipt-edit", await Page({ params: Promise.resolve({ id: "r1" }), searchParams: Promise.resolve({ line: "l3" }) }));
  });
  it("home", async () => {
    const Page = (await import("@/app/(app)/page")).default;
    await write("home", await Page());
  });
  it("new product", async () => {
    const Page = (await import("@/app/(app)/products/new/page")).default;
    await write("product-new", await Page({ searchParams: Promise.resolve({}) }));
  });
});
