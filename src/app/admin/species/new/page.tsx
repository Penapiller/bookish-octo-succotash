import { requireAdmin } from "@/lib/admin";
import { SpeciesForm } from "../species-form";
import { createSpecies } from "../actions";

export default async function NewSpeciesPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New species</h2>
      <SpeciesForm action={createSpecies} submitLabel="Create species" />
    </div>
  );
}
