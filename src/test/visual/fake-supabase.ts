// Chainable stand-in for supabase-js used only to render pages for screenshots.
export function fakeSupabase(tables: Record<string, unknown[]>) {
  const from = (table: string) => {
    const rows = tables[table] ?? [];
    const state: { count?: boolean; single?: boolean } = {};
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ["select", "is", "eq", "neq", "or", "in", "order", "limit", "ilike"]) {
      chain[m] = (...args: unknown[]) => {
        if (m === "select" && args[1] && (args[1] as { count?: string }).count) state.count = true;
        return chain;
      };
    }
    chain.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
    chain.single = async () => ({ data: rows[0] ?? null, error: null });
    chain.then = (resolve: (v: unknown) => void) => resolve(state.count ? { count: rows.length, data: null, error: null } : { data: rows, error: null });
    return self();
  };
  return { from, auth: { getUser: async () => ({ data: { user: { id: "u1", email: "thomas@example.com" } } }) } };
}
