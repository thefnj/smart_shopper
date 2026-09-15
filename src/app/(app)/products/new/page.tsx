import { requireHousehold } from "@/lib/db/session";
import { PageTitle } from "@/components/ui";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";
import type { ComparableGroup } from "@/lib/db/types";

export const metadata = { title: "New product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ return_to?: string; name?: string }> }) {
  const { return_to, name } = await searchParams;
  const { supabase } = await requireHousehold();
  const { data } = await supabase.from("comparable_groups").select("*").is("archived_at", null).order("name");
  return (
    <>
      <PageTitle title="New product" back={{ href: return_to ?? "/products", label: return_to ? "Back to receipt" : "Products" }} />
      <ProductForm action={createProduct} groups={(data ?? []) as ComparableGroup[]} returnTo={return_to} submitLabel="Create product" product={name ? { generic_name: name } : undefined} />
    </>
  );
}
