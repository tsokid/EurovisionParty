/**
 * useContent(path): one content file (path relative to content/, e.g.
 * `contests/2026.json`) for a page component.
 *
 * - Server (prerender, inside <ContentProvider>): read synchronously from the
 *   eager snapshot in contentData.ts and record the file in the collector, so
 *   the prerender can inline it as <script id="__content__">. Never fetches.
 * - Client: read synchronously from the cache that boot seeded from that
 *   script, so hydration sees the same data as the server render. On a miss
 *   (client-side navigation), fetch /content/<path>: 'loading', then 'ready',
 *   'missing' (404, or a non-JSON body such as an SPA fallback) or 'error'
 *   (which carries retry()).
 *
 * Keyed files (`key`): the caller needs only `data[key]` (a CMS page doc's
 * active locale). The server records just `{ [key]: data[key] }`, so the page
 * inlines one locale, not all. On the client a seeded value lacking `key` is
 * such a partial: it counts as a miss and the whole file is fetched (a locale
 * switch); the fetched file replaces the partial.
 */
import { useCallback, useContext, useEffect, useState } from 'react';
import { ContentCollectorContext } from './contentContext';
import { bundledContent } from './contentData';
import { contentUrl, getCachedContent, isSeededContent, setCachedContent } from './contentCache';

export type ContentState<T> =
  | { status: 'ready'; data: T }
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; retry: () => void };

type Outcome = 'missing' | 'error';
const failed = new Map<string, Outcome>();
const inflight = new Map<string, Promise<void>>();

function fetchContent(path: string): Promise<void> {
  let p = inflight.get(path);
  if (!p) {
    p = fetch(contentUrl(path))
      .then(async (res) => {
        const json = (res.headers.get('content-type') ?? '').includes('json');
        if (res.ok && json) setCachedContent(path, await res.json());
        else failed.set(path, res.status === 404 || (res.ok && !json) ? 'missing' : 'error');
      })
      .catch(() => {
        failed.set(path, 'error');
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

/** The cached (or, server side, bundled) file, partial or whole, without fetching. */
export const peekContent = (path: string): unknown => getCachedContent(path) ?? bundledContent(path);
const peek = peekContent;

const hasKey = (data: unknown, key: string): boolean =>
  !!data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, key);

/** The cached file, or undefined when absent or a seeded partial lacking `key`. */
function usable(path: string, key: string | undefined): unknown {
  const data = peek(path);
  if (data === undefined || key === undefined || hasKey(data, key) || !isSeededContent(path)) return data;
  return undefined;
}

/**
 * Warm the cache before a navigation (link hover/focus): fetch the file unless
 * it is already usable for `key`. Never throws; failures are remembered as for
 * useContent, which then reports them.
 */
export function prefetchContent(path: string, key?: string): void {
  if (usable(path, key) !== undefined || failed.get(path) === 'missing') return;
  failed.delete(path);
  void fetchContent(path);
}

export function useContent<T>(path: string | null, key?: string): ContentState<T> {
  const collector = useContext(ContentCollectorContext);
  const [, rerender] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const data = path ? usable(path, key) : undefined;
  if (path && data !== undefined && collector) {
    if (key === undefined) collector.record(path, data);
    else if (hasKey(data, key)) {
      const prev = collector.files[path];
      const slice = { [key]: (data as Record<string, unknown>)[key] };
      collector.record(path, prev && typeof prev === 'object' ? { ...prev, ...slice } : slice);
    }
  }

  useEffect(() => {
    if (!path || usable(path, key) !== undefined || failed.get(path) === 'missing') return;
    failed.delete(path); // a transient error is retried on the next mount
    let alive = true;
    void fetchContent(path).then(() => {
      if (alive) rerender((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [path, key, attempt]);

  const retry = useCallback(() => {
    if (path) failed.delete(path);
    setAttempt((n) => n + 1);
  }, [path]);

  if (!path) return { status: 'missing' };
  if (data !== undefined) return { status: 'ready', data: data as T };
  // Server render: not in the snapshot means it does not exist.
  if (collector) return { status: 'missing' };
  const outcome = failed.get(path);
  if (outcome === 'error') return { status: 'error', retry };
  return outcome ? { status: outcome } : { status: 'loading' };
}
