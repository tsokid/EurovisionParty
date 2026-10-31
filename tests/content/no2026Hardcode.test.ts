// @vitest-environment node
// Guide copy and pages, locale strings and the site chrome must not hardcode
// the live contest (year, city, host, final date, venue, broadcaster): those
// facts come from useCurrentContest(). A line may
// keep a dated past fact only when it, or the line above it, carries a
// `// fact:` marker saying which fact it is.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const PATTERN = /2026|Vienna|Βιέννη|Austria|Αυστρία|16 May|16 Μαΐου|Stadthalle|\bORF\b/;
const MARKER = /\/\/ fact:/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const FILES = [
  ...walk(path.join(root, 'src/pages')).filter((f) => /(Copy\.ts|Page\.tsx)$/.test(f)),
  ...walk(path.join(root, 'src/i18n/locales')).filter((f) => f.endsWith('.json')),
  path.join(root, 'src/components/seo/SiteHeader.tsx'),
  path.join(root, 'src/components/seo/SiteFooter.tsx'),
  path.join(root, 'src/components/onboarding/WelcomeScreen.tsx'),
];

describe('no hardcoded live-contest year or city', () => {
  it('covers the guide copy files', () => {
    const names = FILES.map((f) => path.basename(f));
    for (const n of ['EurovisionNightPage.tsx', 'PredictionsPage.tsx', 'WinnersPage.tsx', 'NotFoundPage.tsx', 'HomePage.tsx', 'en.json', 'el.json']) {
      expect(names).toContain(n);
    }
  });

  it('every line naming the live year, city, host, date, venue or broadcaster carries a // fact: marker', () => {
    const hits: string[] = [];
    for (const f of FILES) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!PATTERN.test(line)) return;
        if (MARKER.test(line) || (i > 0 && MARKER.test(lines[i - 1]))) return;
        hits.push(`${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  // CMS page documents (content/pages/*.json) are not checked here: editors
  // change them without a code review, so a pinned allowlist would break on the
  // first edit. `validate-content` (build) warns instead, against the live
  // contest in content/site.json: "possible hardcoded year/city at doc:locale:path".
});
