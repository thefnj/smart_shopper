import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Household } from "@/lib/db/types";

/** Current user plus their household. Redirects to /login when signed out. */
export async function requireHousehold() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, households(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const household = (membership?.households as unknown as Household | null) ?? null;
  if (!household) {
    throw new Error("No household found for this user. The signup trigger in 0001_initial_schema.sql should create one.");
  }
  return { supabase, user, household };
}
