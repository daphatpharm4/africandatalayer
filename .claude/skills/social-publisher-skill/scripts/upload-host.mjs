import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, isAbsolute, basename } from 'node:path';
import { put, del } from '@vercel/blob';

const defaultBlob = { put, del };

export async function uploadAssets({ assetPaths, manifestDir, slug, blob = defaultBlob, token }) {
  const urls = [];
  for (const assetPath of assetPaths) {
    if (isAbsolute(assetPath)) {
      throw new Error(
        `asset paths must be relative to the manifest directory: ${assetPath}`
      );
    }
    const fullPath = join(manifestDir, assetPath);
    if (!existsSync(fullPath)) {
      throw new Error(`asset file not found: ${assetPath} (resolved to ${fullPath})`);
    }
    const data = await readFile(fullPath);
    const key = `social-publisher/${slug}/${basename(assetPath)}`;
    const result = await blob.put(
      key,
      data,
      token ? { access: 'public', token } : { access: 'public' }
    );
    urls.push(result.url);
  }
  return urls;
}

export async function deleteAssets({ urls, blob = defaultBlob, token }) {
  const deleted = [];
  const failed = [];
  for (const url of urls) {
    try {
      await blob.del(url, token ? { token } : undefined);
      deleted.push(url);
    } catch (err) {
      failed.push({ url, error: err.message });
    }
  }
  return { deleted, failed };
}
