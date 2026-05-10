import assert from "node:assert/strict";
import test from "node:test";
import { htmlToPlainText, sanitizeEmailHtml } from "../lib/server/email/sanitize.js";

test("sanitizeEmailHtml strips script tags + content", () => {
  const result = sanitizeEmailHtml('<p>Hi</p><script>alert(1)</script>');
  assert.equal(result.html.includes("<script>"), false);
  assert.equal(result.html.includes("alert(1)"), false);
  assert.ok(result.removedTags.includes("script"));
});

test("sanitizeEmailHtml strips style tags + content", () => {
  const result = sanitizeEmailHtml('<p>Hi</p><style>body{display:none}</style>');
  assert.equal(result.html.includes("<style>"), false);
  assert.equal(result.html.includes("display:none"), false);
});

test("sanitizeEmailHtml strips inline event handlers", () => {
  const result = sanitizeEmailHtml('<p onclick="alert(1)">Hi</p>');
  assert.equal(result.html.includes("onclick"), false);
  assert.ok(result.removedAttrs.some((a) => a.includes("onclick")));
});

test("sanitizeEmailHtml drops disallowed tags", () => {
  const result = sanitizeEmailHtml('<iframe src="https://x"></iframe><p>ok</p>');
  assert.equal(result.html.includes("<iframe"), false);
  assert.ok(result.removedTags.includes("iframe"));
  assert.ok(result.html.includes("<p>ok</p>"));
});

test("sanitizeEmailHtml rejects javascript: hrefs", () => {
  const result = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>');
  assert.equal(result.html.includes("javascript:"), false);
});

test("sanitizeEmailHtml allows https hrefs and forces rel=noopener on target", () => {
  const result = sanitizeEmailHtml('<a href="https://example.com" target="_blank">x</a>');
  assert.ok(result.html.includes('href="https://example.com"'));
  assert.ok(result.html.includes('target="_blank"'));
  assert.ok(result.html.includes('rel="noopener noreferrer"'));
});

test("sanitizeEmailHtml allows mailto + tel", () => {
  const mailto = sanitizeEmailHtml('<a href="mailto:a@b.co">m</a>');
  assert.ok(mailto.html.includes('href="mailto:a@b.co"'));
  const tel = sanitizeEmailHtml('<a href="tel:+1">t</a>');
  assert.ok(tel.html.includes('href="tel:+1"'));
});

test("sanitizeEmailHtml strips javascript inside style", () => {
  const result = sanitizeEmailHtml('<p style="color:red;background:url(javascript:alert(1))">x</p>');
  assert.equal(result.html.includes("javascript:"), false);
});

test("sanitizeEmailHtml preserves table tags + safe attrs", () => {
  const result = sanitizeEmailHtml(
    '<table border="0" cellpadding="0" cellspacing="0"><tr><td colspan="2">x</td></tr></table>',
  );
  assert.ok(result.html.includes("<table"));
  assert.ok(result.html.includes("<tr>"));
  assert.ok(result.html.includes('colspan="2"'));
});

test("htmlToPlainText converts blocks to newlines and strips entities", () => {
  const text = htmlToPlainText('<h2>Hello</h2><p>world &amp; rules</p><ul><li>one</li><li>two</li></ul>');
  assert.match(text, /Hello/);
  assert.match(text, /world & rules/);
  assert.match(text, /one\s*\n\s*two/);
});

test("htmlToPlainText handles <br> as newlines", () => {
  const text = htmlToPlainText("a<br>b<br/>c");
  assert.match(text, /a\nb\nc/);
});
