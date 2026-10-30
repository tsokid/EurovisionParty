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
 */
import { useCallback, useContext, useEffect, useState } from 'react';
import { ContentCollectorContext } from './contentContext';
import { bundledContent } from './contentData';
import { contentUrl, getCachedContent, setCachedContent } from './contentCache';

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

const peek = (path: string): unknown => getCachedContent(path) ?? bundledContent(path);

export function useContent<T>(path: string | null): ContentState<T> {
  const collector = useContext(ContentCollectorContext);
  const [, rerender] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const data = path ? peek(path) : undefined;
  if (path && data !== undefined) collector?.record(path, data);

  useEffect(() => {
    if (!path || peek(path) !== undefined || failed.get(path) === 'missing') return;
    failed.delete(path); // a transient error is retried on the next mount
    let alive = true;
    void fetchContent(path).then(() => {
      if (alive) rerender((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [path, attempt]);

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
