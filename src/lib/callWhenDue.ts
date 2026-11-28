/**
 * Votes and sudden-death matches close at the server's deadline (097). A
 * client calls when its own countdown hits zero; if its clock runs fast the
 * server answers 'too_early', so retry once a second for a while.
 */
export async function callWhenDue<T>(
  call: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  { tries = 12, delayMs = 1000 }: { tries?: number; delayMs?: number } = {},
): Promise<{ data: T | null; error: { message: string } | null }> {
  let res = await call();
  for (let i = 1; i < tries && res.error && /too_early/.test(res.error.message); i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    res = await call();
  }
  return res;
}

/**
 * One resolver per room (F12): when a vote or a sudden death closes, the
 * host's phone settles it at once; every other phone waits this long and
 * settles it only if no result has arrived by then (the host's phone may be
 * locked or gone). The server returns the same result to any later call.
 */
export function resolverDelayMs(isHost: boolean): number {
  return isHost ? 0 : 8_000 + Math.floor(Math.random() * 4_000);
}
