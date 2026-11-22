// The site's routes the internal-link check accepts (CMS P6, spec §4.1): the
// live year's hub, the archived contest pages and the country pages, read
// from the content indexes the site serves (/content/site.json,
// contests/index.json, countries/index.json), once per session. The static
// pages come from PAGE_REGISTRY (seoChecks.ts).
//
// No imports: tests/setup.ts installs the routes of the test content here.

export type KnownRoutes = {
  liveYear: number | null;
  /** Archived contest years → their city slug. */
  archived: Map<number, string>;
  countrySlugs: Set<string>;
};

/** The known routes from the three content indexes. */
export function knownRoutes(site: unknown, contests: unknown, countries: unknown): KnownRoutes {
  const live = (site as { current_year?: unknown } | null)?.current_year;
  const archived = new Map<number, string>();
  for (const [year, c] of Object.entries((contests ?? {}) as Record<string, { stage?: string; city_slug?: string }>)) {
    if (c?.stage === 'archived' && c.city_slug) archived.set(Number(year), c.city_slug);
  }
  const liveYear = typeof live === 'number' && !archived.has(live) ? live : null;
  return { liveYear, archived, countrySlugs: new Set(Object.keys((countries ?? {}) as object)) };
}

let loaded: Promise<KnownRoutes> | null = null;
let fixed: KnownRoutes | null = null;

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

/** The routes (fetched once; a failure is retried on the next call). */
export function loadKnownRoutes(): Promise<KnownRoutes> {
  if (fixed) return Promise.resolve(fixed);
  if (!loaded) {
    const p = Promise.all(['/content/site.json', '/content/contests/index.json', '/content/countries/index.json'].map(getJson))
      .then(([site, contests, countries]) => knownRoutes(site, contests, countries));
    loaded = p;
    p.catch(() => { if (loaded === p) loaded = null; });
  }
  return loaded;
}

/** The routes already known, without waiting (null until loaded). */
export const knownRoutesNow = (): KnownRoutes | null => fixed;

/** Test hook: use these routes instead of fetching (null: fetch again). */
export function __setKnownRoutesForTests(r: KnownRoutes | null): void {
  fixed = r;
  loaded = null;
}
