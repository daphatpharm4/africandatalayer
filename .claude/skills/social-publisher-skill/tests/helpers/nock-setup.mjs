import nock from 'nock';

export const GRAPH_BASE = 'https://graph.instagram.com';
export const LI_BASE = 'https://api.linkedin.com';

export function setupNock() {
  nock.disableNetConnect();
  return () => {
    nock.cleanAll();
    nock.enableNetConnect();
  };
}

function urlMatch(actual, expected) {
  if (expected instanceof RegExp) return expected.test(actual);
  return actual === expected;
}

export function mockIgChildContainer({ igId, imageUrl, containerId }) {
  return nock(GRAPH_BASE)
    .post(`/v22.0/${igId}/media`)
    .query((q) => urlMatch(q.image_url, imageUrl) && q.is_carousel_item === 'true')
    .reply(200, { id: containerId });
}

export function mockIgParentContainer({ igId, children, caption, containerId }) {
  return nock(GRAPH_BASE)
    .post(`/v22.0/${igId}/media`)
    .query(
      (q) =>
        q.media_type === 'CAROUSEL' &&
        q.children === children.join(',') &&
        urlMatch(q.caption, caption)
    )
    .reply(200, { id: containerId });
}

export function mockIgStatus({ containerId, statuses }) {
  let i = 0;
  return nock(GRAPH_BASE)
    .get(`/v22.0/${containerId}`)
    .query(true)
    .times(statuses.length)
    .reply(200, () => ({ status_code: statuses[i++] }));
}

export function mockIgPublish({ igId, creationId, mediaId }) {
  return nock(GRAPH_BASE)
    .post(`/v22.0/${igId}/media_publish`)
    .query((q) => q.creation_id === creationId)
    .reply(200, { id: mediaId });
}

export function mockIgPermalink({ mediaId, permalink }) {
  return nock(GRAPH_BASE)
    .get(`/v22.0/${mediaId}`)
    .query(true)
    .reply(200, { permalink });
}

export function mockIgStoryContainer({ igId, imageUrl, containerId }) {
  return nock(GRAPH_BASE)
    .post(`/v22.0/${igId}/media`)
    .query((q) => urlMatch(q.image_url, imageUrl) && q.media_type === 'STORIES')
    .reply(200, { id: containerId });
}
