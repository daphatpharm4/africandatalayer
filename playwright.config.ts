import { defineConfig, devices } from "@playwright/test";

const docsMode = process.env.PW_DOCS === "1";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: docsMode ? "on" : "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "agent-mobile",
      testMatch: ["e2e/smoke/agent.smoke.spec.ts", "e2e/docs/agent-roadmap.spec.ts"],
      use: {
        ...devices["Pixel 5"],
        locale: "en-US",
        timezoneId: "Africa/Douala",
        geolocation: { latitude: 4.0877, longitude: 9.7394 },
        permissions: ["geolocation"],
      },
    },
    {
      name: "admin-desktop",
      testMatch: ["e2e/smoke/admin.smoke.spec.ts", "e2e/docs/admin-roadmap.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        locale: "en-US",
        timezoneId: "Africa/Douala",
      },
    },
    {
      name: "client-desktop",
      testMatch: ["e2e/smoke/client.smoke.spec.ts", "e2e/smoke/help-center.smoke.spec.ts", "e2e/docs/client-roadmap.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        locale: "en-US",
        timezoneId: "Africa/Douala",
      },
    },
  ],
});
