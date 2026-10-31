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
    for (const n of ['EurovisionNightPage.tsx', 'predictionsCopy.ts', 'homeCopy.ts', 'PredictionsPage.tsx', 'HomePage.tsx', 'en.json', 'el.json']) {
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

  // CMS page documents (content/pages/*.json) hold the copy that used to live in
  // *Copy.ts. JSON has no comments, so a dated past fact is allowed here by path
  // (`docId:locale:path`, list indices as numbers) with the fact it states.
  const JSON_FACTS: Record<string, string> = {
    'privacy:en:hero.lede': 'date the policy was last updated',
    'privacy:el:hero.lede': 'date the policy was last updated',
    'terms:en:hero.lede': 'date the terms were last updated',
    'terms:el:hero.lede': 'date the terms were last updated',
    'eurovision-trivia:en:questions.2.q': 'Eurovision 2026 was held in Vienna',
    'eurovision-trivia:el:questions.2.q': 'Eurovision 2026 was held in Vienna',
    'eurovision-trivia:en:questions.2.options.1': 'options of the 2026 host-city question',
    'eurovision-trivia:el:questions.2.options.1': 'options of the 2026 host-city question',
    'eurovision-trivia:en:questions.2.answer': 'Vienna hosted 2026 after JJ won 2025 in Basel',
    'eurovision-trivia:el:questions.2.answer': 'Vienna hosted 2026 after JJ won 2025 in Basel',
    'eurovision-trivia:en:questions.5.answer': "Austria's 2014 winning song",
    'eurovision-trivia:el:questions.5.answer': "Austria's 2014 winning song",
  };

  /** Every string of every CMS page document, keyed `docId:locale:path`. */
  function jsonStrings(): Map<string, string> {
    const dir = path.join(root, 'content/pages');
    const out = new Map<string, string>();
    const walkJson = (v: unknown, at: string, push: (p: string, s: string) => void): void => {
      if (typeof v === 'string') push(at, v);
      else if (Array.isArray(v)) v.forEach((x, i) => walkJson(x, at ? `${at}.${i}` : String(i), push));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkJson(x, at ? `${at}.${k}` : k, push);
    };
    const docs = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(docs).toEqual(expect.arrayContaining(['eurovision-night.json', 'eurovision-party.json', 'eurovision-trivia.json']));
    for (const file of docs) {
      const doc = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Record<string, unknown>;
      for (const locale of ['en', 'el']) {
        walkJson(doc[locale], '', (at, s) => out.set(`${file.replace(/\.json$/, '')}:${locale}:${at}`, s));
      }
    }
    return out;
  }

  it('no CMS page document names the live year, city, host, date, venue or broadcaster outside a listed fact', () => {
    const hits: string[] = [];
    for (const [key, s] of jsonStrings()) {
      if (PATTERN.test(s) && !JSON_FACTS[key]) hits.push(`${key}: ${s.slice(0, 100)}`);
    }
    expect(hits).toEqual([]);
  });

  it('every listed fact still exists and still matches the pattern', () => {
    const strings = jsonStrings();
    const stale = Object.keys(JSON_FACTS).filter((key) => {
      const s = strings.get(key);
      return s === undefined || !PATTERN.test(s);
    });
    expect(stale.map((key) => `stale allowlist entry: ${key}`)).toEqual([]);
  });
});
