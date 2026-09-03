// Mirrors the cost curve in expand_den() (0011_currency_and_den_expansion.sql)
// exactly — display-only, the RPC re-derives and enforces the real cost
// server-side regardless of what this shows. Shared by /profile and /pets,
// since both surface how much the next den expansion costs.
export function nextDenExpansionCost(denSize: number): number {
  const expansionsBought = Math.max(0, Math.floor((denSize - 25) / 25));
  return Math.round(500 * Math.pow(1.5, expansionsBought));
}
