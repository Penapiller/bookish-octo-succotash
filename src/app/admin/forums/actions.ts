"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { uploadGameImage } from "@/lib/game-image-upload";

export type ForumCategoryFormState = { error: string } | null;

function readCategoryFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
  const iconUrlRaw = String(formData.get("icon_url") ?? "").trim();
  const sortOrderRaw = String(formData.get("sort_order") ?? "0").trim();
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };
  if (name.length > 80) return { ok: false as const, error: "Name must be 80 characters or fewer." };
  if (descriptionRaw.length > 300)
    return { ok: false as const, error: "Description must be 300 characters or fewer." };

  const sortOrder = Number.parseInt(sortOrderRaw, 10);
  if (!Number.isFinite(sortOrder)) return { ok: false as const, error: "Sort order must be a number." };

  return {
    ok: true as const,
    fields: {
      name,
      description: descriptionRaw.length > 0 ? descriptionRaw : null,
      // "" means "top-level category" (no parent) — the <select>'s empty option.
      parent_id: parentIdRaw.length > 0 ? parentIdRaw : null,
      icon_url: iconUrlRaw.length > 0 ? iconUrlRaw : null,
      sort_order: sortOrder,
      is_active: isActive,
    },
  };
}

export async function createForumCategory(
  _prevState: ForumCategoryFormState,
  formData: FormData,
): Promise<ForumCategoryFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readCategoryFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { data, error } = await supabase
    .from("forum_categories")
    .insert(parsed.fields)
    .select("id")
    .single();
  if (error || !data) {
    return { error: `Could not create category: ${error?.message ?? "unknown error"}` };
  }

  const iconFile = formData.get("icon_file");
  if (iconFile instanceof File && iconFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "forums", data.id, iconFile);
      if (uploadedUrl) {
        await supabase.from("forum_categories").update({ icon_url: uploadedUrl }).eq("id", data.id);
      }
    } catch (uploadError) {
      return {
        error: `Category created, but the icon upload failed: ${
          uploadError instanceof Error ? uploadError.message : "unknown error"
        }`,
      };
    }
  }

  revalidatePath("/admin/forums");
  redirect("/admin/forums");
}

export async function updateForumCategory(
  _prevState: ForumCategoryFormState,
  formData: FormData,
): Promise<ForumCategoryFormState> {
  const { supabase } = await requireAdmin();

  const categoryId = String(formData.get("category_id") ?? "");
  if (categoryId.length === 0) return { error: "Missing category id." };

  const parsed = readCategoryFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  if (parsed.fields.parent_id === categoryId) {
    return { error: "A category can't be its own parent." };
  }

  const iconFile = formData.get("icon_file");
  if (iconFile instanceof File && iconFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "forums", categoryId, iconFile);
      if (uploadedUrl) {
        parsed.fields.icon_url = uploadedUrl;
      }
    } catch (uploadError) {
      return {
        error: uploadError instanceof Error ? uploadError.message : "Icon upload failed.",
      };
    }
  }

  const { error } = await supabase.from("forum_categories").update(parsed.fields).eq("id", categoryId);
  if (error) {
    return { error: `Could not save category: ${error.message}` };
  }

  revalidatePath("/admin/forums");
  redirect("/admin/forums");
}
