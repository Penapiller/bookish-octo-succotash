/**
 * The bordered panel-with-colored-header-bar look used throughout the
 * forums (index, thread list, thread view) — one shared wrapper so
 * every panel stays visually consistent. Colors are the site's existing
 * testing palette (amber), not meant to be final.
 */
export function ForumPanel({
  icon,
  title,
  action,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-300 shadow-sm">
      <div className="flex items-center justify-between gap-2 bg-amber-700 px-5 py-3 text-base font-semibold text-white">
        <span className="flex items-center gap-2.5">
          {icon}
          {title}
        </span>
        {action}
      </div>
      {children ? <div className="bg-white">{children}</div> : null}
    </div>
  );
}

export function ForumPanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-amber-300 first:border-t-0">
      <div className="flex items-center justify-between gap-2 bg-amber-100 px-5 py-2.5 text-sm font-semibold text-amber-900">
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
