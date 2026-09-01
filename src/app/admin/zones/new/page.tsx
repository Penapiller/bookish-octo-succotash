import { requireAdmin } from "@/lib/admin";
import { ZoneForm } from "../zone-form";
import { createZone } from "../actions";

export default async function NewZonePage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New zone</h2>
      <p className="text-sm text-zinc-500">
        You&apos;ll be able to add pets and items to this zone&apos;s pool after creating it.
      </p>
      <ZoneForm action={createZone} submitLabel="Create zone" />
    </div>
  );
}
