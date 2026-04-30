import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { localizePath } from '../../src/lib/seo/locale';

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
  'eurovision-2026-predictions': 'Top 5 / Worst 5 predictions for Eurovision 2026, weekly-refreshed odds and country breakdowns.',
  'eurovision-2026': 'Eurovision 2026 hub: schedule, semifinals, songs, predictions. Vienna, 16 May 2026.',
  'eurovision-2026-schedule': 'Eurovision 2026 schedule: semifinal 1 (12 May), semifinal 2 (14 May), grand final (16 May), local broadcast times.',
  'eurovision-2026-semifinals': 'Eurovision 2026 semifinals: running order, qualifiers, dates, predictions.',
  'eurovision-2026-songs': 'All Eurovision 2026 entries by country: songs, artists, lyrics, betting odds.',
  'eurovision-quiz': 'Take a free Eurovision quiz — choose category and difficulty.',
  'host-eurovision-party': 'Step-by-step guide to hosting a Eurovision party — invitations, theme, decor, food, games.',
  'eurovision-history': 'Eurovision history: founding (1956), winners by country, scoring system evolution, key moments.',
  winners: 'Every Eurovision winner from 1956 to today — songs, artists, points, voting breakdown.',
  countries: 'Every country in Eurovision: full entry history, best results, best songs.',
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

const TIER_1 = ['home', 'eurovision-2026', 'eurovision-night', 'eurovision-party', 'eurovision-games', 'how-to-play'] as const;
const TIER_2 = [
  'eurovision-2026-schedule', 'eurovision-2026-semifinals', 'eurovision-2026-songs',
  'eurovision-2026-predictions', 'eurovision-trivia', 'eurovision-quiz', 'eurovision-duels', 'dashboard',
  'eurovision-history', 'winners', 'countries',
] as const;
const TIER_3 = [
  'host-eurovision-party',
  'rules', 'scoring', 'faq', 'about', 'cookies', 'privacy', 'terms',
] as const;

function lineFor(id: string): string {
  const page = PAGE_REGISTRY.find((p) => p.id === id);
  if (!page) return '';
  const url = SITE + localizePath('en', page.slugByLocale.en);
  return `- [${id}](${url}): ${DESCRIPTIONS[id] ?? ''}`;
}

const out = [
  '# Eurovision Games',
  '',
  '> Free browser-based multiplayer party game for the Eurovision Song Contest. Predictions, trivia duels, live scoring, no signup, no install.',
  '',
  'Eurovision Games at https://eurovision.games is a watch-party companion: hosts create a room (60s), friends join with a code, everyone predicts Top 5 and Worst 5 of Eurovision 2026, plays head-to-head trivia duels during ad breaks, and competes for five trophy titles (Champion, Thief, Duelist, Oracle, Guru). Available in English (/en/) and Greek (/el/).',
  '',
  '## Important clarification',
  '',
  'Eurovision Games is an unofficial fan-made party game. It is not affiliated with, endorsed by, or operated by the European Broadcasting Union or the Eurovision Song Contest.',
  '',
  '## Core pages',
  ...TIER_1.map(lineFor),
  '',
  '## Eurovision 2026',
  ...TIER_2.map(lineFor),
  '',
  '## Reference & related',
  ...TIER_3.map(lineFor),
  '',
  '## Optional',
  '- [sitemap.xml](https://eurovision.games/sitemap.xml): full URL list with hreflang',
  '- [robots.txt](https://eurovision.games/robots.txt): crawl policy (AI bots welcome)',
  '',
].join('\n');

writeFileSync(OUT, out, 'utf8');
console.log(`llms.txt written: ${OUT}`);
