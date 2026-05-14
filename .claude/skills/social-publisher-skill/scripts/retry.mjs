export async function withRetry(
  fn,
  {
    delaysMs = [2000, 8000, 32000],
    retryableStatus = [429, 500, 502, 503, 504],
  } = {}
) {
  let lastErr;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!retryableStatus.includes(err.status)) throw err;
      if (attempt === delaysMs.length) break;
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
  throw lastErr;
}
