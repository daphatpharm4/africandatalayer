const API = 'https://api.linkedin.com';

const RECIPE_IMAGE = 'urn:li:digitalmediaRecipe:feedshare-image';
const RECIPE_DOC = 'urn:li:digitalmediaRecipe:feedshare-document';

async function liFetch(path, { method = 'GET', token, body, query } = {}) {
  const url = new URL(`${API}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg =
      payload?.message || payload?.error?.message || `LinkedIn API ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return { payload, headers: res.headers };
}

async function registerUpload({ token, orgUrn, recipe }) {
  const { payload } = await liFetch('/v2/assets', {
    method: 'POST',
    token,
    query: { action: 'registerUpload' },
    body: {
      registerUploadRequest: {
        owner: orgUrn,
        recipes: [recipe],
        serviceRelationships: [
          { identifier: 'urn:li:userGeneratedContent', relationshipType: 'OWNER' },
        ],
      },
    },
  });
  const uploadUrl =
    payload.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
  const assetUrn = payload.value.asset;
  return { uploadUrl, assetUrn };
}

async function uploadBinary({ uploadUrl, token, buffer, contentType }) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload PUT failed with ${res.status}`);
}

async function createUgcPost({
  token,
  orgUrn,
  mediaCategory,
  media,
  commentary,
  visibility,
}) {
  const { headers } = await liFetch('/v2/ugcPosts', {
    method: 'POST',
    token,
    body: {
      author: orgUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: commentary },
          shareMediaCategory: mediaCategory,
          media,
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility ?? 'PUBLIC',
      },
    },
  });
  return headers.get('x-restli-id');
}

function permalink(postUrn) {
  return `https://www.linkedin.com/feed/update/${postUrn}/`;
}

export async function publishLinkedInImage({
  credentials,
  imageBuffer,
  title,
  commentary,
  visibility = 'PUBLIC',
}) {
  const { accessToken: token, orgUrn } = credentials;
  const { uploadUrl, assetUrn } = await registerUpload({ token, orgUrn, recipe: RECIPE_IMAGE });
  await uploadBinary({ uploadUrl, token, buffer: imageBuffer, contentType: 'image/png' });
  const postUrn = await createUgcPost({
    token,
    orgUrn,
    mediaCategory: 'IMAGE',
    media: [
      {
        status: 'READY',
        media: assetUrn,
        title: { text: title },
        description: { text: title },
      },
    ],
    commentary,
    visibility,
  });
  return { status: 'published', postUrn, permalink: permalink(postUrn) };
}

export async function publishLinkedInMultiImage({
  credentials,
  imageBuffers,
  title,
  commentary,
  visibility = 'PUBLIC',
}) {
  const { accessToken: token, orgUrn } = credentials;
  const media = [];
  for (const buf of imageBuffers) {
    const { uploadUrl, assetUrn } = await registerUpload({
      token,
      orgUrn,
      recipe: RECIPE_IMAGE,
    });
    await uploadBinary({ uploadUrl, token, buffer: buf, contentType: 'image/png' });
    media.push({
      status: 'READY',
      media: assetUrn,
      title: { text: title },
      description: { text: title },
    });
  }
  const postUrn = await createUgcPost({
    token,
    orgUrn,
    mediaCategory: 'IMAGE',
    media,
    commentary,
    visibility,
  });
  return { status: 'published', postUrn, permalink: permalink(postUrn) };
}

export async function publishLinkedInDocument({
  credentials,
  pdfBuffer,
  title,
  commentary,
  visibility = 'PUBLIC',
}) {
  const { accessToken: token, orgUrn } = credentials;
  const { uploadUrl, assetUrn } = await registerUpload({ token, orgUrn, recipe: RECIPE_DOC });
  await uploadBinary({ uploadUrl, token, buffer: pdfBuffer, contentType: 'application/pdf' });
  const postUrn = await createUgcPost({
    token,
    orgUrn,
    mediaCategory: 'DOCUMENT',
    media: [
      {
        status: 'READY',
        media: assetUrn,
        title: { text: title },
        description: { text: title },
      },
    ],
    commentary,
    visibility,
  });
  return { status: 'published', postUrn, permalink: permalink(postUrn) };
}
