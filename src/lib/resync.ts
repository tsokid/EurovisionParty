/**
 * One catch-up after the live connection may have missed something
 * (28 Nov 2026).
 *
 * Every game update (phase, scores, players, duels, notifications) is pushed
 * by the server over Realtime; nothing polls. A push is lost only while the
 * phone was locked, the tab hidden or the network down. So the game refetches
 * once, and only then:
 * - the tab comes back to the front after being hidden for 3 s or more;
 * - the browser comes back online;
 * - a live channel joins again after a drop (reconnectedChannel()).
 *
 * Calls within 1 s of each other are merged into one catch-up.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
const HIDDEN_MIN_MS = 3_000;
const MERGE_MS = 1_000;
let hiddenAt: number | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;
let wired = false;

/**
 * A rejoin after a drop happens on every phone at once (a Realtime restart),
 * so its catch-up is spread over this window; a phone coming back on its
 * own catches up at once.
 */
const REJOIN_SPREAD_MS = 3_000;

export function triggerResync(delayMs = 0): void {
  if (pending !== null) return;
  pending = setTimeout(() => {
    pending = null;
    for (const fn of [...listeners]) {
      try { fn(); } catch (err) { console.error('[resync]', err); }
    }
  }, delayMs);
}

let lastRun = 0;
function trigger(delayMs = 0): void {
  const now = Date.now();
  if (now - lastRun < MERGE_MS) return;
  lastRun = now;
  triggerResync(delayMs);
}

function wire(): void {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away >= HIDDEN_MIN_MS) trigger();
  });
  window.addEventListener('online', () => trigger());
}

/** Runs `fn` on every catch-up. Returns the cleanup for a useEffect. */
export function onResync(fn: Listener): () => void {
  wire();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * For a channel's subscribe callback: a catch-up when the channel joins
 * again after its first join (the socket dropped and came back).
 */
export function rejoinWatcher(): (status: string) => void {
  let joinedOnce = false;
  return (status: string) => {
    if (status !== 'SUBSCRIBED') return;
    if (joinedOnce) trigger(Math.floor(Math.random() * REJOIN_SPREAD_MS));
    joinedOnce = true;
  };
}

/** Tests only. */
export function __resetResync(): void {
  listeners.clear();
  hiddenAt = null;
  lastRun = 0;
  if (pending !== null) { clearTimeout(pending); pending = null; }
}
