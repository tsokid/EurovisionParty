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
        description="The exact scoring formulas for Eurovision Games: Top-5 prediction points by rank, Worst-5 flat points, quiz speed bonuses, duel steal/double, and penalties."
        canonical="https://eurovision.games/scoring"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision Games — exact scoring formulas</h1>
        <p className="lead">
          <strong>Every action in Eurovision Games maps to a transparent point total.</strong> This page lists the formulas the
          server uses to compute Top-5 and Worst-5 predictions, quiz answers, and duel outcomes. Useful if you&apos;re strategising
          before the show — or arguing with the host afterwards.
        </p>

        <h2>Quiz scoring</h2>
        <ul>
          <li><strong>Correct answer:</strong> 100 points base.</li>
          <li><strong>Speed bonus:</strong> up to +50, scaled linearly from 15 sec (no bonus) to 1 sec (full bonus).</li>
          <li><strong>Wrong answer:</strong> 0 points. No penalty.</li>
          <li><strong>Timeout:</strong> 0 points.</li>
        </ul>
        <p>Maximum quiz points per round (5 questions × 150) = 750.</p>

        <h2>Top-5 prediction scoring</h2>
        <p>Each Top-5 pick scores based on your ordered position vs the country&apos;s actual finish:</p>
        <table>
          <thead><tr><th>Your position</th><th>Country finished</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>#1</td><td>Won (1st)</td><td>50</td></tr>
            <tr><td>#1</td><td>Top 3 (2-3)</td><td>30</td></tr>
            <tr><td>#1</td><td>Top 5 (4-5)</td><td>20</td></tr>
            <tr><td>#2 or #3</td><td>Top 5</td><td>15</td></tr>
            <tr><td>#4 or #5</td><td>Top 5</td><td>10</td></tr>
            <tr><td>any</td><td>Outside Top 5</td><td>0</td></tr>
          </tbody>
        </table>
        <p>Maximum Top-5 points: <strong>110</strong> (#1 wins + four supporting picks all in Top 5).</p>

        <h2>Worst-5 prediction scoring</h2>
        <p>Each Worst-5 pick that finishes in the actual bottom 5 of the grand final scores a flat <strong>10 points</strong>. Position within the Worst-5 list does not matter.</p>
        <p>Maximum Worst-5 points: <strong>50</strong>.</p>

        <h2>Duel scoring</h2>
        <p>A duel is 3 trivia questions, head-to-head:</p>
        <ul>
          <li>Each correct answer scores 100 base + speed bonus (same as quiz).</li>
          <li>Whoever has more correct answers wins the duel; ties broken by total response time.</li>
          <li>The winner chooses <strong>Steal</strong> (take 100 pts from loser&apos;s total) or <strong>Double</strong> (gain own 100 pts from the pool).</li>
          <li>If neither player gets any correct, the duel is void (no transfer).</li>
        </ul>

        <h2>Steal vs Double — strategy</h2>
        <p>
          <strong>Steal</strong> hurts the leader more (it&apos;s a zero-sum point swing: +100 to you, -100 to them).{' '}
          <strong>Double</strong> is a flat gain for you, no penalty to the loser. Steal when you&apos;re close to second place
          and want to overtake; Double when you&apos;re comfortably leading and don&apos;t need to widen the gap.
        </p>

        <h2>Penalties</h2>
        <ul>
          <li><strong>Quitting mid-game:</strong> player is marked away; no points lost, but their predictions still score automatically.</li>
          <li><strong>Refusing every duel challenge:</strong> no penalty, but other players will notice. The Duelist title is impossible without participating.</li>
          <li><strong>Cheating</strong> (multiple devices, AI assist): host discretion; suggested penalty is voiding all duel points.</li>
        </ul>

        <h2>Worked example</h2>
        <p>You scored:</p>
        <ul>
          <li>Quiz: 3 correct out of 15 questions = ~360 pts</li>
          <li>Predictions: #1 pick won (50) + #3 pick finished 4th (15) + 2 Worst-5 hits (20) = 85 pts</li>
          <li>Duels: 2 wins, both Steal = +200 (and 2 losses = -200) → net 0 from duels</li>
          <li><strong>Total: 445 pts</strong></li>
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
