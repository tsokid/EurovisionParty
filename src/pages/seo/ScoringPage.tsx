import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function ScoringPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Games — Scoring Formulas',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Eurovision Games Scoring — Exact Formulas for Predictions, Quiz &amp; Duels"
        description="The exact scoring formulas for Eurovision Games: Top-5 and Worst-5 prediction points, quiz response-time tiers, duel point math, and steal vs double."
        canonical="https://eurovision.games/scoring"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision Games — exact scoring formulas</h1>
        <p className="lead">
          <strong>Every action in Eurovision Games maps to a transparent point total.</strong> This page lists the exact
          formulas the server uses to compute Top-5 and Worst-5 predictions, quiz answers, and duel outcomes — useful if
          you&apos;re strategising before the show or arguing with the host afterwards.
        </p>

        <h2>Quiz scoring</h2>
        <p>Each quiz round is 10 questions, 4 options per question, 15-second timer. Points are tier-based on response time:</p>
        <table>
          <thead><tr><th>Response time</th><th>Points (correct)</th></tr></thead>
          <tbody>
            <tr><td>0-3 seconds</td><td>12</td></tr>
            <tr><td>3.01-7 seconds</td><td>8</td></tr>
            <tr><td>7.01-15 seconds</td><td>4</td></tr>
            <tr><td>Wrong / timeout</td><td>0</td></tr>
          </tbody>
        </table>
        <p>Maximum quiz points per round: 10 questions × 12 = <strong>120</strong>. Default night runs 3 rounds (host
        configurable, 1-3) for a quiz cap of <strong>360</strong> points.</p>

        <h2>Top-5 prediction scoring</h2>
        <p>Each Top-5 pick is scored against the official combined jury + televote ranking:</p>
        <table>
          <thead><tr><th>Result</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Country at the exact position you predicted</td><td>50</td></tr>
            <tr><td>Country in the official Top 5 but at a different position</td><td>20</td></tr>
            <tr><td>Country outside the Top 5</td><td>0</td></tr>
          </tbody>
        </table>
        <p>Maximum Top-5 points: 5 exact positions × 50 = <strong>250</strong>.</p>

        <h2>Worst-5 prediction scoring</h2>
        <p>Symmetrical to Top-5, against the official bottom 5 (last place = position 1 in your Worst-5 list):</p>
        <table>
          <thead><tr><th>Result</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Country at the exact bottom position you predicted</td><td>50</td></tr>
            <tr><td>Country in the official Worst 5 but at a different position</td><td>20</td></tr>
            <tr><td>Country outside the Worst 5</td><td>0</td></tr>
          </tbody>
        </table>
        <p>Maximum Worst-5 points: <strong>250</strong>. Combined predictions cap: <strong>500</strong>.</p>

        <h2>Duel scoring</h2>
        <p>A duel is 3 trivia questions, head-to-head. Each correct answer scores by elapsed seconds:</p>
        <ul>
          <li>0 seconds in: 12 points. 1 second: 11. 2 seconds: 10. … 11 seconds: 1. 12+ seconds or wrong: 0.</li>
          <li>Whoever has the higher answer total wins the duel; if tied, faster total response time breaks the tie.</li>
          <li>The winner also receives a flat <strong>+12</strong> duel-win bonus.</li>
        </ul>
        <p>The winner then chooses one of two effects on the points they earned that duel (their <em>v_winner_score</em>):</p>
        <ul>
          <li><strong>Steal:</strong> take <em>v_winner_score</em> points from the loser&apos;s total (capped at what the loser actually has — you can&apos;t take them below zero).</li>
          <li><strong>Double:</strong> add another <em>v_winner_score</em> to your own total. The loser keeps their points.</li>
        </ul>

        <h2>Steal vs Double — strategy</h2>
        <p>
          <strong>Steal</strong> creates a zero-sum swing — useful when overtaking the leader matters more than the absolute
          gain. <strong>Double</strong> is a flat add — useful when you&apos;re leading and don&apos;t want to give the loser a
          revenge motive. Both pay the same to you when the opponent has at least <em>v_winner_score</em> banked; if they
          don&apos;t, Double pays more.
        </p>

        <h2>Penalties and edge cases</h2>
        <ul>
          <li><strong>Quitting mid-game:</strong> player marked away. Predictions still auto-score; quiz/duel opportunities are forfeited.</li>
          <li><strong>Refused duel challenges:</strong> tracked per player. No point penalty, but the Duelist title needs participation.</li>
          <li><strong>Cheating</strong> (multi-device, AI assist): host discretion; suggested resolution is voiding affected duels.</li>
        </ul>

        <h2>Worked example</h2>
        <p>You finished the night with:</p>
        <ul>
          <li>Quiz: 18 correct out of 30 questions, mostly tier-2 timing → ~144 pts</li>
          <li>Predictions: 1 exact Top-5 hit (50) + 2 in-Top-5 wrong-position (40) + 1 exact Worst-5 (50) + 1 in-Worst-5 (20) = 160 pts</li>
          <li>Duels: won 2, both Steal — say 28 pts swung your way and another 24 stolen on the second = 52 from steals + 2 × 12 win bonus = 76 pts net</li>
          <li><strong>Total: 380 pts</strong></li>
        </ul>

        <p>
          Related: <a href="/rules">full rule book</a> · <a href="/eurovision-2026-predictions">2026 prediction format</a> ·{' '}
          <a href="/faq">FAQ</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
