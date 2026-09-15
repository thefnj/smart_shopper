"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const parsed = z.object({ email: z.string().email(), next: z.string().default("/") }).safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
  });
  if (!parsed.success) redirect("/login?error=Enter a valid email address");

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(parsed.data.next)}` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?sent=1");
}
