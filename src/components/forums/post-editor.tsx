"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import type { ForumEditorMode } from "@/lib/supabase/types";

/**
 * The one control every place a player writes forum HTML (new thread,
 * reply) renders. Two input modes sharing one underlying `content`
 * string plus an `editor_mode` flag, both submitted as plain form
 * fields — WYSIWYG (TipTap) by default, with a toggle to a raw
 * textarea for hand-typed HTML (Toyhouse-style "Code" mode).
 *
 * This is a convenience layer only. Nothing here is a security
 * boundary — the server re-runs sanitizeForumHtml() on whatever
 * `bodyFieldName` submits regardless of which mode produced it, so
 * there's no need (and no attempt) to restrict what raw mode lets a
 * player type. TipTap's own toolbar deliberately has no video/audio/
 * embed button — links are inserted as plain <a> tags, matching what
 * the sanitizer allows.
 */
export function PostEditor({
  bodyFieldName = "body",
  editorModeFieldName = "editor_mode",
  defaultBody = "",
  defaultEditorMode = "wysiwyg",
}: {
  bodyFieldName?: string;
  editorModeFieldName?: string;
  defaultBody?: string;
  defaultEditorMode?: ForumEditorMode;
}) {
  const [mode, setMode] = useState<ForumEditorMode>(defaultEditorMode);
  const [content, setContent] = useState(defaultBody);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: false }),
      Image,
    ],
    content: defaultBody,
    onUpdate: ({ editor }) => setContent(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "forum-content min-h-40 rounded-md rounded-t-none border border-t-0 border-amber-300 px-3 py-2 text-sm focus:outline-none dark:border-stone-700 dark:bg-stone-900",
      },
    },
  });

  function switchMode(next: ForumEditorMode) {
    if (next === mode) return;
    if (next === "wysiwyg") {
      // Coming back from hand-typed HTML — load it into TipTap so
      // editing can continue visually. TipTap will only keep what its
      // own schema understands; that's fine, it's not the sanitizer.
      editor?.commands.setContent(content);
    }
    setMode(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Post</span>
        <div className="flex overflow-hidden rounded-md border border-amber-300 text-xs dark:border-stone-700">
          <button
            type="button"
            onClick={() => switchMode("wysiwyg")}
            className={`px-2.5 py-1 ${
              mode === "wysiwyg"
                ? "bg-amber-800 text-white dark:bg-amber-200 dark:text-amber-950"
                : "hover:bg-amber-100 dark:hover:bg-stone-800"
            }`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => switchMode("raw")}
            className={`border-l border-amber-300 px-2.5 py-1 dark:border-stone-700 ${
              mode === "raw"
                ? "bg-amber-800 text-white dark:bg-amber-200 dark:text-amber-950"
                : "hover:bg-amber-100 dark:hover:bg-stone-800"
            }`}
          >
            Code
          </button>
        </div>
      </div>

      {mode === "wysiwyg" ? (
        <div>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} />
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder="<p>Write your own HTML…</p>"
          className="w-full rounded-md border border-amber-300 px-3 py-2 font-mono text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      )}
      <p className="text-xs text-stone-500">
        {mode === "raw"
          ? "Advanced mode: type your own HTML/CSS. It's sanitized on save — scripts, embeds, and video/audio tags are stripped; links stay as links."
          : "Videos and music can't be embedded, but you can add a link to them."}
      </p>

      <input type="hidden" name={editorModeFieldName} value={mode} readOnly />
      <input type="hidden" name={bodyFieldName} value={content} readOnly />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded px-2 py-1 text-sm font-medium disabled:opacity-40 ${
        active
          ? "bg-amber-800 text-white dark:bg-amber-200 dark:text-amber-950"
          : "hover:bg-amber-100 dark:hover:bg-stone-800"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div className="h-9 rounded-t-md border border-amber-300 dark:border-stone-700" />;

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-amber-300 bg-amber-50 p-1 dark:border-stone-700 dark:bg-stone-900">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-amber-300 dark:bg-stone-700" />
      <ToolbarButton
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Subheading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-amber-300 dark:bg-stone-700" />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •—
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        &ldquo;
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-amber-300 dark:bg-stone-700" />
      <ToolbarButton
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt("Link URL (https://…)");
          if (!url) return;
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        Link
      </ToolbarButton>
      <ToolbarButton
        label="Image (by URL)"
        onClick={() => {
          const url = window.prompt("Image URL (https://…)");
          if (!url) return;
          editor.chain().focus().setImage({ src: url }).run();
        }}
      >
        Img
      </ToolbarButton>
    </div>
  );
}
