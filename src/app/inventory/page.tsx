import { redirect } from "next/navigation";

// /inventory was split into /pets and /items — kept as a redirect so old
// links/bookmarks still land somewhere sensible.
export default function InventoryPage() {
  redirect("/pets");
}
