import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'FAQ', href: '/faq' },
];

// Anchored questions — kept as their own Sections so /faq#create, /faq#join,
// /faq#leave (linked from SiteFooter) deep-link straight to the answer.
const ANCHORED = [
  {
    id: 'create',
    q: 'How do I create a room?',
    a: 'Sign in (email-only — we send a one-tap magic link), click "Create Room", pick the round count (1-3 quiz rounds), max players (2-20), and per-pair duel cap (default 3). A 6-character room code and shareable link appear instantly. The host owns the room until they leave or delete it.',
  },
  {
    id: 'join',
    q: 'How do I join a room?',
    a: 'Use the join link the host shared (one tap, no account), or open Eurovision Games, click "Join Room", and type the 6-character code plus your display name. Late joiners can still play duels and quiz, but predictions lock once the host advances the phase.',
  },
  {
    id: 'leave',
    q: 'How do I leave or delete a room?',
    a: 'Tap your name in the room header → "Leave room". Your slot frees up; your scored points stay frozen on the leaderboard so the rest of the room is unaffected. Hosts have an extra "Delete room" option in the host panel that ends the session for everyone — a 5-second confirmation prevents accidents.',
  },
];

const MORE_FAQ = [
  { q: 'Is Eurovision Games free?', a: 'Yes — completely free. No subscriptions, no in-app purchases, no ads.' },
  { q: 'Do I need an account?', a: 'Only the host signs in (with email). Players join with a room code and a name — no account.' },
  { q: 'How many players can join a room?', a: '2 to 20. Couples can share a single device.' },
  { q: 'Does it work on mobile?', a: 'Yes. The app is mobile-first and installs as a PWA on iOS and Android.' },
  { q: 'What browsers are supported?', a: 'Chrome 120+, Safari 17+, Firefox 121+, Edge 120+. Older browsers may work but are not tested.' },
  { q: 'Can players join late?', a: 'Yes — until the host advances past the predictions phase. Late joiners can still play trivia duels.' },
  { q: 'What happens if a player disconnects?', a: 'A reconnect banner appears; one tap rejoins them with state preserved. Predictions and points are not lost.' },
  { q: 'Can the host eject a player?', a: 'Yes — host has a player-management panel from the lobby onward.' },
  { q: 'How do duels work?', a: '3-question head-to-head trivia. Winner steals points from loser. Each pair has a host-configurable limit (default 3 duels per night, including rematches).' },
  { q: 'How is scoring calculated?', a: 'See the Scoring page for full formulas. Top-5 picks earn variable points by rank match; Worst-5 earn flat points if the country lands in the bottom 5; trivia and duels add quiz points.' },
  { q: 'What are the five winner categories?', a: 'Champion (most total points), Thief (most points stolen in duels), Duelist (most duels won), Oracle (best predictions), Guru (most correct trivia answers).' },
  { q: 'What is sudden death?', a: 'An optional host-toggleable tiebreak: if two players tie a winner category, one trivia question decides it — fastest correct answer wins.' },
  { q: 'How do you handle Eurovision results?', a: 'Either the host enters jury and televote results live, or the auto-parser pulls them from the official source on grand-final night.' },
  { q: 'Is Eurovision Games official?', a: 'No. We are not affiliated with the European Broadcasting Union, ORF, or the Eurovision Song Contest brand.' },
  { q: 'Where does my data go?', a: 'Stored on Supabase (Postgres + auth). See the Privacy page for retention details.' },
  { q: 'Can I host more than one room?', a: 'Yes — but only one room is active per host at a time during the broadcast.' },
];

export default function FAQPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  // FAQPage schema must include every Q&A — anchored + accordion combined.
  const allFaq = [...ANCHORED, ...MORE_FAQ];
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allFaq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Games FAQ \u2014 Setup, Rules, Scoring & Troubleshooting',
    description: 'Frequently asked questions about Eurovision Games: setup, players, scoring, duels, sudden death, mobile install, troubleshooting, and privacy.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/faq' },
  };

  return (
    <>
      <SchemaHead
        title="Eurovision Games FAQ \u2014 Setup, Rules, Scoring & Troubleshooting"
        description="Frequently asked questions about Eurovision Games: setup, players, scoring, duels, sudden death, mobile install, troubleshooting, and privacy."
        canonical="https://eurovision.games/faq"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games faq',
          'eurovision party game help',
          'how to host eurovision',
          'eurovision games support',
        ]}
        jsonLd={[article, faqSchema, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="FAQ"
        chipTone="pink"
        title="Eurovision Games \u2014 frequently asked questions"
        lede="Quick answers to the questions hosts and players ask most. The three most-asked — creating, joining, and leaving — are highlighted at the top. The rest are in an accordion below. For deeper detail see the rule book, scoring formulas, and setup guide."
      />

      <ContentLayout>
        <Section id="create" title="Creating a room">
          <p>{ANCHORED[0].a}</p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">Defaults that work</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-white/80 text-[15px]">
              <li><strong className="text-white">3 quiz rounds</strong> \u2014 enough warm-up without dragging.</li>
              <li><strong className="text-white">Max 20 players</strong> \u2014 the upper limit; smaller rooms feel snappier.</li>
              <li><strong className="text-white">Per-pair duel cap of 3</strong> \u2014 prevents one-target grinding.</li>
            </ul>
          </div>
        </Section>

        <Section id="join" title="Joining a room">
          <p>{ANCHORED[1].a}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Easiest path:</strong> tap the join link the host shared. One step, no account.</li>
            <li><strong className="text-white">Manual:</strong> open Eurovision Games \u2192 <em>Join Room</em> \u2192 enter the 6-character code plus a display name.</li>
            <li><strong className="text-white">Late joiners</strong> can still play trivia and duels, but predictions are locked once the host advances past Predictions.</li>
          </ul>
        </Section>

        <Section id="leave" title="Leaving or deleting a room">
          <p>{ANCHORED[2].a}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Players</strong> tap their name in the room header \u2192 <em>Leave room</em>. Banked points stay frozen on the leaderboard.</li>
            <li><strong className="text-white">Hosts</strong> have an extra <em>Delete room</em> option in the host panel \u2014 a 5-second confirmation prevents accidents.</li>
            <li><strong className="text-white">Accidental leave?</strong> Re-join with the same code and display name. Your points are restored.</li>
          </ul>
        </Section>

        <Section title="More questions">
          <FaqAccordion items={MORE_FAQ} />
        </Section>

        <CtaBanner
          title="Couldn\u2019t find an answer?"
          body="Hop into a room and ask the host \u2014 or check the About page for direct contact details."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'About / contact', href: '/about' }}
        />

        <RelatedCards
          items={[
            { href: '/how-to-play', title: 'How to play', blurb: '60-second setup walkthrough from create-room to trophy reveal.' },
            { href: '/rules', title: 'Rule book', blurb: 'Phase-by-phase rules, sudden death, and edge cases.' },
            { href: '/scoring', title: 'Scoring formulas', blurb: 'Exact point math behind every prediction, quiz answer, and duel.' },
            { href: '/privacy', title: 'Privacy', blurb: 'What we store, where it lives, and retention windows.' },
            { href: '/about', title: 'About / contact', blurb: 'Who builds Eurovision Games and how to reach us.' },
            { href: '/eurovision-night', title: 'Eurovision night', blurb: 'Hosting guide for grand-final night with a full timeline.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
