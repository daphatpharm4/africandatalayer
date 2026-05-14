import { createHash } from 'node:crypto';

export function createMockBlob() {
  const store = new Map();
  return {
    put: async (key, data) => {
      const sha = createHash('sha256').update(data).digest('hex').slice(0, 16);
      const url = `https://blob.test/${sha}-${key}`;
      store.set(url, data);
      return { url, pathname: key };
    },
    del: async (url) => {
      if (!store.has(url)) throw new Error(`not found: ${url}`);
      store.delete(url);
    },
    has: (url) => store.has(url),
    size: () => store.size,
  };
}
