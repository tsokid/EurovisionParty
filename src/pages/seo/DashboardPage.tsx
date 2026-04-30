import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Dashboard', href: '/dashboard' },
];

const FAQ = [
  {
    q: 'What is the Dashboard?',
    a: 'The Dashboard is the always-visible leaderboard that updates in real time as predictions resolve, quiz answers come in, and duels finish. It shows every player ranked by total points across all four sources: predictions, quiz, duels, and trophy bonuses.',
  },
  {
    q: 'When does the Dashboard update?',
    a: 'Live, push-driven. Quiz answers update on submission; duels update on finish; predictions update as the host enters Eurovision results (or as the auto-parser pulls them). No refresh needed.',
  },
  {
    q: 'Can I see the breakdown per player?',
    a: 'Yes. Tap a player on the Dashboard to see their points split into prediction, quiz, duel-won, duel-stolen, and trophy components — useful for arguing about who actually deserved Champion.',
  },
  {
    q: 'Who can see the Dashboard?',
    a: 'Every player in the room sees the same live leaderboard. There is no spectator mode — Eurovision Games is for participants, not lurkers.',
  },
];

export default function DashboardPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The Eurovision Games Dashboard — Live Leaderboard Explained',
    description: 'How the live Dashboard leaderboard works in a Eurovision Games room: what it shows, when it updates, and the four point sources that flow into it.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/dashboard' },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <SchemaHead
        title="Dashboard \u2014 Live Leaderboard for Eurovision Games"
        description="The Dashboard is the live leaderboard for your Eurovision Games room. Push-updated as predictions resolve, quiz answers land, and duels finish — no refresh."
        canonical="https://eurovision.games/dashboard"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games dashboard',
          'eurovision live leaderboard',
          'eurovision party score tracker',
          'eurovision games scores',
        ]}
        jsonLd={[article, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Live leaderboard"
        chipTone="purple"
        title="The Dashboard — your live Eurovision leaderboard"
        lede="The Dashboard is the heartbeat of every Eurovision Games room. It is the always-visible leaderboard that updates in real time — every prediction that resolves, every quiz answer, every duel finish pushes new totals to everyone in the room without a refresh."
      />

      <ContentLayout>
        <Section title="What the Dashboard shows">
          <p>
            One screen, every player, ranked by total points and updated as the night unfolds. The Dashboard is the
            single source of truth for who is winning — and by how much.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Total points</strong> per player, ranked highest to lowest.</li>
            <li><strong className="text-white">Live rank arrows</strong> next to each player when their position changes.</li>
            <li><strong className="text-white">Source split</strong> on tap: predictions, quiz, duels won, points stolen, trophy bonuses.</li>
            <li><strong className="text-white">Phase indicator</strong> — Lobby, Predictions, Quiz, Live Show, Results, Winners.</li>
            <li><strong className="text-white">You-vs-leader gap</strong> chip — exactly how far you are from first place.</li>
          </ul>
        </Section>

        <Section title="How the four point sources flow into the Dashboard">
          <p>
            Your total on the Dashboard is the sum of four live components. Each has its own update trigger and its own
            cap, which keeps any single mode from running away with the night.
          </p>
          <DataTable
            headers={['Source', 'When it updates', 'Cap']}
            align={['left', 'left', 'right']}
            rows={[
              ['Predictions (Top 5 + Worst 5)', 'Host enters Eurovision results, or the parser pulls them', <strong key="p" className="text-white">500</strong>],
              ['Quiz', 'Each round ends', <strong key="q" className="text-white">360</strong>],
              ['Duels — won', 'Each duel finishes', <span key="dw" className="text-white/70">open</span>],
              ['Duels — stolen', 'Each Steal finishes', <span key="ds" className="text-white/70">open</span>],
            ]}
          />
          <p>
            Predictions and Quiz are bounded; duels are uncapped on purpose so that an underdog can claw back the lead
            in the final ad break. See the <a href="/scoring" className="text-euro-pink-light hover:text-white underline underline-offset-2">full scoring page</a> for the formulas.
          </p>
        </Section>

        <Section title="When the Dashboard is most active">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Quiz round end.</strong> Sudden vertical jumps as ten questions resolve at once and the standings reshuffle.</li>
            <li><strong className="text-white">Live results entry.</strong> Biggest swings of the night as 26+ predictions auto-score against jury and televote totals.</li>
            <li><strong className="text-white">Live duels.</strong> Small but constant updates as challenges fire and resolve in commercial breaks.</li>
            <li><strong className="text-white">Trophy reveal.</strong> Final stack as Champion / Thief / Duelist / Oracle / Guru bonuses post.</li>
          </ul>
        </Section>

        <Section title="What the Dashboard does NOT show">
          <p>
            A few things stay deliberately hidden so the night stays competitive — the Dashboard is a leaderboard, not
            a spreadsheet of everybody&apos;s working.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Other players&apos; Top 5 / Worst 5 picks</strong> before they lock — those stay private until the host advances out of the Predictions phase.</li>
            <li><strong className="text-white">Duel questions in progress</strong> — only the two participants see the quiz items; everyone else sees a discreet &quot;duel in progress&quot; chip.</li>
            <li><strong className="text-white">Trophy winners ahead of time</strong> — Champion, Thief, Duelist, Oracle, and Guru are revealed at the end on a dedicated Winners screen.</li>
          </ul>
        </Section>

        <Section title="Hosting view vs player view">
          <p>
            The host sees one extra control on the Dashboard — a phase advance button that walks the room from Lobby
            through Predictions, Quiz, Live Show, Results, and Winners. Players see the same leaderboard but no
            controls. Everyone&apos;s totals are identical; there is no &quot;hidden host bonus.&quot;
          </p>
        </Section>

        <Section title="Frequently asked questions">
          <FaqAccordion items={FAQ} />
        </Section>

        <CtaBanner
          title="Open the Dashboard live"
          body="Spin up a room — every move you make shows up on it instantly."
          primary={{ label: 'Create', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-2026-predictions', title: 'Predictions', blurb: 'Top 5 and Worst 5 — the biggest single feeder into the Dashboard.' },
            { href: '/duels', title: 'Duels', blurb: 'Head-to-head trivia battles that drive the live ad-break swings.' },
            { href: '/eurovision-trivia', title: 'Trivia', blurb: 'Quiz round samples and how the 360-point cap is structured.' },
            { href: '/scoring', title: 'Scoring', blurb: 'The full formulas behind every number on the Dashboard.' },
            { href: '/how-to-play', title: 'How to play', blurb: 'Setup walkthrough from create-room to trophy reveal.' },
            { href: '/eurovision-night', title: 'Eurovision Night', blurb: 'How the Dashboard fits into the four-hour run-of-show.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
