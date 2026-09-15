import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function AppShell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen">
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-line bg-surface p-4 gap-1 sticky top-0 h-screen">
        <Link href="/" className="text-lg font-semibold px-3 py-2 mb-2">Smart Shopper</Link>
        <NavLinks />
        <div className="mt-auto text-sm text-muted px-3 break-all">
          {email}
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="underline" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 pb-28 md:pb-10 md:px-8">{children}</main>
      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        <NavLinks />
      </nav>
    </div>
  );
}
