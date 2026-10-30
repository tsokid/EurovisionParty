import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_REGISTRY, allPublicUrls } from '../../src/lib/seo/registry';
import { localizePath } from '../../src/lib/seo/locale';
import {
  ARCHIVE_INDEX_PATH, COUNTRY_INDEX_PATH, HUB_SUBPAGES, archivePath, countedParticipations, countryPath, hubPath,
} from '../../src/lib/seo/dynamicPages';
import { loadContent } from './loadContent';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE = 'https://eurovision.games';
const OUT = resolve(__dirname, '../../public/llms.txt');

const DESCRIPTIONS: Record<string, string> = {
  home: 'Free browser-based party game for the Eurovision Song Contest. Predictions, trivia duels, live scoring.',
  'how-to-play': 'How to play Eurovision Games — 60-second setup, 6 steps from create-room to trophy reveal.',
  'eurovision-night': 'Complete guide to hosting Eurovision night: 10-step playbook, food, drinks, run-of-show.',
  'eurovision-games': 'Free interactive party games to play during Eurovision: predictions, trivia, live scoring.',
  'eurovision-party': 'Hosting playbook for a Eurovision party: guests, theme, decor, food, run-of-show.',
  'eurovision-trivia': '50+ Eurovision trivia questions with answers, plus how to run trivia duels live.',
  'eurovision-predictions': 'The Eurovision predictions game: Top 5 / Worst 5 format, scoring, strategy and the current line-up.',
  winners: 'Every Eurovision winner from 1956 to today — songs, artists, points, voting breakdown.',
  faq: 'Eurovision Games FAQ: setup, gameplay, scoring, hosting, technical questions answered.',
  rules: 'Eurovision Games rules: predictions, duels, scoring, winner categories.',
  scoring: 'How Eurovision Games scoring works: prediction points, duel theft, winner categories.',
  about: 'About Eurovision Games — built for the people who watch Eurovision like a sport.',
  privacy: 'Privacy policy: data we collect, what we do with it, how to delete it.',
  terms: 'Terms of use for Eurovision Games.',
  'eurovision-duels': 'Eurovision duels feature — 3-question head-to-head trivia during the live show. Steal points or double yours.',
  dashboard: 'Live leaderboard for your Eurovision Games room — push-updated as predictions, quiz, and duels resolve.',
  cookies: 'Cookies and consent: what we use, why, and how to change your preferences.',
};

const TIER_1 = ['home', 'eurovision-night', 'eurovision-party', 'eurovision-games', 'how-to-play'] as const;
const TIER_2 = [
  'eurovision-predictions', 'eurovision-trivia', 'eurovision-duels', 'dashboard',
  'winners',
] as const;
const TIER_3 = [
  'rules', 'scoring', 'faq', 'about', 'cookies', 'privacy', 'terms',
] as const;

function lineFor(id: string): string {
  const page = PAGE_REGISTRY.find((p) => p.id === id);
  if (!page) return '';
  const url = SITE + localizePath('en', page.slugByLocale.en);
  return `- [${id}](${url}): ${DESCRIPTIONS[id] ?? ''}`;
}

// Data-driven pages: listed only when allPublicUrls has them as indexable
// (nothing while INCLUDE_DYNAMIC is off). Descriptions are templates over data.
const content = loadContent();
const listed = new Set(
  allPublicUrls(content)
    .filter((u) => 'kind' in u && u.indexable && u.locale === 'en')
    .map((u) => u.path),
);

function dynamicLine(path: string, desc: string): string[] {
  const enPath = localizePath('en', path);
  if (!listed.has(enPath)) return [];
  return [`- [${path.slice(1)}](${SITE + enPath}): ${desc}`];
}

const HUB_DESC: Record<(typeof HUB_SUBPAGES)[number], (year: number) => string> = {
  schedule: (y) => `Eurovision ${y} schedule: semi-final and grand final dates.`,
  semifinals: (y) => `Eurovision ${y} semi-finals: running order and qualifiers.`,
  songs: (y) => `Every song and artist at Eurovision ${y}.`,
};

const live = content.contests.find((c) => c.year === content.site.current_year);
const archiveLines = [
  ...(live
    ? [
        ...dynamicLine(hubPath(live.year), `Eurovision ${live.year} in ${live.city}: entries, dates and results.`),
        ...HUB_SUBPAGES.flatMap((sub) => dynamicLine(`${hubPath(live.year)}/${sub}`, HUB_DESC[sub](live.year))),
      ]
    : []),
  ...dynamicLine(ARCHIVE_INDEX_PATH, 'Every Eurovision Song Contest since 1956: host city, winner and results per year.'),
  ...[...content.contests]
    .reverse()
    .flatMap((c) => dynamicLine(archivePath(c.year, c.city_slug), `Eurovision ${c.year} in ${c.city}: final ranking, points and semi-finals.`)),
  ...dynamicLine(COUNTRY_INDEX_PATH, 'Every country that has competed at Eurovision, with participations and best results.'),
  ...content.countries.flatMap((c) =>
    dynamicLine(countryPath(c.slug), `${c.name_en} at Eurovision: ${countedParticipations(c)} participations, results by year.`),
  ),
];

const out = [
  '# Eurovision Games',
  '',
  '> Free browser-based multiplayer party game for the Eurovision Song Contest. Predictions, trivia duels, live scoring, no signup, no install.',
  '',
  `Eurovision Games at https://eurovision.games is a watch-party companion: hosts create a room (60s), friends join with a code, everyone predicts Top 5 and Worst 5 of Eurovision ${content.site.current_year}, plays head-to-head trivia duels during ad breaks, and competes for five trophy titles (Champion, Thief, Duelist, Oracle, Guru). Available in English (/en/) and Greek (/el/).`,
  '',
  '## Important clarification',
  '',
  'Eurovision Games is an unofficial fan-made party game. It is not affiliated with, endorsed by, or operated by the European Broadcasting Union or the Eurovision Song Contest.',
  '',
  '## Core pages',
  ...TIER_1.map(lineFor),
  '',
  `## Eurovision ${content.site.current_year}`,
  ...TIER_2.map(lineFor),
  '',
  '## Reference & related',
  ...TIER_3.map(lineFor),
  '',
  ...(archiveLines.length ? ['## Contests & countries', ...archiveLines, ''] : []),
  '## Optional',
  '- [sitemap.xml](https://eurovision.games/sitemap.xml): full URL list with hreflang',
  '- [robots.txt](https://eurovision.games/robots.txt): crawl policy (AI bots welcome)',
  '',
].join('\n');

writeFileSync(OUT, out, 'utf8');
console.log(`llms.txt written: ${OUT}`);
