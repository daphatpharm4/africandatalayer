import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CompaniesAdminPanel from "../components/Screens/CompaniesAdminPanel.js";
import ConsoleAuthScreen from "../components/Console/ConsoleAuthScreen.js";

test("ADL company cockpit exposes company access and data controls", () => {
  const html = renderToStaticMarkup(React.createElement(CompaniesAdminPanel, { language: "en" }));
  assert.match(html, /Platform access/);
  assert.match(html, />Companies</);
  assert.match(html, /Search companies or users/);
  assert.match(html, />Refresh</);
  assert.match(html, /Loading companies/);
});

test("console uses a dedicated company sign-in screen", () => {
  const html = renderToStaticMarkup(React.createElement(ConsoleAuthScreen, {
    language: "en",
    inviteMode: false,
    onAuthenticated: () => {},
  }));
  assert.match(html, /Company Console/);
  assert.match(html, /Sign in to your company/);
  assert.match(html, /Open company console/);
  assert.doesNotMatch(html, /pharmacy|fuel station|mobile money/i);
});

test("invitation links offer company-specific account creation", () => {
  const html = renderToStaticMarkup(React.createElement(ConsoleAuthScreen, {
    language: "en",
    inviteMode: true,
    onAuthenticated: () => {},
  }));
  assert.match(html, /Create your invited company account/);
  assert.match(html, /Create account and join company/);
  assert.match(html, /use the email address that received the invitation/i);
});
