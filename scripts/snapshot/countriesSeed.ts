// Reads the countries seed out of migration 070, so the 52 countries have a
// single source (the migration) instead of a second hardcoded copy.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CountryRow } from '../../src/content/contests/types';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SEED_MIGRATION = path.resolve(here, '../../supabase/migrations/070_contests_core.sql');

const STR = `'((?:[^']|'')*)'`;
const TUPLE = new RegExp(`^\\(${STR},\\s*${STR},\\s*${STR},\\s*${STR},\\s*'\\{([A-Z,]*)\\}'\\),?$`);

const unquote = (s: string) => s.replace(/''/g, "'");

/** Parses the `insert into public.countries ... values ... on conflict` block. */
export function parseCountriesSeed(sql: string): CountryRow[] {
  const m = /insert into public\.countries\s*\(iso, name_en, name_el, slug, related_iso\)\s*values\s*([\s\S]*?)\s*on conflict/i.exec(sql);
  if (!m) throw new Error('countries seed: no "insert into public.countries ... values ... on conflict" block');
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((line) => {
      const t = TUPLE.exec(line);
      if (!t) throw new Error(`countries seed: cannot parse line: ${line}`);
      return {
        iso: unquote(t[1]),
        name_en: unquote(t[2]),
        name_el: unquote(t[3]),
        slug: unquote(t[4]),
        related_iso: t[5] === '' ? [] : t[5].split(','),
      };
    });
}

export function readCountriesSeed(file = SEED_MIGRATION): CountryRow[] {
  return parseCountriesSeed(readFileSync(file, 'utf8'));
}
