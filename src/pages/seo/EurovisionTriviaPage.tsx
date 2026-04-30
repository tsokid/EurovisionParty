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
  { label: 'Eurovision trivia', href: '/eurovision-trivia' },
];

const SAMPLE_QUESTIONS = [
  {
    q: 'Which country has won Eurovision the most times?',
    options: ['Sweden', 'Ireland', 'United Kingdom', 'France'],
    answer: 'Ireland and Sweden tie with 7 wins each (Sweden caught up in 2023 with Loreen).',
  },
  {
    q: 'In what year did ABBA win Eurovision?',
    options: ['1972', '1974', '1976', '1980'],
    answer: '1974, with "Waterloo" representing Sweden.',
  },
  {
    q: 'Where will Eurovision 2026 be held?',
    options: ['Stockholm', 'Vienna', 'Liverpool', 'Madrid'],
    answer: 'Vienna, Austria — JJ won 2025 in Basel.',
  },
  {
    q: 'What does the "douze points" award?',
    options: ['10 points', '12 points', '8 points', '7 points'],
    answer: '12 points — the highest score a jury or country can give in a single vote.',
  },
  {
    q: 'Which country has competed the most times without winning?',
    options: ['Cyprus', 'Iceland', 'Malta', 'Bulgaria'],
    answer: 'Cyprus — runner-up multiple times, never first.',
  },
  {
    q: 'What was Conchita Wurst\u2019s winning song in 2014?',
    options: ['Heroes', 'Rise Like a Phoenix', 'Euphoria', 'Toy'],
    answer: 'Rise Like a Phoenix (Austria, 2014).',
  },
  {
    q: 'Which country withdrew from Eurovision after winning multiple early contests, then returned in 2011?',
    options: ['Italy', 'Monaco', 'Yugoslavia', 'Luxembourg'],
    answer: 'Italy — winners in 1964 and 1990, withdrew in 1997, returned in 2011.',
  },
  {
    q: 'How many points did Loreen score with "Tattoo" in 2023?',
    options: ['340', '440', '583', '628'],
    answer: '583 — winning Sweden its 7th title.',
  },
  {
    q: 'What is the maximum number of points a country can earn in the modern voting system?',
    options: ['400', '500', '600', '744'],
    answer: 'Effectively unbounded; in practice the record sits around 758 (Salvador Sobral, Portugal 2017).',
  },
  {
    q: 'In what year did Eurovision allow public televoting for the first time across most participating countries?',
    options: ['1991', '1997', '2001', '2009'],
    answer: '1997 — five countries trialled televoting; it expanded rapidly thereafter.',
  },
];

const FAQ = [
  {
    q: 'How are trivia questions chosen?',
    a: 'Questions are pulled from a curated Eurovision trivia bank covering winners, voting milestones, language rules, country debuts, and viral moments. The room\u2019s decade preference biases which era questions skew toward.',
  },
  {
    q: 'How long do I have to answer?',
    a: 'Each question runs on a 12-second timer in duels. Score = 12 minus elapsed seconds, so a 1-second hesitation costs a full point. Wrong answers and timeouts score zero.',
  },
  {
    q: 'Can I duel the same player repeatedly?',
    a: 'The host sets a per-pair cap when creating the room — default 3 duels, max 10. Rematches count, so you cannot grind a single weaker opponent for points.',
  },
  {
    q: 'Is there a solo trivia mode?',
    a: 'Yes — Quiz mode runs during the Preshow phase before duels unlock. The host triggers fast-fire rounds; everyone answers in parallel and scores stack into the predictions total.',
  },
];

