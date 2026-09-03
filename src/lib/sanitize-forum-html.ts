import sanitizeHtml from "sanitize-html";

/**
 * The one place forum post HTML is ever allowed to become "trusted"
 * enough to render with dangerouslySetInnerHTML. Runs identically on
 * WYSIWYG (TipTap) output and hand-typed "Code" mode input — the editor
 * a post came from is not a security boundary, this function is. Never
 * skip it, and never trust body_html that didn't come out of it.
 *
 * Design choices, since none of this is enforced by types:
 *  - No <iframe>/<video>/<audio>/<embed>/<object>/<source>/<track> — by
 *    omission from allowedTags, combined with disallowedTagsMode:
 *    "discard" (removes the tag AND its contents, not just the tag) —
 *    this is the actual mechanism behind "players can link videos/music
 *    but not embed them." A link is just an <a>, which IS allowed.
 *  - No <script>/<style>/<link>/<meta>/<base>/<form>/<input>/<button>/
 *    <svg>/<canvas> either, for the usual reasons (script injection,
 *    page-wide style/meta tampering, phishing forms, SVG script/onload).
 *  - No `class` attribute at all. This app is styled with Tailwind
 *    utility classes loaded globally on every page — allowing arbitrary
 *    `class` on user content would let a post style itself with the
 *    SITE'S OWN classes (e.g. `class="fixed inset-0 z-50 bg-black"` as
 *    a full-page overlay), not just its own post body. `style` is
 *    allowed instead, scoped to a safe property allowlist below, for
 *    the Toyhouse-style custom-look posts this is meant to support.
 *  - `style` values are regex-allowlisted per property rather than
 *    passed through — deliberately no `position`, `background-image`
 *    (a `url(...)` background is another embed-shaped hole), or
 *    anything JS-evaluable.
 *  - `href`/`src` schemes are restricted to http/https(/mailto for
 *    links) — blocks `javascript:`, `data:`, `vbscript:`, etc.
 *  - Every link gets target="_blank" rel="noopener noreferrer nofollow
 *    ugc" forced on regardless of what was submitted, so outbound posts
 *    can't hijack window.opener or pass SEO trust.
 */

const COLOR = [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/, /^[a-zA-Z]+$/];
const LENGTH = /^\d{1,4}(\.\d+)?(px|em|rem|%)$/;
const LENGTH_LIST = /^\d{1,4}(\.\d+)?(px|em|rem|%)(\s+\d{1,4}(\.\d+)?(px|em|rem|%)){0,3}$/;

export function sanitizeForumHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      "p",
      "br",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "strike",
      "sub",
      "sup",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "span",
      "div",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "pre",
      "code",
    ],
    disallowedTagsMode: "discard",
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: COLOR,
        "background-color": COLOR,
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)$/],
        "text-align": [/^(left|right|center|justify)$/],
        "font-size": [LENGTH],
        "font-family": [/^[a-zA-Z0-9\s,'"-]+$/],
        border: [/^\d{1,3}px\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/],
        "border-radius": [LENGTH],
        padding: [LENGTH_LIST],
        margin: [LENGTH_LIST],
        width: [LENGTH],
        height: [LENGTH],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        "a",
        { target: "_blank", rel: "noopener noreferrer nofollow ugc" },
        true,
      ),
    },
  });
}
