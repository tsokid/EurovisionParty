import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function EurovisionGamesPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Games — Free Browser-Based Party Game',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Eurovision Games — Free Multiplayer Party Game for Eurovision 2026"
        description="A free browser-based Eurovision party game with predictions, trivia duels, and live scoring. 2-10 players, no download, works on phone or desktop."
        canonical="https://eurovision.games/eurovision-games"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision games — what they are and how to play</h1>
        <p className="lead">
          <strong>Eurovision games are interactive party games designed to be played alongside the Eurovision Song Contest broadcast.</strong>{' '}
          They turn watching the show into a scored competition — predicting winners, voting on songs, and answering trivia — so
          everyone in the room has skin in the game. <a href="/">Eurovision Games</a> is a free, browser-based version that handles
          all the scoring automatically.
        </p>

        <h2>Why play games during Eurovision?</h2>
        <p>
          The grand final runs about four hours including the televote. Without something to do, guests drift to phones during
          the entries they don&apos;t care about. A scored game keeps everyone watching: each song matters because it might be the
          one that decides your prediction, and the trivia duels in the breaks keep energy high during the long jury-vote stretch.
        </p>

        <h2>Free vs paid</h2>
        <p>
          Eurovision Games is free — no subscriptions, no in-app purchases, no signup required for guests to join. The host
          authenticates once by email; players just need the room code. Compared to printable bingo cards or paid commercial
          quiz packs, the live-scoring version handles every calculation, so no one is doing arithmetic during the televote.
        </p>

        <h2>What&apos;s in the game</h2>
        <ul>
          <li><strong>Predictions:</strong> Pick your Top 5 and Worst 5 of Eurovision 2026 before the show.</li>
          <li><strong>Trivia duels:</strong> Challenge any other player to a head-to-head trivia round, winner steals points.</li>
          <li><strong>Quiz rounds:</strong> Host-triggered fast-fire rounds between songs.</li>
          <li><strong>Live scoring:</strong> Top-5 and Worst-5 picks score automatically against jury + televote results.</li>
          <li><strong>Five winner categories:</strong> Champion, Thief, Duelist, Oracle, Guru — with optional sudden-death tiebreak.</li>
        </ul>

        <h2>Comparison with other Eurovision party formats</h2>
        <table>
          <thead>
            <tr><th>Format</th><th>Setup time</th><th>Live scoring</th><th>Cost</th></tr>
          </thead>
          <tbody>
            <tr><td>Eurovision Games</td><td>60 sec</td><td>Yes</td><td>Free</td></tr>
            <tr><td>Printable bingo</td><td>5 min</td><td>Manual</td><td>Free</td></tr>
            <tr><td>Commercial quiz packs</td><td>10 min</td><td>Manual</td><td>£10-20</td></tr>
            <tr><td>Custom spreadsheet</td><td>30 min</td><td>Manual</td><td>Free</td></tr>
          </tbody>
        </table>

        <h2>Get started</h2>
        <p>
          Open <a href="/">eurovision.games</a> on the host&apos;s phone or laptop, click <em>Create Room</em>, and share the join code.
          Players join in their own browsers — no install, no signup. See <a href="/how-to-play">the 2-minute setup guide</a> for
          the full walkthrough, or jump to <a href="/eurovision-2026-predictions">the 2026 predictions format</a>.
        </p>
        <p>
          Related: <a href="/eurovision-party">Eurovision party planning</a> ·{' '}
          <a href="/eurovision-trivia">trivia samples</a> · <a href="/online-games">online games</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
