"use client";

import { useRef } from "react";

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
 * Nothing here is a security boundary. bbcodeToHtml() (src/lib/
 * bbcode.ts) is what turns whatever ends up in this textarea into safe
 * HTML server-side; the toolbar is purely a typing convenience.
 */
export function BBCodeEditor({
  name = "body",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-stone-300 bg-stone-50 p-1.5">
        <ToolbarButton label="Bold" onClick={() => wrapSelection("[b]", "[/b]")}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => wrapSelection("[i]", "[/i]")}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => wrapSelection("[u]", "[/u]")}>
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" onClick={() => wrapSelection("[s]", "[/s]")}>
          <span className="line-through">S</span>
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Quote" onClick={() => wrapSelection("[quote]", "[/quote]")}>
          &ldquo;
        </ToolbarButton>
        <ToolbarButton label="Horizontal rule" onClick={() => insertAtCursor("\n[hr]\n")}>
          —
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Align left" onClick={() => wrapSelection("[align=left]", "[/align]")}>
          ⬅
        </ToolbarButton>
        <ToolbarButton label="Align center" onClick={() => wrapSelection("[align=center]", "[/align]")}>
          ⬌
        </ToolbarButton>
        <ToolbarButton label="Align right" onClick={() => wrapSelection("[align=right]", "[/align]")}>
          ➡
        </ToolbarButton>
        <Divider />
        <label className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-stone-700 hover:bg-stone-200">
          Font Size
          <select
            aria-label="Font size"
            value=""
            onChange={(e) => {
              const size = e.target.value;
              e.target.value = "";
              if (size) wrapSelection(`[size=${size}]`, "[/size]");
            }}
            className="ml-1 rounded border border-stone-300 bg-white text-xs"
          >
            <option value="" disabled />
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
          </select>
        </label>
        <label className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-stone-700 hover:bg-stone-200">
          Font Color
          <input
            aria-label="Font color"
            type="color"
            defaultValue="#000000"
            onChange={(e) => wrapSelection(`[color=${e.target.value}]`, "[/color]")}
            className="ml-1 h-5 w-6 cursor-pointer rounded border border-stone-300 p-0"
          />
        </label>
      </div>

      <textarea
        ref={textareaRef}
        name={name}
        defaultValue={defaultValue}
        rows={8}
        placeholder="Write something..."
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none"
      />
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
      className="rounded px-2.5 py-1 text-sm font-medium text-stone-700 hover:bg-stone-200"
    >
      {children}
    </button>
  );
}
