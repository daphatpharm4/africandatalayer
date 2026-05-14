const SENSITIVE_KEY = /token|secret|key|password|credential/i;

export function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('urn:li:')) return '[REDACTED-URN]';
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function createLogger({
  sink = (line) => process.stdout.write(line + '\n'),
  level = 'info',
} = {}) {
  const emit = (lvl, msg, extra) => {
    const safe = redact(extra ?? {});
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...safe });
    sink(line);
  };
  return {
    info: (msg, extra) => emit('info', msg, extra),
    warn: (msg, extra) => emit('warn', msg, extra),
    debug: (msg, extra) => level === 'debug' && emit('debug', msg, extra),
    error: (msg, err, extra = {}) => {
      const errObj =
        err instanceof Error
          ? { error: err.message, stack: err.stack, ...extra }
          : { error: err, ...extra };
      emit('error', msg, errObj);
    },
  };
}
