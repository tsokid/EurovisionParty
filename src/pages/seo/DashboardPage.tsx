import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function DashboardPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The Eurovision Games Dashboard — Live Leaderboard Explained',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
    dateModified: '2026-04-30',
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the Dashboard?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The Dashboard is the always-visible leaderboard that updates in real time as predictions resolve, quiz answers come in, and duels finish. It shows every player ranked by total points across all four sources: predictions, quiz, duels, and trophy bonuses.',
        },
      },
      {
        '@type': 'Question',
        name: 'When does the Dashboard update?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Live, push-driven. Quiz answers update on submission; duels update on finish; predictions update as the host enters Eurovision results (or as the auto-parser pulls them). No refresh needed.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I see the breakdown per player?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Tap a player on the Dashboard to see their points split into prediction, quiz, duel-won, duel-stolen, and trophy components — useful for arguing about who actually deserved Champion.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who can see the Dashboard?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Every player in the room sees the same live leaderboard. There is no spectator mode — Eurovision Games is for participants, not lurkers.',
        },
      },
    ],
  };

  return (
    <>
      <SchemaHead
        title="Dashboard — Live Leaderboard for Eurovision Games"
        description="The Dashboard is the live leaderboard for your Eurovision Games room. Push-updated as predictions resolve, quiz answers land, and duels finish."
        canonical="https://eurovision.games/dashboard"
        jsonLd={[article, faq]}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>The Dashboard — your live Eurovision leaderboard</h1>
        <p className="lead">
          <strong>The Dashboard is the heartbeat of every Eurovision Games room.</strong> It's the always-visible
          leaderboard that updates in real time — every prediction that resolves, every quiz answer, every duel finish
          pushes new totals to everyone in the room without a refresh.
        </p>

        <h2>What the Dashboard shows</h2>
        <ul>
          <li><strong>Total points</strong> per player, ranked highest to lowest.</li>
          <li><strong>Live position swings</strong> — arrows next to each player when their rank changes.</li>
          <li><strong>Source split</strong> on tap: predictions, quiz, duels won, points stolen, trophy bonuses.</li>
          <li><strong>Phase indicator</strong> — Lobby, Predictions, Quiz, Live Show, Results, Winners.</li>
          <li><strong>You vs leader</strong> gap chip — how far you are from first.</li>
        </ul>

        <h2>How the four point sources flow into the Dashboard</h2>
        <p>Your total on the Dashboard is the sum of four components, all live:</p>
        <table>
          <thead>
            <tr><th>Source</th><th>Updates when</th><th>Cap</th></tr>
          </thead>
          <tbody>
            <tr><td>Predictions (Top 5 + Worst 5)</td><td>Host enters Eurovision results, or parser pulls them</td><td>500</td></tr>
            <tr><td>Quiz</td><td>Each round ends</td><td>360 (3 rounds × 120)</td></tr>
            <tr><td>Duels — won</td><td>Each duel finishes</td><td>open</td></tr>
            <tr><td>Duels — stolen</td><td>Each Steal finishes</td><td>open</td></tr>
          </tbody>
        </table>

        <h2>When the Dashboard is most active</h2>
        <ul>
          <li><strong>Quiz round end</strong> — sudden vertical jumps as 10 questions resolve at once.</li>
          <li><strong>During live results entry</strong> — biggest swings of the night as 26+ predictions auto-score.</li>
          <li><strong>Live duels</strong> — small but constant updates as challenges fire and resolve.</li>
        </ul>

        <h2>What the Dashboard does NOT show</h2>
        <ul>
          <li>Other players' Top 5 / Worst 5 picks before they lock — those stay private until the host advances.</li>
          <li>Who challenged whom in a duel until the duel completes (only the participants see questions).</li>
          <li>The trophy winners — those are revealed at the end on a dedicated Winners screen.</li>
        </ul>

        <h2>Hosting view vs player view</h2>
        <p>
          The host sees one extra control on the Dashboard — a phase advance button. Players see the same leaderboard but
          no controls. Everyone's totals are identical; there is no &quot;hidden host bonus.&quot;
        </p>

        <p>
          Related: <a href="/eurovision-2026-predictions">predictions feature</a> · <a href="/duels">duels feature</a> ·{' '}
          <a href="/eurovision-trivia">quiz / trivia</a> · <a href="/scoring">scoring formulas</a>.
        </p>
        <p>
          <a href="/" className="btn-primary">Open a room and watch the Dashboard light up →</a>
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
