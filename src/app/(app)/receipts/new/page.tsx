import { requireHousehold } from "@/lib/db/session";
import { PageTitle } from "@/components/ui";
import { ReceiptForm } from "../ReceiptForm";
import { createReceipt } from "../actions";

export const metadata = { title: "New receipt" };

export default async function NewReceiptPage() {
  const { supabase } = await requireHousehold();
  const { data: retailers } = await supabase.from("retailers").select("id, name").eq("is_active", true).order("name");
  return (
    <>
      <PageTitle title="New receipt" back={{ href: "/receipts", label: "Receipts" }} />
      <p className="text-muted mb-4">Enter the header first. You add the lines on the next screen.</p>
      <ReceiptForm action={createReceipt} retailers={retailers ?? []} submitLabel="Save and add lines" />
    </>
  );
}
