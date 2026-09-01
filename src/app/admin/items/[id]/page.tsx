import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ItemForm } from "../item-form";
import { updateItem } from "../actions";

export default async function EditItemPage(props: PageProps<"/admin/items/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: item } = await supabase
    .from("items")
    .select("id, name, type, rarity, image_url, sell_value, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit item</h2>
      <ItemForm action={updateItem} item={item} submitLabel="Save changes" />
    </div>
  );
}
