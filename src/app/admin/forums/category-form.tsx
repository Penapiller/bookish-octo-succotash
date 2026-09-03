"use client";

import { useActionState, useState } from "react";
import type { ForumCategoryFormState } from "./actions";
import type { ForumCategoryRow } from "@/lib/supabase/types";

const initialState: ForumCategoryFormState = null;

export function CategoryForm({
  action,
  category,
  // Only top-level categories (parent_id null) are offered as parent
  // choices — that's what keeps the hierarchy exactly two levels deep
  // (see 0021_forums.sql's comment on this). When editing a top-level
  // category that already has subcategories, it's excluded from its own
  // list further down so it can't become a subcategory of itself.
  topLevelCategories,
  submitLabel,
}: {
  action: (prevState: ForumCategoryFormState, formData: FormData) => Promise<ForumCategoryFormState>;
  category?: ForumCategoryRow;
  topLevelCategories: Pick<ForumCategoryRow, "id" | "name">[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const parentOptions = topLevelCategories.filter((c) => c.id !== category?.id);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {category ? <input type="hidden" name="category_id" value={category.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={category?.name ?? ""}
          required
          maxLength={80}
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={category?.description ?? ""}
          maxLength={300}
          rows={3}
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="parent_id" className="text-sm font-medium">
          Parent category
        </label>
        <select
          id="parent_id"
          name="parent_id"
          defaultValue={category?.parent_id ?? ""}
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <option value="">— Top-level category —</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500">
          Leave as top-level, or nest this under one of the existing top-level categories as a
          subcategory.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Icon</span>
        <div className="flex items-center gap-3">
          {previewUrl || category?.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, which next/image can't optimize
            <img
              src={previewUrl ?? category!.icon_url!}
              alt=""
              className="h-16 w-16 rounded border border-amber-300 object-cover dark:border-stone-700"
            />
          ) : (
            <div className="h-16 w-16 rounded border border-dashed border-amber-300 dark:border-stone-700" />
          )}
          <div className="flex flex-col gap-1">
            <input
              id="icon_file"
              name="icon_file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm"
            />
            <p className="text-xs text-stone-500">PNG, JPEG, WebP, or GIF — up to 5 MB.</p>
          </div>
        </div>
        <label htmlFor="icon_url" className="mt-1 text-xs text-stone-500">
          Or paste an image URL instead (used only if no file is uploaded above)
        </label>
        <input
          id="icon_url"
          name="icon_url"
          defaultValue={category?.icon_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sort_order" className="text-sm font-medium">
          Sort order
        </label>
        <input
          id="sort_order"
          name="sort_order"
          type="number"
          defaultValue={category?.sort_order ?? 0}
          className="w-32 rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <p className="text-xs text-stone-500">Lower numbers are listed first.</p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={category?.is_active ?? true}
          className="h-4 w-4 rounded border-amber-300 dark:border-stone-700"
        />
        Active (visible on the forums, and can hold new threads)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
