const FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatForumDate(iso: string): string {
  return FORMATTER.format(new Date(iso));
}

// A shorter form (no weekday/year) for tight spots — the /messages inbox
// row, where formatForumDate's full "Wed, Sep 3, 2026, 4:12 PM" would wrap.
const SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatShortDate(iso: string): string {
  return SHORT_FORMATTER.format(new Date(iso));
}
