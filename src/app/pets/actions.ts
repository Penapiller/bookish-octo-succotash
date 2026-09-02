"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_FOLDER_NAME_LENGTH = 60;

export type FolderFormState = { error: string } | null;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function createFolder(
  _prevState: FolderFormState,
  formData: FormData,
): Promise<FolderFormState> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) {
    return { error: "Folder name can't be empty." };
  }
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return { error: `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer.` };
  }

  const { error } = await supabase.from("pet_folders").insert({ owner_id: user.id, name });
  if (error) {
    return { error: "Could not create folder. Please try again." };
  }

  revalidatePath("/pets");
  return null;
}

export async function renameFolder(
  _prevState: FolderFormState,
  formData: FormData,
): Promise<FolderFormState> {
  const { supabase, user } = await requireUser();

  const folderId = String(formData.get("folder_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (folderId.length === 0) {
    return { error: "Missing folder id." };
  }
  if (name.length === 0) {
    return { error: "Folder name can't be empty." };
  }
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return { error: `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer.` };
  }

  const { error } = await supabase
    .from("pet_folders")
    .update({ name })
    .eq("id", folderId)
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Could not rename folder. Please try again." };
  }

  revalidatePath("/pets");
  return null;
}

// Plain form action (no useActionState) — deleting a folder just returns
// its pets to Unsorted (pets.folder_id on delete set null), nothing is
// lost, so this doesn't need a confirmation step or error display,
// matching the "Remove" buttons elsewhere in this app (zone pool/loot
// table entries, recipe ingredients).
export async function deleteFolder(formData: FormData) {
  const { supabase, user } = await requireUser();

  const folderId = String(formData.get("folder_id") ?? "");
  if (folderId.length === 0) return;

  await supabase.from("pet_folders").delete().eq("id", folderId).eq("owner_id", user.id);

  revalidatePath("/pets");
}
