/**
 * The one place forum post BBCode is ever turned into HTML trusted
 * enough to render with dangerouslySetInnerHTML. Runs on every insert/
 * update of forum_posts.body_raw, in BBCodeEditor's plain textarea (see
 * src/components/forums/bbcode-editor.tsx) — clicking a toolbar button
 * and hand-typing a tag do exactly the same thing (insert text into the
 * textarea), so there's no separate "advanced" mode to maintain; typing
 * BBCode directly already *is* the advanced option.
 *
 * This is a stricter security model than sanitizing arbitrary submitted
 * HTML (the previous approach, src/lib/sanitize-forum-html.ts, now
 * unused — see 0022_forum_bbcode_and_views.sql): a player never submits
 * HTML at all. Every HTML tag/attribute in the output below is written
 * by this file, not by the player — the parser only ever recognizes a
 * fixed, hardcoded set of BBCode tags (TAG list below) and drops
 * anything else to escaped plain text. There is no way for a player to
 * introduce a new HTML tag, a `class` attribute, an event handler, or a
 * `javascript:`/`data:` URL, because none of those are things this file
 * ever writes — not because they were filtered out of something wider.
 *
 * Deliberately no [video]/[audio]/[iframe]/[embed] tag exists — matching
 * "players can link videos/music but not embed them." [url] is a plain
 * <a>; there's simply no BBCode tag that produces an <iframe>/<video>/
 * <audio> element to begin with.
 */

const TAG_NAMES = new Set([
  "b",
  "i",
  "u",
  "s",
  "sup",
  "sub",
  "h1",
  "h2",
  "h3",
  "quote",
  "hr",
  "align",
  "size",
  "color",
  "highlight",
  "font",
  "url",
  "img",
]);
const VOID_TAGS = new Set(["hr"]);
const RAW_CONTENT_TAGS = new Set(["img"]);

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|[a-zA-Z]+)$/;
const FONT_RE = /^[a-zA-Z0-9\s,'"-]{1,60}$/;
const ALIGN_RE = /^(left|center|right|justify)$/;
const URL_RE = /^(https?:\/\/|mailto:)\S+$/i;
const SIZE_MAP: Record<string, string> = {
  "1": "0.7em",
  "2": "0.85em",
  "3": "1em",
  "4": "1.15em",
  "5": "1.3em",
  "6": "1.6em",
  "7": "2em",
};

type Token =
  | { kind: "text"; text: string }
  | { kind: "open"; name: string; attr: string | null; raw: string }
  | { kind: "close"; name: string; raw: string }
  | { kind: "void"; name: string; raw: string };

const TAG_TOKEN_RE = /\[(\/?)(\w+)(=(?:"[^"]*"|'[^']*'|[^\]]*))?\]/g;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_TOKEN_RE.lastIndex = 0;
  while ((match = TAG_TOKEN_RE.exec(src))) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", text: src.slice(lastIndex, match.index) });
    }
    const [full, closing, nameRaw, attrPart] = match;
    const name = nameRaw.toLowerCase();
    if (!TAG_NAMES.has(name)) {
      tokens.push({ kind: "text", text: full });
    } else if (closing) {
      tokens.push({ kind: "close", name, raw: full });
    } else if (VOID_TAGS.has(name)) {
      tokens.push({ kind: "void", name, raw: full });
    } else {
      let attr: string | null = null;
      if (attrPart) {
        attr = attrPart.slice(1);
        const quoted =
          (attr.startsWith('"') && attr.endsWith('"')) || (attr.startsWith("'") && attr.endsWith("'"));
        if (quoted) attr = attr.slice(1, -1);
      }
      tokens.push({ kind: "open", name, attr, raw: full });
    }
    lastIndex = TAG_TOKEN_RE.lastIndex;
  }
  if (lastIndex < src.length) {
    tokens.push({ kind: "text", text: src.slice(lastIndex) });
  }
  return tokens;
}

type BbNode =
  | { type: "text"; value: string }
  | { type: "raw"; name: string; value: string }
  | { type: "element"; name: string; attr: string | null; children: BbNode[] };

