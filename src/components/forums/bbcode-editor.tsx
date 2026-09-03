"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  SeparatorHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
  Eye,
  PenLine,
} from "lucide-react";
import { bbcodeToHtml } from "@/lib/bbcode";

/**
 * A classic forum-style BBCode editor: a plain textarea plus a toolbar
 * that wraps the current selection in BBCode tags. There's no WYSIWYG
 * rendering here and no separate "advanced" mode — the textarea is
 * always raw BBCode, so a player can type tags by hand instead of
 * clicking a button and gets the exact same result either way. The
 * textarea is uncontrolled (defaultValue, manipulated via ref) rather
 * than React state, matching how the browser's own text-editing already
 * works — the form reads its value straight off the DOM on submit.
 *
 * The Preview toggle renders bbcodeToHtml() (pure, safe to run in the
 * browser — it never touches the DOM or trusts anything beyond the
 * textarea's own text) against the current draft. The textarea stays
 * mounted (just hidden) while previewing, so switching back doesn't
 * lose anything.
 *
 * Nothing here is a security boundary. bbcodeToHtml() is what turns
 * whatever ends up in this textarea into safe HTML server-side too, on
 * submit — the toolbar and preview are purely conveniences.
 */
export function BBCodeEditor({
  name = "body",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  function wrapSelection(open: string, close: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    el.value = value.slice(0, selectionStart) + open + selected + close + value.slice(selectionEnd);
    el.focus();
    if (selected.length > 0) {
      el.setSelectionRange(selectionStart + open.length, selectionStart + open.length + selected.length);
    } else {
      const cursor = selectionStart + open.length;
      el.setSelectionRange(cursor, cursor);
    }
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    el.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    const cursor = selectionStart + text.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  function togglePreview() {
    if (previewHtml !== null) {
      setPreviewHtml(null);
      return;
    }
    setPreviewHtml(bbcodeToHtml(textareaRef.current?.value ?? ""));
  }

  const isPreviewing = previewHtml !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-300 bg-stone-50 p-2">
        <div className={`flex flex-wrap items-center gap-1 ${isPreviewing ? "pointer-events-none opacity-40" : ""}`}>
          <ToolbarButton label="Bold" onClick={() => wrapSelection("[b]", "[/b]")}>
            <Bold size={17} />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => wrapSelection("[i]", "[/i]")}>
            <Italic size={17} />
          </ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => wrapSelection("[u]", "[/u]")}>
            <Underline size={17} />
          </ToolbarButton>
          <ToolbarButton label="Strikethrough" onClick={() => wrapSelection("[s]", "[/s]")}>
            <Strikethrough size={17} />
          </ToolbarButton>
          <Divider />
          <ToolbarButton label="Quote" onClick={() => wrapSelection("[quote]", "[/quote]")}>
            <Quote size={17} />
          </ToolbarButton>
          <ToolbarButton label="Horizontal rule" onClick={() => insertAtCursor("\n[hr]\n")}>
            <SeparatorHorizontal size={17} />
          </ToolbarButton>
          <Divider />
          <ToolbarButton label="Align left" onClick={() => wrapSelection("[align=left]", "[/align]")}>
            <AlignLeft size={17} />
          </ToolbarButton>
          <ToolbarButton label="Align center" onClick={() => wrapSelection("[align=center]", "[/align]")}>
            <AlignCenter size={17} />
          </ToolbarButton>
          <ToolbarButton label="Align right" onClick={() => wrapSelection("[align=right]", "[/align]")}>
            <AlignRight size={17} />
          </ToolbarButton>
          <Divider />
          <label className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-200">
            <Type size={17} />
            <select
              aria-label="Font size"
              value=""
              disabled={isPreviewing}
              onChange={(e) => {
                const size = e.target.value;
                e.target.value = "";
                if (size) wrapSelection(`[size=${size}]`, "[/size]");
              }}
              className="rounded border border-stone-300 bg-white text-xs"
            >
              <option value="" disabled />
              <option value="1">Small</option>
              <option value="3">Normal</option>
              <option value="5">Large</option>
              <option value="7">Huge</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-200">
            <Palette size={17} />
            <input
              aria-label="Font color"
              type="color"
              defaultValue="#000000"
              disabled={isPreviewing}
              onChange={(e) => wrapSelection(`[color=${e.target.value}]`, "[/color]")}
              className="h-5 w-6 cursor-pointer rounded border border-stone-300 p-0"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={togglePreview}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          {isPreviewing ? (
            <>
              <PenLine size={16} />
              Write
            </>
          ) : (
            <>
              <Eye size={16} />
              Preview
            </>
          )}
        </button>
      </div>

      <textarea
        ref={textareaRef}
        name={name}
        defaultValue={defaultValue}
        rows={10}
        placeholder="Write something..."
        hidden={isPreviewing}
        className="w-full rounded-md border border-stone-300 px-4 py-3 text-base leading-relaxed focus:outline-none"
      />

      {isPreviewing ? (
        <div className="min-h-[10rem] rounded-md border border-stone-300 bg-white px-4 py-3">
          {previewHtml.trim().length > 0 ? (
            <div className="forum-content text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <p className="text-sm text-stone-400">Nothing to preview yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-stone-300" />;
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md px-2.5 py-1.5 text-stone-700 hover:bg-stone-200"
    >
      {children}
    </button>
  );
}
