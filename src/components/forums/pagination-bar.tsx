import Link from "next/link";

/**
 * The "« ‹ Page X of Y pages › »" footer bar. Plain links with a
 * `page` search param — no client JS needed, works with the server
 * components that render every forum page.
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
    <div className="flex items-center justify-end gap-3 bg-amber-700 px-4 py-1.5 text-xs font-medium text-white">
      <PageLink href={hrefFor(1)} disabled={page <= 1}>
        «
      </PageLink>
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
        ‹
      </PageLink>
      <span>
        Page {page} of {clampedTotal} page{clampedTotal === 1 ? "" : "s"}
      </span>
      <PageLink href={hrefFor(page + 1)} disabled={page >= clampedTotal}>
        ›
      </PageLink>
      <PageLink href={hrefFor(clampedTotal)} disabled={page >= clampedTotal}>
        »
      </PageLink>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="px-1 text-white/40">{children}</span>;
  }
  return (
    <Link href={href} className="px-1 hover:underline">
      {children}
    </Link>
  );
}
