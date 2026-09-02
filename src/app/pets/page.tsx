import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewFolderForm } from "./new-folder-form";
import { FolderHeader } from "./folder-header";
import { MoveToFolderSelect } from "./move-to-folder-select";
import type { PetFolderRow, PetWithSpecies } from "@/lib/supabase/types";

function PetGrid({
  list,
  userId,
  folderOptions,
}: {
  list: PetWithSpecies[];
  userId: string;
  folderOptions: { id: string; name: string }[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {list.map((pet) => (
        <li
          key={pet.id}
          className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800"
        >
          {pet.species?.image_url ? (
            <Image
              src={pet.species.image_url}
              alt={pet.species?.name ?? ""}
              width={96}
              height={96}
              className="h-24 w-24 rounded border-2 border-blue-600"
            />
          ) : (
            <div className="h-24 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
          )}
          <p className="text-sm font-medium">{pet.species?.name}</p>
          <p className="text-xs capitalize text-zinc-500">{pet.rarity}</p>
          <MoveToFolderSelect
            userId={userId}
            petId={pet.id}
            currentFolderId={pet.folder_id}
            folders={folderOptions}
          />
        </li>
      ))}
    </ul>
  );
}

export default async function PetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  const [{ data: foldersData }, { data: petsData }] = await Promise.all([
    supabase
      .from("pet_folders")
      .select("id, owner_id, name, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("pets")
      .select("id, rarity, color_variant, folder_id, created_at, species(name, image_url)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const folders = (foldersData ?? []) as PetFolderRow[];
  const pets = (petsData ?? []) as unknown as PetWithSpecies[];

  const petsByFolder = new Map<string | null, PetWithSpecies[]>();
  for (const pet of pets) {
    const list = petsByFolder.get(pet.folder_id) ?? [];
    list.push(pet);
    petsByFolder.set(pet.folder_id, list);
  }

  const folderOptions = folders.map((f) => ({ id: f.id, name: f.name }));
  const unsortedPets = petsByFolder.get(null) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pets ({pets.length})</h1>
          <p className="text-sm text-zinc-500">
            Group your pets into folders, like a lair.{" "}
            <Link href="/items" className="underline">
              Looking for items?
            </Link>
          </p>
        </div>
      </div>

      <NewFolderForm />

      {pets.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">You don&apos;t have any pets yet.</p>
      ) : (
        <>
          {folders.map((folder) => {
            const folderPets = petsByFolder.get(folder.id) ?? [];
            return (
              <section key={folder.id} className="flex flex-col gap-3">
                <FolderHeader folderId={folder.id} name={folder.name} petCount={folderPets.length} />
                {folderPets.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No pets in this folder yet.</p>
                ) : (
                  <PetGrid list={folderPets} userId={userId} folderOptions={folderOptions} />
                )}
              </section>
            );
          })}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Unsorted ({unsortedPets.length})
            </h2>
            {unsortedPets.length === 0 ? (
              <p className="text-sm text-zinc-500 italic">Everything&apos;s sorted into a folder.</p>
            ) : (
              <PetGrid list={unsortedPets} userId={userId} folderOptions={folderOptions} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
