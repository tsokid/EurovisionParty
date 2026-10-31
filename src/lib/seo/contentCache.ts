/**
 * Client-side cache of content files (paths relative to content/, e.g.
 * `contests/2026.json`). Seeded before hydration from the JSON the prerender
 * inlined as <script id="__content__">, filled later by fetches of
 * /content/<path> (dist/content/** is the snapshot published as static JSON).
 * Tiny on purpose: it ships in the client bundle.
 */

export const CONTENT_SCRIPT_ID = '__content__';

const cache = new Map<string, unknown>();
/**
 * Paths whose cached value came from the inlined seed. The prerender inlines
 * only the slice a keyed read used (a CMS page doc's own locale, see
 * useContent's `key`), so a seeded value may be partial; a fetched one is the
 * whole file.
 */
const seeded = new Set<string>();

export const getCachedContent = (path: string): unknown => cache.get(path);
/** Cache the whole file (fetched): replaces a seeded partial. */
export const setCachedContent = (path: string, data: unknown): void => {
  cache.set(path, data);
  seeded.delete(path);
};
/** Whether the cached value came from the inlined seed (and so may be a partial). */
export const isSeededContent = (path: string): boolean => seeded.has(path);

export function seedContent(files: Record<string, unknown>): void {
  for (const [path, data] of Object.entries(files)) {
    cache.set(path, data);
    seeded.add(path);
  }
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
