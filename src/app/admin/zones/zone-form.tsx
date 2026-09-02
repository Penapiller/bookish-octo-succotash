"use client";

import { useActionState } from "react";
import type { ZoneFormState } from "./actions";
import type { ZoneRow } from "@/lib/supabase/types";

const initialState: ZoneFormState = null;

export function ZoneForm({
  action,
  zone,
  submitLabel,
}: {
  action: (prevState: ZoneFormState, formData: FormData) => Promise<ZoneFormState>;
  zone?: ZoneRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {zone ? <input type="hidden" name="zone_id" value={zone.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={zone?.name ?? ""}
          required
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tier" className="text-sm font-medium">
          Tier
        </label>
        <input
          id="tier"
          name="tier"
          type="number"
          min={1}
          step={1}
          defaultValue={zone?.tier ?? 1}
          required
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
          defaultValue={zone?.description ?? ""}
          rows={3}
          className="resize-y rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image_url" className="text-sm font-medium">
          Image URL
        </label>
        <input
          id="image_url"
          name="image_url"
          defaultValue={zone?.image_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="unlock_requirement" className="text-sm font-medium">
          Unlock requirement
        </label>
        <input
          id="unlock_requirement"
          name="unlock_requirement"
          defaultValue={zone?.unlock_requirement ?? ""}
          placeholder="Shown to players — not enforced yet"
          className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-md border border-amber-200 p-3 dark:border-stone-800">
        <legend className="px-1 text-sm font-medium">Map hotspot (% of map image)</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["map_x", "X"],
              ["map_y", "Y"],
              ["map_width", "Width"],
              ["map_height", "Height"],
            ] as const
          ).map(([field, label]) => (
            <div key={field} className="flex flex-col gap-1.5">
              <label htmlFor={field} className="text-xs text-stone-500">
                {label}
              </label>
              <input
                id={field}
                name={field}
                type="number"
                min={0}
                max={100}
                step={0.1}
                defaultValue={zone?.[field] ?? ""}
                className="rounded-md border border-amber-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={zone?.is_active ?? true}
          className="h-4 w-4 rounded border-amber-300 dark:border-stone-700"
        />
        Active (visible on the expeditions map)
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
