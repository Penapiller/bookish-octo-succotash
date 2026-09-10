"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";
import { bbcodeToHtml } from "@/lib/bbcode";

const MAX_BIO_LENGTH = 2000;

// Same client-calls-the-RPC-directly pattern as PetNameEditor/
// ForTradeToggle/MoveToFolderSelect (pets has never had a client UPDATE
// policy — set_pet_bio(), 0034_pet_bio.sql, is the only writable path) —
// just with BBCodeEditor's own uncontrolled textarea/toolbar instead of
// a plain input, read via FormData on submit rather than a real page
// navigation, since there's nowhere else on this page to redirect to.
export function PetBioEditor({
  userId,
  petId,
  bio,
}: {
  userId: string;
  petId: string;
  bio: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const value = String(new FormData(event.currentTarget).get("bio") ?? "");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_pet_bio", {
      p_user_id: userId,
      p_pet_id: petId,
      p_bio: value,
    });

    setIsPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setIsEditing(false);
    router.refresh();
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <BBCodeEditor name="bio" defaultValue={bio ?? ""} rows={6} maxLength={MAX_BIO_LENGTH} />
        {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-md bg-green-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setError(null);
            }}
            className="self-start rounded-md border border-green-300 px-3 py-1.5 text-xs hover:bg-green-100 dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {bio ? (
        <div
          className="forum-content text-sm text-stone-700 dark:text-stone-300"
          dangerouslySetInnerHTML={{ __html: bbcodeToHtml(bio) }}
        />
      ) : (
        <p className="text-sm italic text-stone-500">No bio yet.</p>
      )}
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="self-start text-xs text-green-800 underline hover:no-underline dark:text-green-400"
      >
        {bio ? "Edit bio" : "Add a bio"}
      </button>
    </div>
  );
}
