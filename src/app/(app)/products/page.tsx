import Link from "next/link";
import { requireHousehold } from "@/lib/db/session";
import { Empty, PageTitle, ReviewReasons } from "@/components/ui";
import { describePack } from "@/lib/quantities";
import type { ComparableGroup, Product } from "@/lib/db/types";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await requireHousehold();
  let query = supabase.from("products").select("*, comparable_groups(name, display_unit_label)").is("archived_at", null).order("generic_name");
  if (q) query = query.or(`generic_name.ilike.%${q}%,brand.ilike.%${q}%,variant.ilike.%${q}%`);
  const { data } = await query.limit(200);
  const products = (data ?? []) as unknown as Array<Product & { comparable_groups: Pick<ComparableGroup, "name" | "display_unit_label"> | null }>;

  return (
    <>
      <PageTitle title="Products" action={<Link href="/products/new" className="btn btn-primary">New product</Link>} />
      <form className="mb-4" role="search">
        <label htmlFor="q" className="sr-only">Search products</label>
        <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Search by name or brand" className="w-full min-h-11 px-3 rounded-[10px] border border-line bg-surface" />
      </form>
      {products.length === 0 ? (
        <Empty>{q ? `Nothing matches “${q}”.` : "No products yet. They are created when you map receipt lines, or add one directly."}</Empty>
      ) : (
        <ul className="card divide-y divide-line">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className="block p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.generic_name}{p.variant ? `, ${p.variant}` : ""}</div>
                    <div className="text-sm text-muted">{p.brand ?? "No brand recorded"} · {describePack({ packCount: p.pack_count, amountPerItem: p.amount_per_item, measurementUnit: p.measurement_unit }, p.comparable_groups?.display_unit_label)}</div>
                  </div>
                  <div className="text-right text-sm text-muted shrink-0">
                    {p.comparable_groups?.name ?? "No group"}
                    {!p.include_in_analysis && <div className="badge badge-draft mt-1">Excluded</div>}
                  </div>
                </div>
                {p.review_required && <div className="mt-2"><ReviewReasons reasons={p.review_reasons} /></div>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
