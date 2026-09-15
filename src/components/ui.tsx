import Link from "next/link";
import { REVIEW_REASON_LABELS, REVIEW_STATUS_LABELS } from "@/lib/format";
import type { ReviewReason, ReviewStatus } from "@/lib/db/types";

export function PageTitle({ title, action, back }: { title: string; action?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-5">
      {back && <Link href={back.href} className="text-sm text-muted hover:underline">‹ {back.label}</Link>}
      <div className="flex items-end justify-between gap-3 mt-1">
        <h1 className="text-2xl md:text-3xl font-semibold leading-tight">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const cls = status === "approved" ? "badge-ok" : status === "needs_review" ? "badge-review" : "badge-draft";
  const glyph = status === "approved" ? "✓" : status === "needs_review" ? "!" : "·";
  return <span className={`badge ${cls}`}><span aria-hidden="true">{glyph}</span>{REVIEW_STATUS_LABELS[status]}</span>;
}

export function ReviewReasons({ reasons }: { reasons: ReviewReason[] }) {
  if (!reasons?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {reasons.map((r) => <li key={r} className="badge badge-review"><span aria-hidden="true">!</span>{REVIEW_REASON_LABELS[r] ?? r}</li>)}
    </ul>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-6 text-center text-muted">{children}</div>;
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="badge badge-danger block p-3 rounded-lg text-sm">{message}</p>;
}
