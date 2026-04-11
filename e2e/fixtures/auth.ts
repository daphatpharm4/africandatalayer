import { expect, test as base, type TestInfo } from "@playwright/test";
import { installAdlMocks } from "./mockApi";
import { getBrowserSeedState, roleFromProjectName, type AdlRole } from "./roles";

type AdlFixtures = {
  adlRole: AdlRole;
  gotoApp: (path?: string) => Promise<void>;
};

function seedBrowserState(state: ReturnType<typeof getBrowserSeedState>) {
  for (const [key, value] of Object.entries(state.localStorage)) {
    window.localStorage.setItem(key, value);
  }

  if (state.lowEndHints) {
    try {
      Object.defineProperty(window.navigator, "deviceMemory", {
        configurable: true,
        get: () => state.lowEndHints?.deviceMemoryGb,
      });
    } catch {
      // Ignore when the browser refuses the override.
    }
    try {
      Object.defineProperty(window.navigator, "hardwareConcurrency", {
        configurable: true,
        get: () => state.lowEndHints?.hardwareConcurrency,
      });
    } catch {
      // Ignore when the browser refuses the override.
    }
  }
}

export const test = base.extend<AdlFixtures>({
  // Playwright fixture callbacks require an object-destructured first parameter.
  // eslint-disable-next-line no-empty-pattern
  adlRole: async ({}, use, testInfo: TestInfo) => {
    await use(roleFromProjectName(testInfo.project.name));
  },
  page: async ({ page }, use, testInfo: TestInfo) => {
    const role = roleFromProjectName(testInfo.project.name);
    await installAdlMocks(page, role);
    await page.addInitScript(seedBrowserState, getBrowserSeedState(role));
    await use(page);
  },
  gotoApp: async ({ page }, use) => {
    await use(async (path = "/") => {
      await page.goto(path);
    });
  },
});

export { expect };
