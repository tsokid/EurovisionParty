import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

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
    q: 'What was Conchita Wurst&apos;s winning song in 2014?',
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

export default function EurovisionTriviaPage() {
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
  return (
    <>
      <SchemaHead
        title="Eurovision Trivia — 10 Sample Questions + How to Play Live"
        description="A 10-question Eurovision trivia sampler with answers, plus how to run head-to-head trivia duels live during the broadcast."
        canonical="https://eurovision.games/eurovision-trivia"
        jsonLd={quizSchema}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision trivia — sample questions and how to play live</h1>
        <p className="lead">
          <strong>Eurovision trivia is a question-and-answer format about the history, voting, and winners of the Eurovision Song
          Contest.</strong> In <a href="/">Eurovision Games</a>, trivia is the duel mechanic: any two players can challenge each
          other to a head-to-head 3-question round during the broadcast, and the winner steals points from the loser.
        </p>

        <h2>What is Eurovision trivia?</h2>
        <p>
          The Eurovision Song Contest has been running since 1956, with 50+ countries competing across 69 grand finals (1956-2025; 2020 cancelled) — that&apos;s
          a deep well of trivia. Categories that come up most: winners by year, voting milestones, language rules, scoring
          changes, country debuts and withdrawals, viral entries, controversies, and song titles.
        </p>

        <h2>Sample questions (with answers)</h2>
        <ol>
          {SAMPLE_QUESTIONS.map((s, i) => (
            <li key={i}>
              <p><strong>{s.q}</strong></p>
              <ul>
                {s.options.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              <p><em>Answer:</em> {s.answer}</p>
            </li>
          ))}
        </ol>

        <h2>Categories and difficulty tiers</h2>
        <ul>
          <li><strong>Easy:</strong> winners by country, the douze points rule, host city.</li>
          <li><strong>Medium:</strong> song titles, year-of-debut, semi-final placements.</li>
          <li><strong>Hard:</strong> voting reform years, withdrawals, controversies, language rules.</li>
        </ul>

        <h2>How duels work in Eurovision Games</h2>
        <p>
          Click any other player&apos;s name in the live leaderboard, hit <em>Challenge</em>, and a 3-question duel pops up on both
          your screens. Each player has 15 seconds per question. Whoever gets more correct wins; faster correct answers break a
          tie. The winner steals points from the loser. Each pair can duel a host-configurable maximum (default 3 times) per
          night including rematches, so you can&apos;t farm one weaker opponent.
        </p>

        <h2>Play live</h2>
        <p>
          Trivia happens during the show. Best windows: between underwhelming entries, during the interval act, and through the
          jury vote. <a href="/">Create a room</a> on Eurovision Games and invite up to 19 friends to play.
        </p>
        <p>
          Related: <a href="/how-to-play">2-minute setup guide</a> · <a href="/scoring">scoring formulas</a> ·{' '}
          <a href="/eurovision-2026-predictions">2026 prediction format</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
