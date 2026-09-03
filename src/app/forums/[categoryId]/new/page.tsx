import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewThreadForm } from "./new-thread-form";

export default async function NewThreadPage(props: PageProps<"/forums/[categoryId]/new">) {
  const { categoryId } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: category } = await supabase
    .from("forum_categories")
    .select("id, name, is_active")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category || !category.is_active) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New thread</h1>
        <p className="text-sm text-stone-500">in {category.name}</p>
      </div>
      <NewThreadForm categoryId={category.id} />
    </main>
  );
}
