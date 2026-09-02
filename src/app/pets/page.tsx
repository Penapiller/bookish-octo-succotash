import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewFolderForm } from "./new-folder-form";
import { FolderHeader } from "./folder-header";
import { MoveToFolderSelect } from "./move-to-folder-select";
import { PetNameEditor } from "./pet-name-editor";
import type { PetFolderRow, PetWithSpecies } from "@/lib/supabase/types";

const PAGE_SIZE = 25;
const ALL_TAB = "all";
const UNSORTED_TAB = "unsorted";

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
          <PetNameEditor userId={userId} petId={pet.id} customName={pet.custom_name} />
          <p className="text-xs capitalize text-zinc-500">
            {pet.species?.name} · {pet.rarity}
          </p>
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

export default async function PetsPage(props: PageProps<"/pets">) {
  const searchParams = await props.searchParams;
  const folderParam = Array.isArray(searchParams.folder) ? searchParams.folder[0] : searchParams.folder;
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const activeTab = folderParam ?? ALL_TAB;
  const requestedPage = Number(pageParam ?? "1");
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  const { data: foldersData } = await supabase
    .from("pet_folders")
    .select("id, owner_id, name, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  const folders = (foldersData ?? []) as PetFolderRow[];
  const folderOptions = folders.map((f) => ({ id: f.id, name: f.name }));
  const activeFolder = folders.find((f) => f.id === activeTab) ?? null;

  const [{ count: totalCount }, { count: unsortedCount }, folderCounts] = await Promise.all([
    supabase.from("pets").select("*", { count: "exact", head: true }).eq("owner_id", userId),
    supabase
      .from("pets")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("folder_id", null),
    Promise.all(
      folders.map((folder) =>
        supabase
          .from("pets")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", userId)
          .eq("folder_id", folder.id)
          .then((res) => ({ id: folder.id, count: res.count ?? 0 })),
      ),
    ),
  ]);

  const countsByFolderId = new Map(folderCounts.map((f) => [f.id, f.count]));

  const activeCount =
    activeTab === ALL_TAB
      ? (totalCount ?? 0)
      : activeTab === UNSORTED_TAB
        ? (unsortedCount ?? 0)
        : (countsByFolderId.get(activeTab) ?? 0);

  const totalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  let petsQuery = supabase
    .from("pets")
    .select("id, rarity, color_variant, folder_id, custom_name, created_at, species(name, image_url)")
    .eq("owner_id", userId);

  if (activeTab === UNSORTED_TAB) {
    petsQuery = petsQuery.is("folder_id", null);
  } else if (activeTab !== ALL_TAB) {
    petsQuery = petsQuery.eq("folder_id", activeTab);
  }

  const { data: petsData } = await petsQuery
    .order("created_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  const pets = (petsData ?? []) as unknown as PetWithSpecies[];

  const tabs = [
    { value: ALL_TAB, label: "All", count: totalCount ?? 0 },
    ...folders.map((f) => ({ value: f.id, label: f.name, count: countsByFolderId.get(f.id) ?? 0 })),
    { value: UNSORTED_TAB, label: "Unsorted", count: unsortedCount ?? 0 },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pets ({totalCount ?? 0})</h1>
        <p className="text-sm text-zinc-500">
          Group your pets into folders, like a lair.{" "}
          <Link href="/items" className="underline">
            Looking for items?
          </Link>
        </p>
      </div>

      <NewFolderForm />

      <nav className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === ALL_TAB ? "/pets" : `/pets?folder=${tab.value}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeTab === tab.value
                ? "border-zinc-900 font-medium dark:border-white"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </nav>

      {activeFolder ? (
        <FolderHeader folderId={activeFolder.id} name={activeFolder.name} petCount={activeCount} />
      ) : null}

      {pets.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">
          {activeTab === ALL_TAB
            ? "You don't have any pets yet."
            : activeTab === UNSORTED_TAB
              ? "Everything's sorted into a folder."
              : "No pets in this folder yet."}
        </p>
      ) : (
        <PetGrid list={pets} userId={userId} folderOptions={folderOptions} />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link
            href={`/pets?folder=${activeTab}&page=${page - 1}`}
            aria-disabled={page <= 1}
            className={`rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 ${
              page <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Previous
          </Link>
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/pets?folder=${activeTab}&page=${page + 1}`}
            aria-disabled={page >= totalPages}
            className={`rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Next
          </Link>
        </div>
      ) : null}
    </main>
  );
}
