import { z } from "zod";
import { query } from "../db.js";
import { extractVariableNames } from "./variables.js";
import { sanitizeEmailHtml } from "./sanitize.js";

export const KNOWN_TEMPLATE_VARIABLES = [
  "firstName",
  "name",
  "city",
  "trustTier",
  "role",
  "language",
] as const;

export type KnownTemplateVariable = (typeof KNOWN_TEMPLATE_VARIABLES)[number];

export const templateUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits, and hyphens"),
  name: z.string().min(1).max(160),
  subjectEn: z.string().min(1).max(255),
  subjectFr: z.string().min(1).max(255),
  htmlEn: z.string().min(1),
  htmlFr: z.string().min(1),
  textEn: z.string().min(1),
  textFr: z.string().min(1),
  variables: z.array(z.string().min(1).max(64)).optional(),
});

export type TemplateUpsertInput = z.infer<typeof templateUpsertSchema>;

export interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  subjectEn: string;
  subjectFr: string;
  htmlEn: string;
  htmlFr: string;
  textEn: string;
  textFr: string;
  variables: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowFromDb(row: {
  id: string;
  slug: string;
  name: string;
  subject_en: string;
  subject_fr: string;
  html_en: string;
  html_fr: string;
  text_en: string;
  text_fr: string;
  variables: unknown;
  archived: boolean;
  created_at: string;
  updated_at: string;
}): TemplateRow {
  const vars = Array.isArray(row.variables)
    ? row.variables.filter((v): v is string => typeof v === "string")
    : [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subjectEn: row.subject_en,
    subjectFr: row.subject_fr,
    htmlEn: row.html_en,
    htmlFr: row.html_fr,
    textEn: row.text_en,
    textFr: row.text_fr,
    variables: vars,
    archived: row.archived === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function deriveTemplateVariables(input: TemplateUpsertInput): string[] {
  const fromContent = new Set([
    ...extractVariableNames(input.subjectEn),
    ...extractVariableNames(input.subjectFr),
    ...extractVariableNames(input.htmlEn),
    ...extractVariableNames(input.htmlFr),
    ...extractVariableNames(input.textEn),
    ...extractVariableNames(input.textFr),
  ]);
  if (input.variables) {
    for (const name of input.variables) fromContent.add(name);
  }
  return Array.from(fromContent);
}

export async function upsertTemplate(
  input: TemplateUpsertInput,
  createdBy: string,
): Promise<TemplateRow> {
  const variables = deriveTemplateVariables(input);
  const htmlEn = sanitizeEmailHtml(input.htmlEn).html;
  const htmlFr = sanitizeEmailHtml(input.htmlFr).html;
  if (input.id) {
    const result = await query<{
      id: string;
      slug: string;
      name: string;
      subject_en: string;
      subject_fr: string;
      html_en: string;
      html_fr: string;
      text_en: string;
      text_fr: string;
      variables: unknown;
      archived: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE public.email_templates
       SET slug = $2, name = $3,
           subject_en = $4, subject_fr = $5,
           html_en = $6, html_fr = $7,
           text_en = $8, text_fr = $9,
           variables = $10::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, name, subject_en, subject_fr, html_en, html_fr,
                 text_en, text_fr, variables, archived, created_at, updated_at`,
      [
        input.id,
        input.slug,
        input.name,
        input.subjectEn,
        input.subjectFr,
        htmlEn,
        htmlFr,
        input.textEn,
        input.textFr,
        JSON.stringify(variables),
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Template not found for update");
    return rowFromDb(row);
  }

  const result = await query<{
    id: string;
    slug: string;
    name: string;
    subject_en: string;
    subject_fr: string;
    html_en: string;
    html_fr: string;
    text_en: string;
    text_fr: string;
    variables: unknown;
    archived: boolean;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO public.email_templates
       (slug, name, subject_en, subject_fr, html_en, html_fr, text_en, text_fr, variables, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     RETURNING id, slug, name, subject_en, subject_fr, html_en, html_fr,
               text_en, text_fr, variables, archived, created_at, updated_at`,
    [
      input.slug,
      input.name,
      input.subjectEn,
      input.subjectFr,
      htmlEn,
      htmlFr,
      input.textEn,
      input.textFr,
      JSON.stringify(variables),
      createdBy,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Failed to insert template");
  return rowFromDb(row);
}

export async function listTemplates(includeArchived = false): Promise<TemplateRow[]> {
  const result = await query<{
    id: string;
    slug: string;
    name: string;
    subject_en: string;
    subject_fr: string;
    html_en: string;
    html_fr: string;
    text_en: string;
    text_fr: string;
    variables: unknown;
    archived: boolean;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, slug, name, subject_en, subject_fr, html_en, html_fr,
            text_en, text_fr, variables, archived, created_at, updated_at
     FROM public.email_templates
     ${includeArchived ? "" : "WHERE archived = FALSE"}
     ORDER BY updated_at DESC
     LIMIT 200`,
  );
  return result.rows.map(rowFromDb);
}

export async function getTemplateBySlug(slug: string): Promise<TemplateRow | null> {
  const result = await query<{
    id: string;
    slug: string;
    name: string;
    subject_en: string;
    subject_fr: string;
    html_en: string;
    html_fr: string;
    text_en: string;
    text_fr: string;
    variables: unknown;
    archived: boolean;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, slug, name, subject_en, subject_fr, html_en, html_fr,
            text_en, text_fr, variables, archived, created_at, updated_at
     FROM public.email_templates
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  );
  const row = result.rows[0];
  return row ? rowFromDb(row) : null;
}

export async function archiveTemplate(id: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `UPDATE public.email_templates
     SET archived = TRUE, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
