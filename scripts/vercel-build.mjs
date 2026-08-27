// vercel.json's buildCommand is shared by BOTH Vercel projects (adl-app and
// adl-console) because they deploy from the same repo — Vercel gives
// vercel.json precedence over each project's dashboard build command, so a
// raw "npm run build" here would make adl-console deploy the field app.
// Each project's dashboard sets ADL_BUILD_TARGET, and this dispatcher picks
// the right npm script from it.
import { spawnSync } from "node:child_process";

const target = process.env.ADL_BUILD_TARGET === "console" ? "console" : "app";
const npmScript = target === "console" ? "build:console" : "build";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

console.log(`[vercel-build] ADL_BUILD_TARGET=${process.env.ADL_BUILD_TARGET ?? "(unset)"} -> running "npm run ${npmScript}"`);

const result = spawnSync(npmBin, ["run", npmScript], { stdio: "inherit", shell: false });

process.exit(result.status === null ? 1 : result.status);
