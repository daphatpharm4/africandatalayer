import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import type { AdlRole } from "./roles";

const DOCS_ARTIFACT_ROOT = path.join(process.cwd(), "artifacts", "playwright", "docs");
const preparedRoleDirectories = new Set<AdlRole>();

async function ensureRoleDirectory(role: AdlRole): Promise<string> {
  const target = path.join(DOCS_ARTIFACT_ROOT, role);
  if (!preparedRoleDirectories.has(role)) {
    await rm(target, { recursive: true, force: true });
    preparedRoleDirectories.add(role);
  }
  await mkdir(target, { recursive: true });
  return target;
}

export async function captureRolePage(page: Page, role: AdlRole, fileName: string): Promise<void> {
  const targetDir = await ensureRoleDirectory(role);
  await page.screenshot({
    path: path.join(targetDir, fileName),
    fullPage: true,
  });
}

export async function captureRoleRegion(locator: Locator, role: AdlRole, fileName: string): Promise<void> {
  const targetDir = await ensureRoleDirectory(role);
  await locator.screenshot({
    path: path.join(targetDir, fileName),
  });
}
