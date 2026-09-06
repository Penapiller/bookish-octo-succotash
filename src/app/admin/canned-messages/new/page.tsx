import { requireAdmin } from "@/lib/admin";
import { CannedMessageForm } from "../canned-message-form";
import { createCannedMessage } from "../actions";

export default async function NewCannedMessagePage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New canned message</h2>
      <CannedMessageForm action={createCannedMessage} submitLabel="Create message" />
    </div>
  );
}
