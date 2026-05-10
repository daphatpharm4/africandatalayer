import { logWarn } from "../logger.js";

const VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]{0,63})\}/g;

export interface VariableContext {
  values: Record<string, string | number | null | undefined>;
  htmlSafeKeys?: ReadonlySet<string>;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function coerce(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return value;
}

export interface RenderResult {
  output: string;
  unknownVariables: string[];
}

export function renderTemplateString(
  template: string,
  context: VariableContext,
  options: { escape: "html" | "text" } = { escape: "text" },
): RenderResult {
  const unknownVariables: string[] = [];
  const output = template.replace(VARIABLE_PATTERN, (_match, rawName: string) => {
    const name = rawName;
    if (!Object.prototype.hasOwnProperty.call(context.values, name)) {
      if (!unknownVariables.includes(name)) unknownVariables.push(name);
      return "";
    }
    const value = coerce(context.values[name]);
    if (options.escape === "text") return value;
    if (context.htmlSafeKeys?.has(name)) return value;
    return escapeHtml(value);
  });
  return { output, unknownVariables };
}

export function extractVariableNames(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    seen.add(match[1]);
  }
  return Array.from(seen);
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  unknownVariables: string[];
}

export function renderEmailWithVariables(
  template: { subject: string; html: string; text: string },
  context: VariableContext,
): RenderedEmail {
  const subject = renderTemplateString(template.subject, context, { escape: "text" });
  const html = renderTemplateString(template.html, context, { escape: "html" });
  const text = renderTemplateString(template.text, context, { escape: "text" });

  const unknown = Array.from(
    new Set([...subject.unknownVariables, ...html.unknownVariables, ...text.unknownVariables]),
  );
  if (unknown.length > 0) {
    logWarn("email.unknown_variables", { variables: unknown });
  }

  return {
    subject: subject.output,
    html: html.output,
    text: text.output,
    unknownVariables: unknown,
  };
}
