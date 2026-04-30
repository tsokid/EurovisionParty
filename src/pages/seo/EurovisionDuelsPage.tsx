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
  { label: 'Duels', href: '/duels' },
];

const FAQ = [
  {
    q: 'What is a Eurovision duel?',
    a: 'A duel is a 3-question, head-to-head trivia battle between two players in the same Eurovision Games room. The winner can either steal points from the loser or double their own points. Duels happen live during the show — typically during ad breaks or postcard interludes.',
  },
  {
    q: 'When can I duel?',
    a: 'Duels unlock from the Live Show phase and stay open through results. They are locked during Preshow (lobby + predictions). Quiz mode is also locked once Live Show starts — duels replace it.',
  },
  {
    q: 'How many duels can I have with one person?',
    a: 'The host sets a per-pair cap when creating the room (default 3, max 10). The cap counts rematches, so you cannot grind one opponent for points all night.',
  },
  {
    q: 'How are duel points calculated?',
    a: 'Each correct answer scores 12 minus elapsed seconds (12 at 0s, 1 at 11s, 0 after 12s or wrong). Whoever has the higher answer total wins the duel and gets a flat +12 bonus on top. The winner then chooses Steal (take winner_score from the loser) or Double (add winner_score to themselves).',
  },
];

export default function EurovisionDuelsPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Duels — Head-to-Head Trivia During the Live Show',
    description: 'Rules, scoring, and strategy for 3-question head-to-head Eurovision trivia duels. Steal points or double your own.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/duels' },
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
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to win a Eurovision duel',
    description: 'A 3-question, 12-second-per-question head-to-head trivia battle. Speed plus accuracy wins; Steal or Double doubles down.',
    totalTime: 'PT2M',
    step: [
      { '@type': 'HowToStep', name: 'Pick an opponent', text: 'During the Live Show phase, tap any other player\u2019s name in the room and choose Challenge.' },
      { '@type': 'HowToStep', name: 'Answer fast', text: 'Each correct answer scores 12 minus elapsed seconds. A 1-second hesitation costs a full point.' },
      { '@type': 'HowToStep', name: 'Win on total', text: 'Highest answer total wins the duel and gets a flat +12 win bonus.' },
      { '@type': 'HowToStep', name: 'Steal or Double', text: 'Winner picks: Steal takes points from the loser, Double adds points to themselves. Loser keeps points if Double.' },
    ],
  };

  return (
    <>
      <SchemaHead
        title="Eurovision Duels \u2014 Head-to-Head Trivia for the Live Show"
        description="Challenge friends to 3-question Eurovision trivia duels during the live show. Steal their points or double your own. Full rules, scoring, and strategy."
        canonical="https://eurovision.games/duels"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision duels', 'eurovision trivia game', 'head to head eurovision quiz',
          'eurovision party game', 'steal points eurovision', 'eurovision live show game',
        ]}
        jsonLd={[article, howTo, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Live-show feature"
        chipTone="purple"
        title="Eurovision duels — head-to-head trivia during the live show"
        lede="A duel turns the dead air between performances into a battlefield. Challenge anyone in your room to a 3-question Eurovision trivia fight — winner steals their points or doubles their own. Two of the five end-of-night trophies (Duelist, Thief) are decided here."
      />

      <ContentLayout wide>
        <Section title="What is a Eurovision duel?">
          <p>
            A duel is a private 3-question Eurovision trivia round between exactly two players in the same room.
            Both players answer the same questions on a 12-second timer. The first question fires once the challenger
            accepts; everyone else in the room sees a discreet <em>&quot;duel in progress&quot;</em> chip but the
            questions stay private until the duel ends.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">3 questions.</strong> Pulled from the Eurovision trivia bank, weighted toward the room&apos;s decade preference.</li>
            <li><strong className="text-white">12 seconds per question.</strong> Score = 12 minus elapsed seconds, rounded down. Wrong or out of time = 0.</li>
            <li><strong className="text-white">Winner takes the bigger answer total</strong> — plus a flat +12 win bonus.</li>
            <li><strong className="text-white">Steal or Double.</strong> Winner picks one. Loser keeps their points if Double; loses up to <em>winner_score</em> if Steal.</li>
          </ul>
        </Section>

        <Section title="When duels are available">
          <p>
            Duels unlock from the <strong className="text-white">Live Show</strong> phase onward. During the
            <strong className="text-white"> Preshow</strong> phase (lobby + predictions) all duel buttons are inactive — that&apos;s
            also when Quiz mode is open. Once the broadcast starts and the host advances to Live Show, Quiz locks and
            duels open. Both stay open through Results and Winners reveal.
          </p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6 text-[16px]">
            <p className="text-white/85">
              <strong className="text-white">Phase rule of thumb:</strong> Quiz is the warm-up, duels are the main event.
              You build score with predictions before the show, defend it with quiz before kick-off, then attack rivals
              with duels during commercial breaks.
            </p>
          </div>
        </Section>

        <Section title="Scoring math">
          <p>The formula rewards speed and accuracy equally — a half-second hesitation costs you a point.</p>
          <DataTable
            headers={['Scenario', 'Points']}
            align={['left', 'right']}
            rows={[
              ['Correct answer at 0–1 seconds', <strong key="a" className="text-white">11–12</strong>],
              ['Correct answer at 5 seconds', <strong key="b" className="text-white">7</strong>],
              ['Correct answer at 11 seconds', <strong key="c" className="text-white">1</strong>],
              ['Wrong / timeout', <span key="d" className="text-white/50">0</span>],
              ['Win bonus', <strong key="e" className="text-euro-pink-light">+12</strong>],
            ]}
          />
          <p>
            The winner&apos;s total earned that duel is called <em>winner_score</em>. They then pick:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Steal</strong> — take <em>winner_score</em> from the loser&apos;s banked total. Capped at what the loser actually has (you cannot take them below zero).</li>
            <li><strong className="text-white">Double</strong> — add another <em>winner_score</em> to yourself. Loser keeps their score.</li>
          </ul>
        </Section>

        <Section title="Steal vs Double — when each one wins">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">⚔️ Steal</h3>
              <p className="text-white/80 text-[15px] leading-relaxed">
                Zero-sum swing — your gain is matched by their loss. Use it when overtaking the leader matters more
                than the absolute gain (mid-show, leaderboard tight, you&apos;re second by 30 points).
              </p>
            </div>
            <div className="rounded-2xl border border-euro-purple-light/30 bg-euro-purple-light/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">✨ Double</h3>
              <p className="text-white/80 text-[15px] leading-relaxed">
                Flat add — better when you&apos;re already ahead and don&apos;t want to fuel a revenge challenge. Strictly
                better when the loser has less than <em>winner_score</em> banked (no points to steal anyway).
              </p>
            </div>
          </div>
        </Section>

        <Section title="How duels feed the trophies">
          <p>Two of the five end-of-night trophies come straight from duel data:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Duelist</strong> — most duels won across the night.</li>
            <li><strong className="text-white">Thief</strong> — most points taken via Steal.</li>
          </ul>
          <p>
            See the <a href="/scoring" className="text-euro-pink-light hover:text-white underline underline-offset-2">full scoring page</a> for
            how Duelist and Thief feed into the Champion total, and the <a href="/rules" className="text-euro-pink-light hover:text-white underline underline-offset-2">rule book</a> for
            sudden-death tiebreaks when two players tie a trophy category.
          </p>
        </Section>

        <Section title="Hosting tips">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Set the cap to 3.</strong> Default per-pair cap. Bump to 5+ only for small rooms (3-5 players).</li>
            <li><strong className="text-white">Encourage duels in the breaks.</strong> The interval act runs ~25 minutes — perfect duel window for everyone.</li>
            <li><strong className="text-white">Refusing is allowed but tracked.</strong> No point penalty, but the Duelist trophy rewards participation.</li>
            <li><strong className="text-white">Watch the leaderboard chip.</strong> If one player is running away with it, organize a Steal pile-on.</li>
          </ul>
        </Section>

        <Section title="Frequently asked questions">
          <FaqAccordion items={FAQ} />
        </Section>

        <CtaBanner
          title="Start a room and challenge your friends"
          body="Duels open the moment the host advances to Live Show. Spin up a room in 60 seconds and have the link ready before the first song airs."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '50+ sample questions plus the bank duels pull from.' },
            { href: '/scoring', title: 'Full scoring formulas', blurb: 'Where Steal and Double feed into Champion / Thief / Duelist.' },
            { href: '/eurovision-2026-predictions', title: '2026 predictions', blurb: 'Lock Top 5 and Worst 5 before the show — points stack with duels.' },
            { href: '/how-to-play', title: 'How to play in 60 seconds', blurb: 'Setup walkthrough from create-room to trophy reveal.' },
            { href: '/rules', title: 'Rule book', blurb: 'Sudden death, refused duels, and tiebreak protocol.' },
            { href: '/faq#leave', title: 'Leaving or deleting a room', blurb: 'What happens to your duel record if you leave mid-show.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
