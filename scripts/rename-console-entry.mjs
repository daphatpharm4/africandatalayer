// Finalizes a console-only build: the console entry must serve at the domain
// root of console.africandatalayer.com, where the SPA fallback rewrite
// ("/(.*)" -> /index.html) expects an index.html.
import { existsSync, renameSync } from "node:fs";

const from = "dist/console.html";
const to = "dist/index.html";

if (!existsSync(from)) {
  console.error(
    `[console-build] ${from} not found — was the build run with ADL_BUILD_TARGET=console?`,
  );
  process.exit(1);
}
if (existsSync(to)) {
  console.error(
    `[console-build] ${to} already exists — refusing to overwrite an app build. Run a clean console build.`,
  );
  process.exit(1);
}
renameSync(from, to);
console.log(`[console-build] renamed ${from} -> ${to}`);
