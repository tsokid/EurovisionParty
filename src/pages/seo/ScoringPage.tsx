import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Scoring', href: '/scoring' },
];

export default function ScoringPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Games \u2014 Exact Scoring Formulas',
    description: 'Exact scoring formulas for Eurovision Games: Top-5 and Worst-5 prediction points, quiz response-time tiers, duel point math, and Steal vs Double effects.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/scoring' },
  };

  return (
    <>
      <SchemaHead
        title="Eurovision Games Scoring \u2014 Exact Formulas for Predictions, Quiz & Duels"
        description="The exact scoring formulas Eurovision Games uses for Top-5 and Worst-5 predictions, quiz response-time tiers, duel point math, Steal vs Double, and edge cases."
        canonical="https://eurovision.games/scoring"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games scoring',
          'eurovision points formula',
          'eurovision prediction scoring',
          'eurovision duel scoring',
        ]}
        jsonLd={[article, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Scoring formulas"
        chipTone="gold"
        title="Eurovision Games \u2014 exact scoring formulas"
        lede="Every action maps to a transparent point total. This page lists the exact formulas the server uses to compute Top-5 and Worst-5 predictions, quiz answers, and duel outcomes — useful if you\u2019re strategising before the show or arguing with the host afterwards."
      />

      <ContentLayout>
        <Section title="Quiz scoring">
          <p>
            Each quiz round is 10 questions, 4 options per question, 15-second timer. Points are tier-based on response
            time \u2014 fast and right pays the most.
          </p>
          <DataTable
            headers={['Response time', 'Points (correct)']}
            align={['left', 'right']}
            rows={[
              ['0\u20133 seconds', <strong key="a" className="text-white">12</strong>],
              ['3.01\u20137 seconds', <strong key="b" className="text-white">8</strong>],
              ['7.01\u201315 seconds', <strong key="c" className="text-white">4</strong>],
              ['Wrong / timeout', <span key="d" className="text-white/50">0</span>],
            ]}
          />
          <p className="text-white/70 text-[15px]">
            Maximum quiz points per round: 10 questions \u00d7 12 = <strong className="text-white">120</strong>. Default night
            runs 3 rounds (host configurable, 1\u20133) for a quiz cap of <strong className="text-white">360</strong> points.
          </p>
        </Section>

        <Section title="Top-5 prediction scoring">
          <p>Each Top-5 pick is scored against the official combined jury + televote ranking:</p>
          <DataTable
            headers={['Result', 'Points']}
            align={['left', 'right']}
            rows={[
              ['Country at the exact position you predicted', <strong key="a" className="text-white">50</strong>],
              ['Country in the official Top 5 but at a different position', <strong key="b" className="text-white">20</strong>],
              ['Country outside the Top 5', <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p className="text-white/70 text-[15px]">
            Maximum Top-5 points: 5 exact positions \u00d7 50 = <strong className="text-white">250</strong>.
          </p>
        </Section>

        <Section title="Worst-5 prediction scoring">
          <p>
            Symmetrical to Top-5, scored against the official bottom 5 (last-place country = position 1 in your Worst-5
            list):
          </p>
          <DataTable
            headers={['Result', 'Points']}
            align={['left', 'right']}
            rows={[
              ['Country at the exact bottom position you predicted', <strong key="a" className="text-white">50</strong>],
              ['Country in the official Worst 5 but at a different position', <strong key="b" className="text-white">20</strong>],
              ['Country outside the Worst 5', <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p className="text-white/70 text-[15px]">
            Maximum Worst-5 points: <strong className="text-white">250</strong>. Combined predictions cap:{' '}
            <strong className="text-white">500</strong>.
          </p>
        </Section>

        <Section title="Duel scoring">
          <p>
            A duel is 3 trivia questions, head-to-head. Each correct answer scores by elapsed seconds \u2014 a half-second
            hesitation costs you a point.
          </p>
          <DataTable
            headers={['Scenario', 'Points']}
            align={['left', 'right']}
            rows={[
              ['Correct answer at 0\u20131 seconds', <strong key="a" className="text-white">11\u201312</strong>],
              ['Correct answer at 5 seconds', <strong key="b" className="text-white">7</strong>],
              ['Correct answer at 11 seconds', <strong key="c" className="text-white">1</strong>],
              ['Wrong / timeout (\u226512s)', <span key="d" className="text-white/50">0</span>],
              ['Win bonus (higher answer total)', <strong key="e" className="text-euro-pink-light">+12</strong>],
            ]}
          />
          <p>
            Whoever has the higher answer total wins the duel; if tied, faster total response time breaks it. The winner
            also pockets a flat <strong className="text-white">+12</strong> duel-win bonus. Their total earned that duel is
            called <em>v_winner_score</em>.
          </p>
        </Section>

        <Section title="Steal vs Double">
          <p>The duel winner picks one of two effects on the points they just earned:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">\u2694\ufe0f Steal</h3>
              <p className="text-white/80 text-[15px] leading-relaxed">
                Take <em>v_winner_score</em> points from the loser\u2019s banked total. Capped at what the loser actually has \u2014
                you cannot take them below zero. Zero-sum swing: your gain matches their loss. Best when overtaking the
                leader matters more than the absolute gain.
              </p>
            </div>
            <div className="rounded-2xl border border-euro-purple-light/30 bg-euro-purple-light/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">\u2728 Double</h3>
              <p className="text-white/80 text-[15px] leading-relaxed">
                Add another <em>v_winner_score</em> to your own total. Loser keeps their points. Better when you\u2019re already
                ahead and don\u2019t want to fuel a revenge challenge \u2014 strictly better when the loser has less than{' '}
                <em>v_winner_score</em> banked.
              </p>
            </div>
          </div>
          <p className="text-white/70 text-[15px]">
            Both pay the same to you when the opponent has at least <em>v_winner_score</em> banked; if they don\u2019t,
            Double pays more.
          </p>
        </Section>

        <Section title="Penalties and edge cases">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Quitting mid-game.</strong> Player marked away. Predictions still auto-score; quiz and duel opportunities are forfeited.</li>
            <li><strong className="text-white">Refused duel challenges.</strong> Tracked per player but no point penalty. The Duelist trophy rewards participation.</li>
            <li><strong className="text-white">Mid-duel disconnect.</strong> Unanswered questions score 0; duel resolves on whoever has more points.</li>
            <li><strong className="text-white">Cheating</strong> (multi-device, AI assist): host discretion; suggested resolution is voiding affected duels and quiz rounds.</li>
            <li><strong className="text-white">Steal cap.</strong> You cannot drag the loser below zero \u2014 if they have less banked than <em>v_winner_score</em>, Steal only takes what\u2019s there.</li>
          </ul>
        </Section>

        <Section title="Worked example">
          <p>You finished the night with:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Quiz.</strong> 18 correct out of 30, mostly tier-2 timing \u2192 <strong className="text-white">~144</strong> pts.</li>
            <li><strong className="text-white">Predictions.</strong> 1 exact Top-5 hit (50) + 2 in-Top-5 wrong-position (40) + 1 exact Worst-5 (50) + 1 in-Worst-5 (20) = <strong className="text-white">160</strong> pts.</li>
            <li><strong className="text-white">Duels.</strong> Won 2, both Steal \u2014 28 pts swung your way and another 24 stolen on the second = 52 from steals + 2 \u00d7 12 win bonus = <strong className="text-white">76</strong> pts net.</li>
            <li><strong className="text-white">Total: 380 pts.</strong> Likely Champion contender on a normal night.</li>
          </ul>
        </Section>

        <CtaBanner
          title="Try the math live"
          body="Spin up a room and watch the points stack."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-2026-predictions', title: 'Predictions', blurb: 'Top 5 and Worst 5 mechanics with the 2026 country list.' },
            { href: '/duels', title: 'Duels', blurb: 'Steal vs Double strategy, per-pair caps, and trophy impact.' },
            { href: '/eurovision-trivia', title: 'Trivia', blurb: '50+ sample questions and the bank quiz/duels pull from.' },
            { href: '/rules', title: 'Rule book', blurb: 'Phase-by-phase rules, sudden death, and edge cases.' },
            { href: '/how-to-play', title: 'How to play', blurb: '60-second setup walkthrough from create-room to trophy reveal.' },
            { href: '/eurovision-night', title: 'Eurovision night', blurb: 'Hosting guide for grand-final night with a full timeline.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
