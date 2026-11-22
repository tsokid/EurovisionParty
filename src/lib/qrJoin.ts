/**
 * QR join hand-off. The host's lobby QR is `/room/CODE#k=<password>`: the
 * password rides in the URL fragment, which browsers never send to the
 * server (no request line, no Vercel log, no Referer).
 *
 * On landing the fragment is read once and stripped from the address bar
 * with `history.replaceState`, so it never stays in history or gets shared.
 * The password is then held in memory only (this module) until the join
 * form picks it up. Nothing here is logged or persisted.
 */

const KEY = 'k';

let pending: { code: string; password: string } | null = null;

/** Append the password fragment to a join URL. No password, no fragment. */
export function withQrPassword(url: string, password: string | null | undefined): string {
  return password ? `${url}#${KEY}=${encodeURIComponent(password)}` : url;
}

function readFragment(hash: string): string | null {
  if (!hash || hash.length < 2) return null;
  try {
    const value = new URLSearchParams(hash.slice(1)).get(KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

/**
 * Read `#k=` from the current URL, strip the fragment from the address bar,
 * and remember the password for `code`. Returns the password, or null when
 * the URL carries none (nothing is touched then).
 */
export function captureQrPassword(code: string | undefined): string | null {
  if (typeof window === 'undefined' || !code) return null;
  const password = readFragment(window.location.hash);
  if (!password) return null;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', pathname + search);
  pending = { code: code.toUpperCase(), password };
  return password;
}

/** The QR password captured for this room code, if any. */
export function peekQrPassword(code: string | undefined): string | null {
  if (!pending || !code) return null;
  return pending.code === code.toUpperCase() ? pending.password : null;
}

/** Forget the captured password (after a join, or a rejoin that didn't need it). */
export function clearQrPassword(): void {
  pending = null;
}
