import Link from "next/link";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Add" };

export default function AddPage() {
  return (
    <>
      <PageTitle title="Add" />
      <div className="grid gap-3">
        <Link href="/receipts/new" className="card p-5 block">
          <div className="text-lg font-semibold">Enter a receipt by hand</div>
          <div className="text-muted text-sm">Type in the retailer, date, totals and each line. Photo import arrives in a later phase.</div>
        </Link>
        <Link href="/products/new" className="card p-5 block">
          <div className="text-lg font-semibold">Add a product</div>
          <div className="text-muted text-sm">A reusable record such as “Sterilising Fluid, Milton, 1 L” that receipt lines map to.</div>
        </Link>
      </div>
    </>
  );
}
