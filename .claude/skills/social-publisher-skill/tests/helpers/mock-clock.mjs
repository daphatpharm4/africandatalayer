export function createClock(initialIso) {
  let now = new Date(initialIso).getTime();
  return {
    now: () => new Date(now).toISOString(),
    advance: (ms) => {
      now += ms;
    },
  };
}