// Stack-free recursive-descent build over the flat token list — `parseUntil`
// consumes tokens (via the shared `pos` closure) until it finds a close
// token matching `stopName`, or runs out of tokens (an unclosed tag is
// auto-closed at EOF, standard BBCode-forum behavior). A close token with
// no matching opener on the stack falls through as literal text.
function buildTree(tokens: Token[]): BbNode[] {
  let pos = 0;

  function parseUntil(stopName: string | null): BbNode[] {
    const nodes: BbNode[] = [];
    while (pos < tokens.length) {
      const t = tokens[pos];

      if (t.kind === "close") {
        if (t.name === stopName) {
          pos++;
          return nodes;
        }
        nodes.push({ type: "text", value: t.raw });
        pos++;
        continue;
      }

      if (t.kind === "text") {
        nodes.push({ type: "text", value: t.text });
        pos++;
        continue;
      }

      if (t.kind === "void") {
        nodes.push({ type: "element", name: t.name, attr: null, children: [] });
        pos++;
        continue;
      }

      // open
      const name = t.name;
      const attr = t.attr;
      pos++;

      if (RAW_CONTENT_TAGS.has(name) || (name === "url" && attr === null)) {
        let raw = "";
        while (pos < tokens.length) {
          const inner = tokens[pos];
          if (inner.kind === "close" && inner.name === name) {
            pos++;
            break;
          }
          raw += inner.kind === "text" ? inner.text : inner.raw;
          pos++;
        }
        nodes.push({ type: "raw", name, value: raw });
      } else {
        const children = parseUntil(name);
        nodes.push({ type: "element", name, attr, children });
      }
    }
    return nodes;
  }

  return parseUntil(null);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function renderNodes(nodes: BbNode[]): string {
  return nodes.map(renderNode).join("");
}

function renderNode(node: BbNode): string {
  if (node.type === "text") {
    return escapeHtml(node.value).replace(/\r\n|\r|\n/g, "<br>");
  }

  if (node.type === "raw") {
    const value = node.value.trim();
    if (node.name === "img") {
      if (!URL_RE.test(value) || !/^https?:\/\//i.test(value)) return "";
      return `<img src="${escapeAttr(value)}" alt="" />`;
    }
    // bare [url]https://…[/url] — value is used as both href and text
    if (!URL_RE.test(value)) return escapeHtml(node.value);
    return `<a href="${escapeAttr(value)}" target="_blank" rel="noopener noreferrer nofollow ugc">${escapeHtml(node.value)}</a>`;
  }

  const inner = renderNodes(node.children);
  switch (node.name) {
    case "b":
      return `<strong>${inner}</strong>`;
    case "i":
      return `<em>${inner}</em>`;
    case "u":
      return `<u>${inner}</u>`;
    case "s":
      return `<s>${inner}</s>`;
    case "sup":
      return `<sup>${inner}</sup>`;
    case "sub":
      return `<sub>${inner}</sub>`;
    case "h1":
      return `<h1>${inner}</h1>`;
    case "h2":
      return `<h2>${inner}</h2>`;
    case "h3":
      return `<h3>${inner}</h3>`;
    case "quote":
      return `<blockquote>${inner}</blockquote>`;
    case "hr":
      return `<hr />`;
    case "align": {
      const value = (node.attr ?? "").trim().toLowerCase();
      if (!ALIGN_RE.test(value)) return inner;
      return `<div style="text-align:${value}">${inner}</div>`;
    }
    case "size": {
      const value = SIZE_MAP[(node.attr ?? "").trim()];
      if (!value) return inner;
      return `<span style="font-size:${value}">${inner}</span>`;
    }
    case "color": {
      const value = (node.attr ?? "").trim();
      if (!COLOR_RE.test(value)) return inner;
      return `<span style="color:${value}">${inner}</span>`;
    }
    case "highlight": {
      const value = (node.attr ?? "").trim();
      if (!COLOR_RE.test(value)) return inner;
      return `<span style="background-color:${value}">${inner}</span>`;
    }
    case "font": {
      const value = (node.attr ?? "").trim();
      if (!FONT_RE.test(value)) return inner;
      return `<span style="font-family:${value.replace(/"/g, "'")}">${inner}</span>`;
    }
    case "url": {
      const href = (node.attr ?? "").trim();
      if (!URL_RE.test(href)) return inner;
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow ugc">${inner}</a>`;
    }
    default:
      return inner;
  }
}

export function bbcodeToHtml(source: string): string {
  const tokens = tokenize(source);
  const tree = buildTree(tokens);
  return renderNodes(tree);
}
