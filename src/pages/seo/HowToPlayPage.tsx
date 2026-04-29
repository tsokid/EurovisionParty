import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function HowToPlayPage() {
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to play Eurovision Games',
    step: [
      { '@type': 'HowToStep', name: 'Create a room', text: 'Click "Create Room", set max players (2-10) and number of quiz rounds.' },
      { '@type': 'HowToStep', name: 'Invite friends', text: 'Share the room code or link. Friends join in their browser, no app install.' },
      { '@type': 'HowToStep', name: 'Lock predictions', text: 'Each player picks their Top 5 and Worst 5 of Eurovision 2026.' },
      { '@type': 'HowToStep', name: 'Battle in duels', text: 'Challenge friends to head-to-head trivia duels for points.' },
      { '@type': 'HowToStep', name: 'Watch the show', text: 'Live scoring updates as Eurovision results come in.' },
      { '@type': 'HowToStep', name: 'Crown winners', text: 'Five winners are revealed: Champion, Thief, Duelist, Oracle, Guru.' },
    ],
  };
  return (
    <>
      <SchemaHead
        title="How to Play Eurovision Games — 2-Minute Guide"
        description="Quick guide to running a Eurovision watch party with predictions, trivia duels, and live scoring. Setup takes 60 seconds."
        canonical="https://eurovision.games/how-to-play"
        jsonLd={howTo}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>How to play Eurovision Games</h1>
        <p className="lead">
          <strong>Eurovision Games is a free, browser-based party game</strong> for the Eurovision Song Contest. Players predict the
          Top 5 and Worst 5, answer trivia in head-to-head duels, and battle for five winner titles. Setup takes 60 seconds and
          supports 2-10 players.
        </p>
        <h2>1. Create a room (10 seconds)</h2>
        <p>
          Click <em>Create Room</em>. Pick how many quiz rounds (default 3), how many players you expect (up to 10), and a duel
          limit per pair (default 2). A 6-character room code appears.
        </p>
        <h2>2. Invite friends (20 seconds)</h2>
        <p>
          Share the room code, the join link, and the auto-generated room password (included in the share message). Friends open
          the link on phone or laptop — no app install, no account.
        </p>
        <h2>3. Lock predictions (5 minutes)</h2>
        <p>
          Before the show starts, every player builds their <strong>Top 5</strong> (countries they think will win) and{' '}
          <strong>Worst 5</strong> (countries they think will flop). Picks lock when the host advances the phase.
        </p>
        <h2>4. Trivia duels (during the show)</h2>
        <p>
          Challenge any other player to a 3-question trivia duel. Winner steals points from the loser. Each pair can duel a
          maximum of 2 times across the night including rematches, so you can&apos;t grind one opponent.
        </p>
        <h2>5. Live scoring</h2>
        <p>
          As Eurovision jury and televoting results land, predictions auto-score. Top-5 picks earn variable points based on rank
          match; Worst-5 picks reward you for spotting the bottom of the table.
        </p>
        <h2>6. Five winners</h2>
        <p>At the end of the night, five trophy cards reveal:</p>
        <ul>
          <li><strong>Champion</strong> — most total points across all games</li>
          <li><strong>Thief</strong> — most points stolen in duels</li>
          <li><strong>Duelist</strong> — most duels won</li>
          <li><strong>Oracle</strong> — most accurate prediction score</li>
          <li><strong>Guru</strong> — most correct trivia answers</li>
        </ul>
        <p>
          Ties trigger an optional <strong>sudden-death</strong> tiebreak round (host toggle): one trivia question, fastest correct
          answer wins the title outright.
        </p>
        <h2>What you need</h2>
        <ul>
          <li>A modern browser (Chrome, Safari, Firefox, Edge — phone or desktop)</li>
          <li>2-10 friends</li>
          <li>The Eurovision broadcast (TV or stream)</li>
        </ul>
        <p>
          See also: <a href="/rules">full rule book</a>, <a href="/scoring">scoring formulas</a>, and{' '}
          <a href="/eurovision-night">how to host Eurovision night</a>.
        </p>
        <p>
          <a href="/" className="btn-primary">Start a room now →</a>
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
