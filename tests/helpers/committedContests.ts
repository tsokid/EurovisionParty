// The contests of the committed content/ (not the frozen test fixture), as
// the ContestRow fields the redirect generator reads. Publish writes both
// content/ and vercel.json from the same rows, so tests of the committed
// vercel.json compare it against these.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ContestIndex, ContestRow } from '../../src/content/contests/types';

export function committedContests(root = process.cwd()): ContestRow[] {
  const index = JSON.parse(readFileSync(resolve(root, 'content/contests/index.json'), 'utf8')) as ContestIndex;
  return Object.entries(index)
    .map(([year, c]) => ({
      year: Number(year),
      host_iso: c.host_iso,
      city: c.city,
      city_slug: c.city_slug,
      semi1_date: null,
      semi2_date: null,
      final_date: c.final_date,
      stage: c.stage,
      indexable: c.indexable,
      cancelled: c.cancelled,
    }))
    .sort((a, b) => a.year - b.year);
}
