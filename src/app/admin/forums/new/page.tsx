import { requireAdmin } from "@/lib/admin";
import { CategoryForm } from "../category-form";
import { createForumCategory } from "../actions";

export default async function NewForumCategoryPage() {
  const { supabase } = await requireAdmin();

  const { data: topLevelCategories } = await supabase
    .from("forum_categories")
    .select("id, name")
    .is("parent_id", null)
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New forum category</h2>
      <CategoryForm
        action={createForumCategory}
        topLevelCategories={topLevelCategories ?? []}
        submitLabel="Create category"
      />
    </div>
  );
}
