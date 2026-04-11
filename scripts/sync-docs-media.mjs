import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const sourceRoot = path.join(rootDir, 'artifacts', 'playwright', 'docs');
const targetRoot = path.join(rootDir, 'public', 'docs-media');
const roles = ['agent', 'admin', 'client'];

async function copyRole(role) {
  const sourceDir = path.join(sourceRoot, role);
  const targetDir = path.join(targetRoot, role);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
          force: true,
        }),
      ),
  );
}

async function main() {
  await mkdir(targetRoot, { recursive: true });

  const copiedRoles = [];
  for (const role of roles) {
    try {
      await copyRole(role);
      copiedRoles.push(role);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  if (copiedRoles.length === 0) {
    console.log('[docs-media] No screenshot directories found under artifacts/playwright/docs.');
    return;
  }

  console.log(`[docs-media] Synced screenshot evidence for: ${copiedRoles.join(', ')}`);
}

await main();
