import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const accountsPath = join(here, '..', 'reference', 'accounts.json');
const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'));

export function resolveAccount(name, env = process.env) {
  const config = accounts[name];
  if (!config) {
    return {
      ok: false,
      error: `unknown account "${name}". Known: ${Object.keys(accounts).join(', ')}`,
    };
  }
  const credentials = {};
  const missing = [];
  for (const [field, envKey] of Object.entries(config.envKeys)) {
    if (!env[envKey]) {
      missing.push(envKey);
    } else {
      credentials[field] = env[envKey];
    }
  }
  if (missing.length > 0) {
    return {
      ok: false,
      error: `account "${name}" missing env keys: ${missing.join(', ')}`,
    };
  }
  return { ok: true, value: { name, platform: config.platform, credentials } };
}

export function listRequiredEnvKeys(accountNames) {
  const keys = new Set();
  for (const name of accountNames) {
    const config = accounts[name];
    if (!config) continue;
    for (const envKey of Object.values(config.envKeys)) {
      keys.add(envKey);
    }
  }
  return Array.from(keys);
}

export { accounts };
