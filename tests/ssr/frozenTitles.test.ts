// @vitest-environment node
// Titles and descriptions of every static (registry) page are frozen: the copy
// now templates the live contest's year and city, and with current_year 2026
// the rendered strings must be byte-identical to the build captured before
// that change (tests/fixtures/titles-before.json). Every difference is listed
// in EXCEPTIONS below.
import { describe, it, expect } from 'vitest';
import { render } from '@/entry-server';
import { allPageUrls } from '@/lib/seo/registry';
import before from '../fixtures/titles-before.json';

type Frozen = Record<string, { title: string; description: string }>;
const FROZEN = before as Frozen;

/** Old URL → new URL for renamed pages. */
const RENAMED: Record<string, string> = {
  '/en/eurovision-2026-predictions': '/en/eurovision-predictions',
  '/el/eurovision-2026-predictions': '/el/eurovision-predictions',
};

/**
 * Allowed differences, by new URL and field, with the new value:
 * - predictions: the page is renamed; its title drops "2026" (Task 7). The
 *   description keeps its wording, templated on the live contest.
 * - /winners description: templated on the latest winner year in Task 6, so it
 *   is not compared; EL also fixes the typo "αιώνιο πίνακας" → "αιώνιος πίνακας".
 */
const EXCEPTIONS: Record<string, Partial<Record<'title' | 'description', string | 'not-compared'>>> = {
  '/en/eurovision-predictions': {
    title: 'Eurovision Predictions Game: Top 5 / Worst 5 Format & Strategy',
  },
  '/el/eurovision-predictions': {
    title: 'Παιχνίδι Προβλέψεων Eurovision: Φόρμα Top 5 / Worst 5 και Στρατηγική',
  },
  '/en/winners': { description: 'not-compared' },
  '/el/winners': { description: 'not-compared' },
};

describe('frozen static page titles and descriptions', () => {
  it('the fixture covers every registry page (after renames)', () => {
    const fixtureUrls = Object.keys(FROZEN).map((u) => RENAMED[u] ?? u).sort();
    expect(fixtureUrls).toEqual(allPageUrls().map((u) => u.path).sort());
  });

  it('every page renders its frozen title and description, except the listed exceptions', async () => {
    const diffs: string[] = [];
    for (const [oldUrl, want] of Object.entries(FROZEN)) {
      const url = RENAMED[oldUrl] ?? oldUrl;
      const r = await render(url);
      expect(r.status, url).toBe(200);
      for (const field of ['title', 'description'] as const) {
        const got = r.head?.[field];
        const ex = EXCEPTIONS[url]?.[field];
        if (ex === 'not-compared') continue;
        const expected = ex ?? want[field];
        if (got !== expected) diffs.push(`${url} ${field}:\n  want ${expected}\n  got  ${got}`);
      }
    }
    expect(diffs).toEqual([]);
  }, 60_000);

  it('the Greek winners description has the typo fixed', async () => {
    const r = await render('/el/winners');
    expect(r.head?.description).toContain('αιώνιος πίνακας νικών');
    expect(r.head?.description).not.toContain('αιώνιο πίνακας');
  });
});
