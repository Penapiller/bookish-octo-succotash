import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/**
 * The "Page X of Y" footer bar. Plain links with a `page` search param
 * — no client JS needed, works with the server components that render
 * every forum page.
 */
export function PaginationBar({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  const clampedTotal = Math.max(totalPages, 1);

  function hrefFor(p: number) {
    return p <= 1 ? basePath : `${basePath}?page=${p}`;
  }

  return (
    <div className="flex items-center justify-end gap-4 bg-amber-700 px-5 py-2.5 text-sm font-medium text-white">
      <PageLink href={hrefFor(1)} disabled={page <= 1} label="First page">
        <ChevronsLeft size={16} />
      </PageLink>
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
        <ChevronLeft size={16} />
      </PageLink>
      <span>
        Page {page} of {clampedTotal} page{clampedTotal === 1 ? "" : "s"}
      </span>
      <PageLink href={hrefFor(page + 1)} disabled={page >= clampedTotal} label="Next page">
        <ChevronRight size={16} />
      </PageLink>
      <PageLink href={hrefFor(clampedTotal)} disabled={page >= clampedTotal} label="Last page">
        <ChevronsRight size={16} />
      </PageLink>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-hidden className="text-white/40">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className="hover:opacity-75">
      {children}
    </Link>
  );
}
