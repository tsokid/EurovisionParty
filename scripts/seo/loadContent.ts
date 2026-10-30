/**
 * Node (fs) loader for the content snapshot, for build scripts run by tsx,
 * which has no import.meta.glob. Mirrors src/lib/seo/contentData.ts.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContestSnapshot, CountrySnapshot, SiteSnapshot } from '../../src/content/contests/types';
import type { ContentData } from '../../src/lib/seo/dynamicPages';

const CONTENT = resolve(dirname(fileURLToPath(import.meta.url)), '../../content');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Per-item files only (`2019.json`, `GR.json`); the summary `index.json` is skipped. */
function readDir<T>(dir: string): T[] {
  return readdirSync(resolve(CONTENT, dir))
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => readJson<T>(resolve(CONTENT, dir, f)));
}

export function loadContent(): ContentData {
  return {
    site: readJson<SiteSnapshot>(resolve(CONTENT, 'site.json')),
    contests: readDir<ContestSnapshot>('contests').sort((a, b) => a.year - b.year),
    countries: readDir<CountrySnapshot>('countries').sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0)),
  };
}
