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
import { COUNTRIES_2026 as CANON, BOYCOTTING_2026 } from '../../lib/countries2026';

// Build the display list straight off the canonical participant table so the
// SEO copy can never drift from the actual game line-up. Sorted alphabetically
// and host (Austria) tagged inline for clarity.
const COUNTRIES_2026 = [...CANON]
  .map((c) => (c.semi === 'host' ? `${c.name} (host)` : c.name))
  .sort((a, b) => a.localeCompare(b));

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: '2026 predictions', href: '/eurovision-2026-predictions' },
];

const FAQ = [
  {
    q: 'Can I change my list?',
    a: 'Up until the host advances the phase. After that, locked.',
  },
  {
    q: 'What about semi-final exits?',
    a: 'Eurovision Games scores against the grand-final result. Countries that don\u2019t qualify count as "outside Top 5" — zero points if you picked them.',
  },
  {
    q: 'How does the app know the results?',
    a: 'The host enters jury and televote results live during the show; or the auto-parser pulls them from the official source.',
  },
];

export default function Predictions2026Page() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision 2026 Predictions — Top 5 / Worst 5 Format',
    description: 'A complete predictions guide for Eurovision 2026 in Vienna: the competing countries, the Top 5 / Worst 5 format, scoring formulas, and strategy tips.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-2026-predictions' },
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
        title="Eurovision 2026 Predictions — Top 5 / Worst 5 Format & Strategy"
        description="A complete predictions guide for Eurovision 2026 in Vienna: the competing countries, the Top 5 / Worst 5 format, scoring formulas, and strategy tips."
        canonical="https://eurovision.games/eurovision-2026-predictions"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision 2026 predictions',
          'eurovision 2026 top 5',
          'eurovision 2026 worst 5',
          'eurovision predictions game',
          'eurovision 2026 lineup',
        ]}
        jsonLd={[article, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="2026 format"
        chipTone="purple"
        title="Eurovision 2026 predictions — Top 5 and Worst 5 format"
        lede="Eurovision 2026 takes place in Vienna, Austria on Saturday 16 May 2026, hosted by ORF after JJ&apos;s 2025 win in Basel. In Eurovision Games each player builds two prediction lists — Top 5 and Worst 5 — before the show starts, then watches them auto-score against the official jury and televote results in real time."
      />

      <ContentLayout>
        <Section title="The 2026 line-up">
          <p>
            {COUNTRIES_2026.length} countries are confirmed for Eurovision 2026 across two semi-finals and the grand final:
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-white/80">
            {COUNTRIES_2026.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-sm text-white/60">
            Withdrawn / boycotting in 2026: {BOYCOTTING_2026.join(', ')}. Spain&apos;s exit shrinks the &quot;Big Five&quot; to a Big
            Four (France, Germany, Italy, United Kingdom).
          </p>
          <p className="text-sm text-white/60">
            The grand-final running order is fixed after the second semi-final; this page updates with live entries once the parser
            publishes them.
          </p>
        </Section>

        <Section title="Prediction format">
          <p>Each player builds two lists before the host advances the lobby phase:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Top 5</strong> — five countries you think will finish highest in the combined jury + televote.</li>
            <li><strong className="text-white">Worst 5</strong> — five countries you think will finish lowest.</li>
          </ul>
          <p>
            Lists are <strong className="text-white">ordered</strong>: a #1 pick that wins scores more than a #5 pick that wins. You cannot put the same
            country in both lists. Lists lock when the host clicks <em>Advance to Predictions Locked</em>.
          </p>
        </Section>

        <Section title="Scoring — Top 5">
          <p>For each Top-5 pick, you score against the official combined jury + televote ranking:</p>
          <DataTable
            headers={['Result', 'Points']}
            align={['left', 'right']}
            rows={[
              ['Country at the exact position you predicted', <strong key="a" className="text-white">50</strong>],
              ['Country in the official Top 5 but at a different position', <strong key="b" className="text-white">20</strong>],
              ['Country outside the Top 5', <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p>Maximum Top-5 points: 5 exact positions × 50 = <strong className="text-white">250</strong>.</p>
        </Section>

        <Section title="Scoring — Worst 5">
          <p>Worst-5 is symmetrical — last place counts as position 1 in your list:</p>
          <DataTable
            headers={['Result', 'Points']}
            align={['left', 'right']}
            rows={[
              ['Country at the exact bottom position you predicted', <strong key="a" className="text-white">50</strong>],
              ['Country in the official Worst 5 but at a different position', <strong key="b" className="text-white">20</strong>],
              ['Country outside the Worst 5', <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p>Maximum Worst-5 points: <strong className="text-white">250</strong>. Combined predictions cap: <strong className="text-white">500</strong>.</p>
        </Section>

        <Section title="Strategy tips">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Trust the betting markets, but don&apos;t copy them.</strong> Top-3 favourites usually deliver, but the #4-#10 range is where rankings re-shuffle wildly between jury and televote.</li>
            <li><strong className="text-white">Worst 5 is where games are won.</strong> Most players over-think the top and ignore the bottom. Three correct Worst-5 picks = 30 free points.</li>
            <li><strong className="text-white">Watch the semi-final running order.</strong> Late slots in the second semi tend to make grand-final spots they don&apos;t deserve — they&apos;re fresh in jury memory.</li>
            <li><strong className="text-white">Don&apos;t bet against the host.</strong> Austria 2026 won&apos;t win, but they probably won&apos;t bottom either.</li>
          </ul>
        </Section>

        <Section title="Frequently asked questions">
          <FaqAccordion items={FAQ} />
        </Section>

        <CtaBanner
          title="Lock your Top 5 before kick-off"
          body="Create a room and invite up to 19 friends to predict."
          primary={{ label: 'Create', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-night', title: 'Eurovision night', blurb: 'The 10-step playbook for hosting a watch party.' },
            { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '10 sample questions and how the live bank works.' },
            { href: '/duels', title: 'Eurovision duels', blurb: 'Head-to-head 3-question duels during the live show.' },
            { href: '/scoring', title: 'Scoring formulas', blurb: 'Where predictions, duels, and quiz feed into the Champion total.' },
            { href: '/how-to-play', title: 'How to play', blurb: 'The 60-second walkthrough from create-room to trophy reveal.' },
            { href: '/faq', title: 'FAQ', blurb: 'Answers to common questions about hosting, joining, and scoring.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
