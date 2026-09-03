import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { CategoryForm } from "../category-form";
import { updateForumCategory } from "../actions";

export default async function EditForumCategoryPage(props: PageProps<"/admin/forums/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: category }, { data: topLevelCategories }] = await Promise.all([
    supabase
      .from("forum_categories")
      .select("id, parent_id, name, description, icon_url, sort_order, is_active, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("forum_categories").select("id, name").is("parent_id", null).order("name"),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit forum category</h2>
      <CategoryForm
        action={updateForumCategory}
        category={category}
        topLevelCategories={topLevelCategories ?? []}
        submitLabel="Save changes"
      />
    </div>
  );
}
