// Shared by the report form (components/report-button.tsx), staff's
// ticket views (app/mod/report-card.tsx and friends), and the
// player-facing "My Reports" status page (app/reports/page.tsx) — one
// set of human-readable category labels instead of three copies.
export const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  scam: "Scamming",
  other: "Other",
};
