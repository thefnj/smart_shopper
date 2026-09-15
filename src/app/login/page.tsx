import { sendMagicLink } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; next?: string }> }) {
  const { sent, error, next } = await searchParams;
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-2xl font-semibold mb-1">Smart Shopper</h1>
        <p className="text-muted mb-6">Sign in with a link sent to your email. No password needed.</p>
        {sent ? (
          <p className="badge badge-ok text-base p-3 rounded-lg block">Check your email for the sign-in link. It expires in an hour.</p>
        ) : (
          <form action={sendMagicLink} className="grid gap-4">
            <input type="hidden" name="next" value={next ?? "/"} />
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button className="btn btn-primary" type="submit">Send sign-in link</button>
          </form>
        )}
      </div>
    </main>
  );
}
