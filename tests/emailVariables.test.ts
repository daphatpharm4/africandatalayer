import assert from "node:assert/strict";
import test from "node:test";
import {
  extractVariableNames,
  renderEmailWithVariables,
  renderTemplateString,
} from "../lib/server/email/variables.js";
import { deriveTemplateVariables, templateUpsertSchema } from "../lib/server/email/templates.js";

test("renderTemplateString substitutes known variables", () => {
  const result = renderTemplateString("Hello {firstName}", {
    values: { firstName: "Alice" },
  });
  assert.equal(result.output, "Hello Alice");
  assert.deepEqual(result.unknownVariables, []);
});

test("renderTemplateString returns empty for unknown vars and reports them", () => {
  const result = renderTemplateString("Hi {firstName}, your city is {city}", {
    values: { firstName: "Bob" },
  });
  assert.equal(result.output, "Hi Bob, your city is ");
  assert.deepEqual(result.unknownVariables, ["city"]);
});

test("renderTemplateString HTML-escapes by default in html mode", () => {
  const result = renderTemplateString("<p>Hi {name}</p>", {
    values: { name: "<script>alert(1)</script>" },
  }, { escape: "html" });
  assert.ok(result.output.includes("&lt;script&gt;"));
  assert.ok(!result.output.includes("<script>"));
});

test("renderTemplateString skips escape when key is htmlSafe", () => {
  const result = renderTemplateString("<p>{rawHtml}</p>", {
    values: { rawHtml: "<strong>bold</strong>" },
    htmlSafeKeys: new Set(["rawHtml"]),
  }, { escape: "html" });
  assert.ok(result.output.includes("<strong>bold</strong>"));
});

test("renderEmailWithVariables collects unknown vars across subject + html + text", () => {
  const rendered = renderEmailWithVariables(
    {
      subject: "Hi {firstName}",
      html: "<p>City: {city}</p>",
      text: "City: {city}, Trust: {trust}",
    },
    { values: { firstName: "Carol" } },
  );
  assert.equal(rendered.subject, "Hi Carol");
  assert.equal(rendered.text, "City: , Trust: ");
  assert.deepEqual(rendered.unknownVariables.sort(), ["city", "trust"]);
});

test("extractVariableNames returns unique names only", () => {
  const names = extractVariableNames("{a} {b} {a} {c}");
  assert.deepEqual(names.sort(), ["a", "b", "c"]);
});

test("extractVariableNames ignores malformed placeholders", () => {
  const names = extractVariableNames("{} {1foo} {valid_name}");
  assert.deepEqual(names, ["valid_name"]);
});

test("templateUpsertSchema enforces slug shape", () => {
  const ok = templateUpsertSchema.safeParse({
    slug: "welcome-agent",
    name: "Welcome agent",
    subjectEn: "Hi",
    subjectFr: "Salut",
    htmlEn: "<p>Hi</p>",
    htmlFr: "<p>Salut</p>",
    textEn: "Hi",
    textFr: "Salut",
  });
  assert.equal(ok.success, true);
  const bad = templateUpsertSchema.safeParse({
    slug: "Welcome Agent",
    name: "Welcome agent",
    subjectEn: "Hi",
    subjectFr: "Salut",
    htmlEn: "<p>Hi</p>",
    htmlFr: "<p>Salut</p>",
    textEn: "Hi",
    textFr: "Salut",
  });
  assert.equal(bad.success, false);
});

test("deriveTemplateVariables collects vars from all 6 fields plus explicit list", () => {
  const vars = deriveTemplateVariables({
    slug: "x",
    name: "x",
    subjectEn: "Hi {firstName}",
    subjectFr: "Salut {firstName}",
    htmlEn: "<p>{city}</p>",
    htmlFr: "<p>{city}</p>",
    textEn: "Trust {trustTier}",
    textFr: "Confiance {trustTier}",
    variables: ["customField"],
  });
  assert.deepEqual(vars.sort(), ["city", "customField", "firstName", "trustTier"]);
});
