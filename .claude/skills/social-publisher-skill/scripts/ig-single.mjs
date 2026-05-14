const API = 'https://graph.facebook.com/v21.0';

async function graphFetch(path, { method = 'GET', token, params = {} } = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Graph API ${res.status}`);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function publishIgSingle({
  credentials,
  imageUrl,
  caption,
  pollIntervalMs = 1000,
  maxPolls = 30,
}) {
  const { pageToken: token, businessId: igId } = credentials;

  const createBody = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, caption },
  });
  const containerId = createBody.id;

  for (let i = 0; i < maxPolls; i++) {
    const status = await graphFetch(`/${containerId}`, {
      token,
      params: { fields: 'status_code' },
    });
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') {
      throw new Error(`single container ${containerId} errored`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    if (i === maxPolls - 1) {
      throw new Error(`single container ${containerId} did not reach FINISHED`);
    }
  }

  const publishBody = await graphFetch(`/${igId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: containerId },
  });
  const mediaId = publishBody.id;
  const permalinkBody = await graphFetch(`/${mediaId}`, {
    token,
    params: { fields: 'permalink' },
  });

  return { status: 'published', mediaId, permalink: permalinkBody.permalink };
}
