const API = 'https://graph.instagram.com/v22.0';

async function graphFetch(path, { method = 'GET', token, params = {} } = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, { method });
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `Graph API ${res.status}`;
    const err = new Error(msg);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body;
}

async function createChildContainer({ igId, token, imageUrl }) {
  const body = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, is_carousel_item: 'true' },
  });
  return body.id;
}

async function createParentContainer({ igId, token, children, caption }) {
  const body = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { media_type: 'CAROUSEL', children: children.join(','), caption },
  });
  return body.id;
}

async function pollUntilFinished({ containerId, token, pollIntervalMs, maxPolls }) {
  for (let i = 0; i < maxPolls; i++) {
    const body = await graphFetch(`/${containerId}`, {
      token,
      params: { fields: 'status_code' },
    });
    if (body.status_code === 'FINISHED') return;
    if (body.status_code === 'ERROR') {
      throw new Error(`container ${containerId} errored: ${JSON.stringify(body)}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(
    `container ${containerId} did not reach FINISHED after ${maxPolls} polls`
  );
}

async function publishContainer({ igId, token, creationId }) {
  const body = await graphFetch(`/${igId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: creationId },
  });
  return body.id;
}

async function getPermalink({ mediaId, token }) {
  const body = await graphFetch(`/${mediaId}`, {
    token,
    params: { fields: 'permalink' },
  });
  return body.permalink;
}

export async function publishIgCarousel({
  credentials,
  imageUrls,
  caption,
  pollIntervalMs = 1000,
  maxPolls = 30,
}) {
  const { accessToken: token, userId: igId } = credentials;

  const children = [];
  for (const imageUrl of imageUrls) {
    const id = await createChildContainer({ igId, token, imageUrl });
    children.push(id);
    if (pollIntervalMs > 100) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const parentId = await createParentContainer({ igId, token, children, caption });
  await pollUntilFinished({ containerId: parentId, token, pollIntervalMs, maxPolls });
  const mediaId = await publishContainer({ igId, token, creationId: parentId });
  const permalink = await getPermalink({ mediaId, token });
  return { status: 'published', mediaId, permalink };
}
