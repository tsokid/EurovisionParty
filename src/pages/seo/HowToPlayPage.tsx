import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'How to play', href: '/how-to-play' },
];

export default function HowToPlayPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How to Play Eurovision Games \u2014 2-Minute Setup Guide',
    description: 'Step-by-step guide to running a Eurovision watch party with predictions, trivia duels, and live scoring. Setup takes 60 seconds.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/how-to-play' },
  };

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to play Eurovision Games',
    description: 'A 60-second setup that takes you from create-room to trophy reveal across the full Eurovision broadcast.',
    totalTime: 'PT2M',
    step: [
      { '@type': 'HowToStep', name: 'Create a room', text: 'Click "Create Room", set max players (2-20), quiz rounds (1-3), and per-pair duel cap (default 3).' },
      { '@type': 'HowToStep', name: 'Invite friends', text: 'Share the 6-character room code, link, and auto-generated room password. Friends join in their browser, no app install.' },
      { '@type': 'HowToStep', name: 'Lock predictions', text: 'Each player picks their Top 5 and Worst 5 of Eurovision 2026. Picks lock when the host advances the phase.' },
      { '@type': 'HowToStep', name: 'Battle in duels', text: 'During the live show, challenge friends to head-to-head 3-question trivia duels. Steal points or double your own.' },
      { '@type': 'HowToStep', name: 'Watch live scoring', text: 'As Eurovision jury and televote results land, predictions auto-score and the leaderboard updates in real time.' },
      { '@type': 'HowToStep', name: 'Crown winners', text: 'Five trophies reveal at the end: Champion, Thief, Duelist, Oracle, Guru. Optional sudden-death tiebreak settles ties.' },
    ],
  };

  return (
    <>
      <SchemaHead
        title="How to Play Eurovision Games \u2014 2-Minute Setup Guide"
        description="Quick guide to running a Eurovision watch party with predictions, trivia duels, and live scoring. Setup takes 60 seconds, supports 2-20 players, no app install."
        canonical="https://eurovision.games/how-to-play"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games how to play',
          'eurovision party game setup',
          'free eurovision watch party game',
          'eurovision rules',
          'eurovision drinking game alternative',
        ]}
        jsonLd={[article, howTo, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Setup guide"
        chipTone="pink"
        title="How to play Eurovision Games in 60 seconds"
        lede="A free, browser-based party game for the Eurovision Song Contest. Players predict the Top 5 and Worst 5, battle in head-to-head trivia duels, and chase five winner trophies — all while the show is on. No app, no account for guests, 2 to 20 players."
      />

      <ContentLayout>
        <Section title="Setup in 60 seconds">
          <p>
            One host signs in (magic-link email — no password). Everyone else joins from a link. The whole flow from
            empty browser tab to locked-in predictions is a single minute.
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-white/80 marker:text-euro-pink-light marker:font-bold">
            <li><strong className="text-white">Create the room (10s).</strong> Click <em>Create Room</em>. Pick quiz rounds (default 3), max players (up to 20), and the per-pair duel cap (default 3). A 6-character room code appears.</li>
            <li><strong className="text-white">Invite friends (20s).</strong> Share the code, the join link, and the auto-generated room password (included in the share message). Phone or laptop, any modern browser.</li>
            <li><strong className="text-white">Lock predictions (5 min before kick-off).</strong> Every player builds a Top 5 and Worst 5. Picks lock when the host advances past the predictions phase.</li>
            <li><strong className="text-white">Trivia warm-up.</strong> Quiz rounds run during the predictions phase as filler — points carry into the night total.</li>
            <li><strong className="text-white">Live show \u2014 duel time.</strong> Once the host advances to Live Show, quiz closes and duels open. Challenge anyone in the room.</li>
            <li><strong className="text-white">Trophy reveal.</strong> When results are entered, the room moves to Final and five winners are crowned.</li>
          </ol>
        </Section>

        <Section title="Lock predictions">
          <p>
            Predictions are the bedrock of the night — they score automatically the moment Eurovision results come in,
            so they reward homework and a bit of nerve.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Top 5.</strong> The five countries you think will finish 1\u20135 in the official combined ranking, in your predicted order.</li>
            <li><strong className="text-white">Worst 5.</strong> The five countries you think will finish bottom of the leaderboard, ordered last-place first.</li>
            <li><strong className="text-white">No overlap.</strong> A country can appear in only one list per player.</li>
            <li><strong className="text-white">Order matters.</strong> An exact-position hit pays 50 points; a country that lands in the right list at the wrong rank pays 20.</li>
            <li><strong className="text-white">Hard lock.</strong> Once the host advances past Predictions, no edits. Late joiners can still play trivia and duels but cannot enter predictions.</li>
          </ul>
        </Section>

        <Section title="Trivia duels during the show">
          <p>
            A duel is a 3-question Eurovision trivia battle between two players in the room. Questions fire on a 12-second
            timer; speed and accuracy both count.
          </p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">How a duel plays out</h3>
            <p className="text-white/85 text-[15px] leading-relaxed">
              Tap any other player\u2019s name during the live show and choose <em>Challenge</em>. Both players answer the same
              3 questions in private. The higher answer total wins the duel and pockets a flat <strong className="text-white">+12</strong> bonus.
              The winner then picks <strong className="text-white">Steal</strong> (take points from the loser) or <strong className="text-white">Double</strong> (add the same to themselves).
            </p>
          </div>
          <p className="text-white/70 text-[15px]">
            The host sets a per-pair cap when creating the room (default 3, max 10) so you cannot grind one opponent
            for points all night. Refused challenges don\u2019t count against the cap.
          </p>
        </Section>

        <Section title="Live scoring">
          <p>
            As Eurovision jury and televote results come in, predictions auto-score against the official combined ranking
            and the leaderboard updates instantly for everyone in the room.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Top 5 / Worst 5</strong> score against the final combined ranking the moment results land.</li>
            <li><strong className="text-white">Quiz points</strong> are banked from the predictions phase and never change.</li>
            <li><strong className="text-white">Duel points</strong> swing in real time as duels resolve through the broadcast.</li>
            <li><strong className="text-white">Either</strong> the host enters jury and televote results live, or the auto-parser pulls them on grand-final night.</li>
          </ul>
        </Section>

        <Section title="Five winner trophies">
          <p>At the end of the night, five trophy cards reveal in sequence:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Champion</strong> \u2014 most total points across every phase. The headline title.</li>
            <li><strong className="text-white">Thief</strong> \u2014 most points stolen via duel Steal effects.</li>
            <li><strong className="text-white">Duelist</strong> \u2014 most duels won across the night.</li>
            <li><strong className="text-white">Oracle</strong> \u2014 highest prediction-only score (Top 5 + Worst 5 totals).</li>
            <li><strong className="text-white">Guru</strong> \u2014 most correct trivia answers across quiz and duels combined.</li>
          </ul>
          <p className="text-white/70 text-[15px]">
            One player can win multiple trophies. Co-winners (2\u20135 tied) split a single trophy unless the host triggers
            sudden death.
          </p>
        </Section>

        <Section title="Sudden-death tiebreak">
          <p>
            For any tied trophy category, the host can open a 20-second sudden-death round. One trivia question, all
            tied players answer in parallel \u2014 fastest correct answer wins the title outright. If nobody is correct,
            the co-winner status persists.
          </p>
        </Section>

        <Section title="What you need">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">A modern browser.</strong> Chrome 120+, Safari 17+, Firefox 121+, Edge 120+ \u2014 phone or desktop. PWA install on iOS and Android.</li>
            <li><strong className="text-white">2 to 20 players.</strong> Couples can share a single device.</li>
            <li><strong className="text-white">The Eurovision broadcast.</strong> TV, official stream, or the EBU\u2019s YouTube live feed \u2014 anything that lets you watch in real time.</li>
            <li><strong className="text-white">No payment, no install, no account for guests.</strong> Only the host signs in.</li>
          </ul>
        </Section>

        <CtaBanner
          title="Start a room now"
          body="60 seconds, no install, no account."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'Eurovision night', href: '/eurovision-night' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-2026-predictions', title: 'Predictions explained', blurb: 'Top 5 and Worst 5 mechanics, scoring, and 2026 country list.' },
            { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '50+ sample questions and the bank quiz/duels pull from.' },
            { href: '/duels', title: 'Duel deep-dive', blurb: 'Steal vs Double strategy, per-pair caps, and trophy impact.' },
            { href: '/scoring', title: 'Scoring formulas', blurb: 'Exact point math behind every prediction, quiz answer, and duel.' },
            { href: '/rules', title: 'Full rule book', blurb: 'Phase-by-phase rules, disconnect policy, and edge cases.' },
            { href: '/faq', title: 'FAQ', blurb: 'Quick answers on creating rooms, joining, and leaving mid-night.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
