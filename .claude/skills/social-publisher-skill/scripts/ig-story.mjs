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

async function createStoryContainer({ igId, token, imageUrl }) {
  const body = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, media_type: 'STORIES' },
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
      throw new Error(`story container ${containerId} errored`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`story container ${containerId} did not reach FINISHED`);
}

async function publishContainer({ igId, token, creationId }) {
  const body = await graphFetch(`/${igId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: creationId },
  });
  return body.id;
}

export async function publishIgStory({
  credentials,
  imageUrls,
  linkSticker,
  pollIntervalMs = 1000,
  maxPolls = 30,
  frameDelayMs = 2000,
}) {
  const { pageToken: token, businessId: igId } = credentials;
  const mediaIds = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const containerId = await createStoryContainer({ igId, token, imageUrl: imageUrls[i] });
    await pollUntilFinished({ containerId, token, pollIntervalMs, maxPolls });
    const mediaId = await publishContainer({ igId, token, creationId: containerId });
    mediaIds.push(mediaId);
    if (i < imageUrls.length - 1 && frameDelayMs > 0) {
      await new Promise((r) => setTimeout(r, frameDelayMs));
    }
  }

  const manualSteps = [];
  if (linkSticker) {
    manualSteps.push(
      `Frame ${linkSticker.frame}: add link sticker pointing to ${linkSticker.url} (display text: "${linkSticker.text}") via Instagram app — Graph API does not support sticker overlay.`
    );
  }

  return { status: 'published', mediaIds, manualSteps };
}