export default function EurovisionTriviaPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Trivia — Sample Questions and How to Play Live',
    description: 'A 10-question Eurovision trivia sampler with answers, plus how to run head-to-head trivia duels live during the broadcast.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-trivia' },
  };
  const quizSchema = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: 'Eurovision Trivia — 10 Sample Questions',
    about: 'Eurovision Song Contest history, voting, and winners',
    hasPart: SAMPLE_QUESTIONS.map((s) => ({
      '@type': 'Question',
      name: s.q,
      acceptedAnswer: { '@type': 'Answer', text: s.answer },
    })),
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
        title="Eurovision Trivia — 10 Sample Questions + How to Play Live"
        description="A 10-question Eurovision trivia sampler with answers, plus how to run head-to-head trivia duels live during the broadcast."
        canonical="https://eurovision.games/eurovision-trivia"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision trivia',
          'eurovision quiz',
          'eurovision trivia questions',
          'eurovision quiz game',
          'eurovision quiz with friends',
        ]}
        jsonLd={[article, quizSchema, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Trivia + duels"
        chipTone="purple"
        title="Eurovision trivia — sample questions and how to play live"
        lede="Eurovision trivia is a question-and-answer format about the history, voting, and winners of the Eurovision Song Contest. In Eurovision Games, trivia is the duel mechanic: any two players can challenge each other to a head-to-head 3-question round during the broadcast, and the winner steals points from the loser."
      />

      <ContentLayout>
        <Section title="What is Eurovision trivia?">
          <p>
            The Eurovision Song Contest has been running since 1956, with 50+ countries competing across 69 grand finals
            (1956-2025; 2020 cancelled) — that&apos;s a deep well of trivia. Categories that come up most: winners by year,
            voting milestones, language rules, scoring changes, country debuts and withdrawals, viral entries, controversies,
            and song titles.
          </p>
        </Section>

        <Section title="Sample questions (with answers)">
          <p>Ten questions pulled from the live bank — try them before you challenge a friend.</p>
          <ol className="space-y-4 list-none pl-0">
            {SAMPLE_QUESTIONS.map((s, i) => (
              <li
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
              >
                <p className="font-semibold text-white text-[16px] mb-3">
                  <span className="text-euro-pink-light mr-2">Q{i + 1}.</span>
                  {s.q}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 list-none pl-0">
                  {s.options.map((o) => (
                    <li
                      key={o}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80"
                    >
                      {o}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-white/70">
                  <em className="text-euro-pink-light not-italic font-semibold">Answer: </em>
                  {s.answer}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Categories and difficulty tiers">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Easy:</strong> winners by country, the douze points rule, host city.</li>
            <li><strong className="text-white">Medium:</strong> song titles, year-of-debut, semi-final placements.</li>
            <li><strong className="text-white">Hard:</strong> voting reform years, withdrawals, controversies, language rules.</li>
          </ul>
        </Section>

        <Section title="How duels work in Eurovision Games">
          <p>
            Click any other player&apos;s name in the live leaderboard, hit <em>Challenge</em>, and a 3-question duel pops up on both
            your screens. Each player has 15 seconds per question. Whoever gets more correct wins; faster correct answers break a
            tie. The winner steals points from the loser. Each pair can duel a host-configurable maximum (default 3 times) per
            night including rematches, so you can&apos;t farm one weaker opponent.
          </p>
          <p>
            For the full duel rule book — scoring math, Steal vs Double, and the Duelist/Thief trophies — see the
            <a href="/duels" className="text-euro-pink-light hover:text-white underline underline-offset-2"> dedicated duels page</a>.
          </p>
        </Section>

        <Section title="Play live">
          <p>
            Trivia happens during the show. Best windows: between underwhelming entries, during the interval act, and through the
            jury vote. <a href="/" className="text-euro-pink-light hover:text-white underline underline-offset-2">Create a room</a> on
            Eurovision Games and invite up to 19 friends to play.
          </p>
        </Section>

        <Section title="Frequently asked questions">
          <FaqAccordion items={FAQ} />
        </Section>

        <CtaBanner
          title="Quiz your friends tonight"
          body="Open a room and trigger your first round in 60 seconds."
          primary={{ label: 'Create', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/duels', title: 'Eurovision duels', blurb: 'Head-to-head 3-question duels during the live show.' },
            { href: '/eurovision-2026-predictions', title: '2026 predictions', blurb: 'Top 5 and Worst 5 format, scoring, and strategy.' },
            { href: '/how-to-play', title: 'How to play', blurb: 'The 60-second walkthrough from create-room to trophy reveal.' },
            { href: '/scoring', title: 'Scoring formulas', blurb: 'How quiz, duel, and prediction points feed the Champion total.' },
            { href: '/rules', title: 'Rule book', blurb: 'Sudden death, refused duels, and tiebreak protocol.' },
            { href: '/eurovision-night', title: 'Eurovision night', blurb: 'The 10-step playbook for hosting a watch party.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
