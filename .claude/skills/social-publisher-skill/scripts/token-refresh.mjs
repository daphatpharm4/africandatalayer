#!/usr/bin/env node
import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from './logger.mjs';
import { accounts } from './account-map.mjs';

const log = createLogger();
const envPath = join(process.cwd(), '.env.local');

function parseEnvFile(text) {
  const lines = text.split('\n');
  return {
    lines,
    get: (k) => {
      for (const line of lines) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && m[1] === k) return m[2];
      }
      return undefined;
    },
  };
}

function setEnvLine(lines, key, value) {
  let found = false;
  const next = lines.map((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (m && m[1] === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  return next;
}

async function writeEnvAtomic(lines) {
  const tmp = envPath + '.tmp';
  await writeFile(tmp, lines.join('\n'), 'utf8');
  await rename(tmp, envPath);
}

async function refreshIg({ lines }) {
  const tokenKey = accounts.adl_main.envKeys.accessToken;
  const env = parseEnvFile(lines.join('\n'));
  const current = env.get(tokenKey);
  if (!current) {
    log.warn('IG access token missing, skipping refresh', { key: tokenKey });
    return lines;
  }
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${current}`
  );
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    log.error('IG token refresh failed', body);
    return lines;
  }
  log.info('IG access token refreshed', { expiresInSec: body.expires_in });
  return setEnvLine(lines, tokenKey, body.access_token);
}

async function refreshLi({ lines }) {
  const keys = accounts.adl_org.envKeys;
  const env = parseEnvFile(lines.join('\n'));
  const refreshToken = env.get(keys.refreshToken);
  const expiresAt = env.get(keys.expiresAt);
  if (!refreshToken) {
    log.warn('LinkedIn refresh token missing, skipping refresh');
    return lines;
  }
  if (expiresAt) {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining > 14 * 24 * 3600 * 1000) {
      log.info('LinkedIn token still has >14 days, skipping refresh', { expiresAt });
      return lines;
    }
  }
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.LI_CLIENT_ID ?? '',
    client_secret: process.env.LI_CLIENT_SECRET ?? '',
  });
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    log.error('LinkedIn token refresh failed', body);
    return lines;
  }
  log.info('LinkedIn access token refreshed', { expiresInSec: body.expires_in });
  const newExpiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString();
  let next = setEnvLine(lines, keys.accessToken, body.access_token);
  next = setEnvLine(next, keys.expiresAt, newExpiresAt);
  if (body.refresh_token) next = setEnvLine(next, keys.refreshToken, body.refresh_token);
  return next;
}

async function main() {
  if (!existsSync(envPath)) {
    console.error(`.env.local not found at ${envPath}`);
    process.exit(1);
  }
  const text = await readFile(envPath, 'utf8');
  let lines = text.split('\n');
  lines = await refreshIg({ lines });
  lines = await refreshLi({ lines });
  await writeEnvAtomic(lines);
  log.info('token refresh complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
