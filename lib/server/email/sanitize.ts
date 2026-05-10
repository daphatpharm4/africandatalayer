// Minimal email-safe HTML sanitizer (no deps).
// Goal: strip script + event handlers + dangerous URL schemes from operator-
// authored bodies before they hit user inboxes. Keeps the markup small set
// of tags + attributes that render reliably across email clients.

const ALLOWED_TAGS = new Set([
  "a", "b", "br", "div", "em", "h1", "h2", "h3", "h4", "hr", "i", "li",
  "ol", "p", "span", "strong", "table", "tbody", "td", "th", "thead", "tr",
  "u", "ul", "img", "blockquote", "pre", "code",
]);

const ALLOWED_ATTRS_BY_TAG: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  td: new Set(["colspan", "rowspan", "align"]),
  th: new Set(["colspan", "rowspan", "align"]),
  table: new Set(["align", "border", "cellpadding", "cellspacing", "width"]),
};

const GLOBAL_ALLOWED_ATTRS = new Set(["style", "class"]);

const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

interface SanitizeResult {
  html: string;
  removedTags: string[];
  removedAttrs: string[];
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return true;
  try {
    const url = new URL(trimmed);
    return SAFE_URL_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

function isSafeStyle(value: string): boolean {
  // Reject anything that looks like a JavaScript URL or expression.
  const lower = value.toLowerCase();
  if (lower.includes("javascript:")) return false;
  if (lower.includes("expression(")) return false;
  if (lower.includes("@import")) return false;
  if (lower.includes("url(") && !/url\(\s*["']?(https?:|mailto:|tel:|\/|#|cid:)/i.test(value)) return false;
  return true;
}

function escape(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const TAG_PATTERN = /<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const ATTR_PATTERN = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

export function sanitizeEmailHtml(input: string): SanitizeResult {
  const removedTags: string[] = [];
  const removedAttrs: string[] = [];

  // Strip script + style blocks wholesale (content + tags).
  let working = input
    .replace(/<script\b[\s\S]*?<\/script>/gi, () => {
      removedTags.push("script");
      return "";
    })
    .replace(/<style\b[\s\S]*?<\/style>/gi, () => {
      removedTags.push("style");
      return "";
    });

  working = working.replace(TAG_PATTERN, (match, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) {
      removedTags.push(name);
      return "";
    }

    const isClosing = match.startsWith("</");
    if (isClosing) return `</${name}>`;

    const allowedForTag = ALLOWED_ATTRS_BY_TAG[name] ?? new Set<string>();
    const safeAttrs: string[] = [];
    const attrIter = rawAttrs.matchAll(ATTR_PATTERN);
    for (const match of attrIter) {
      const attrName = match[1].toLowerCase();
      const rawValue = match[2] ?? match[3] ?? match[4] ?? "";

      if (attrName.startsWith("on")) {
        removedAttrs.push(`${name}.${attrName}`);
        continue;
      }
      if (!allowedForTag.has(attrName) && !GLOBAL_ALLOWED_ATTRS.has(attrName)) {
        removedAttrs.push(`${name}.${attrName}`);
        continue;
      }
      if (attrName === "href" || attrName === "src") {
        if (!isSafeUrl(rawValue)) {
          removedAttrs.push(`${name}.${attrName}`);
          continue;
        }
      }
      if (attrName === "style" && !isSafeStyle(rawValue)) {
        removedAttrs.push(`${name}.${attrName}`);
        continue;
      }
      if (attrName === "target") {
        // Force rel=noopener on external targets.
        safeAttrs.push(`target="${escape(rawValue)}"`);
        if (!/\brel\s*=/i.test(rawAttrs)) {
          safeAttrs.push(`rel="noopener noreferrer"`);
        }
        continue;
      }
      safeAttrs.push(`${attrName}="${escape(rawValue)}"`);
    }
    const attrString = safeAttrs.length > 0 ? " " + safeAttrs.join(" ") : "";
    const isVoid = name === "br" || name === "hr" || name === "img";
    return `<${name}${attrString}${isVoid ? " />" : ">"}`;
  });

  // Drop dangling angle brackets that didn't match (defensive).
  working = working.replace(/<(?![\s\S]*?>)/g, "&lt;");

  return { html: working, removedTags, removedAttrs };
}

const TEXT_BLOCK_TAGS = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "li", "tr", "blockquote", "pre",
]);

export function htmlToPlainText(html: string): string {
  const sanitized = sanitizeEmailHtml(html).html;
  let text = sanitized
    .replace(/<br\s*\/?>(?:\s*)/gi, "\n")
    .replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, raw: string) => {
      const tag = raw.toLowerCase();
      return TEXT_BLOCK_TAGS.has(tag) ? "\n" : "";
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}
