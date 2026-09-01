import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { SpeciesForm } from "../species-form";
import { updateSpecies } from "../actions";

export default async function EditSpeciesPage(props: PageProps<"/admin/species/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: species } = await supabase
    .from("species")
    .select("id, name, rarity, image_url, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!species) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit species</h2>
      <SpeciesForm action={updateSpecies} species={species} submitLabel="Save changes" />
    </div>
  );
}
