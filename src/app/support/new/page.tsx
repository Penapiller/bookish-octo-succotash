import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewSupportTicketPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New support ticket</h1>
        <Link href="/support" className="text-sm text-stone-500 hover:underline">
          ← Back to my tickets
        </Link>
      </div>
      <NewTicketForm />
    </main>
  );
}
