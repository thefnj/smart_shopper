import { AppShell } from "@/components/AppShell";
import { requireHousehold } from "@/lib/db/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireHousehold();
  return <AppShell email={user.email}>{children}</AppShell>;
}
