"use client";

import { useActionState } from "react";
import type { SpeciesFormState } from "./actions";
import type { PetRarity, SpeciesRow } from "@/lib/supabase/types";

const RARITIES: PetRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const initialState: SpeciesFormState = null;

export function SpeciesForm({
  action,
  species,
  submitLabel,
}: {
  action: (prevState: SpeciesFormState, formData: FormData) => Promise<SpeciesFormState>;
  species?: SpeciesRow;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {species ? <input type="hidden" name="species_id" value={species.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={species?.name ?? ""}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rarity" className="text-sm font-medium">
          Rarity
        </label>
        <select
          id="rarity"
          name="rarity"
          defaultValue={species?.rarity ?? "common"}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image_url" className="text-sm font-medium">
          Image URL
        </label>
        <input
          id="image_url"
          name="image_url"
          defaultValue={species?.image_url ?? ""}
          placeholder="https://…"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={species?.is_active ?? true}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        Active (visible in zone pet pools)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
