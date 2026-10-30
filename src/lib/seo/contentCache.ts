/**
 * Client-side cache of content files (paths relative to content/, e.g.
 * `contests/2026.json`). Seeded before hydration from the JSON the prerender
 * inlined as <script id="__content__">, filled later by fetches of
 * /content/<path> (dist/content/** is the snapshot published as static JSON).
 * Tiny on purpose: it ships in the client bundle.
 */

export const CONTENT_SCRIPT_ID = '__content__';

const cache = new Map<string, unknown>();

export const getCachedContent = (path: string): unknown => cache.get(path);
export const setCachedContent = (path: string, data: unknown): void => {
  cache.set(path, data);
};

export function seedContent(files: Record<string, unknown>): void {
  for (const [path, data] of Object.entries(files)) cache.set(path, data);
}

/** Read the inlined #__content__ script into the cache. Never throws. */
export function seedContentFromDom(doc: Document): void {
  const text = doc.getElementById(CONTENT_SCRIPT_ID)?.textContent;
  if (!text) return;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') seedContent(parsed as Record<string, unknown>);
  } catch (err) {
    console.error('content: could not parse inlined #__content__', err);
  }
}

/** Public URL of a content file. */
export const contentUrl = (path: string): string => `/content/${path}`;
