const IG_LIMIT = 2200;
const SEPARATOR = '\n\n.\n.\n.\n';

export function buildIgCaption({ caption, captionLang, hashtags, langOverride }) {
  const lang = langOverride ?? captionLang;
  const body = caption[lang];
  if (body === undefined) {
    throw new Error(`caption missing for lang "${lang}"`);
  }
  const tail = hashtags.length > 0 ? SEPARATOR + hashtags.join(' ') : '';
  const final = body + tail;
  if (final.length > IG_LIMIT) {
    throw new Error(`caption exceeds IG limit of 2200 chars (got ${final.length})`);
  }
  return final;
}
