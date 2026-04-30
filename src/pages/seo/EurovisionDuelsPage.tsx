import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function EurovisionDuelsPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Duels — Head-to-Head Trivia During the Live Show',
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
        name: 'What is a Eurovision duel?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A duel is a 3-question, head-to-head trivia battle between two players in the same Eurovision Games room. The winner can either steal points from the loser or double their own points. Duels happen live during the show, typically during ad breaks or postcard interludes.',
        },
      },
      {
        '@type': 'Question',
        name: 'When can I duel?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Duels are unlocked from the Live Show phase and stay open through results. They are locked during the Preshow (lobby + predictions) phase. Quiz mode is also locked once Live Show starts — duels replace it.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many duels can I have with one person?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The host sets a duel cap per pair when creating the room (default 3, max 10). This includes rematches, so you cannot grind one opponent for points all night.',
        },
      },
      {
        '@type': 'Question',
        name: 'How are duel points calculated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Each correct answer scores 12 points minus elapsed seconds (12 at 0s, 1 at 11s, 0 after 12s or wrong). Whoever has the higher answer total wins the duel and gets a flat +12 bonus on top. The winner then chooses Steal (take winner_score from the loser) or Double (add winner_score to themselves).',
        },
      },
    ],
  };

  return (
    <>
      <SchemaHead
        title="Eurovision Duels — Head-to-Head Trivia for the Live Show"
        description="Challenge friends to 3-question Eurovision trivia duels during the live show. Steal their points or double your own. Full rules, scoring, and strategy."
        canonical="https://eurovision.games/duels"
        jsonLd={[article, faq]}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Duels — head-to-head Eurovision trivia, live during the show</h1>
        <p className="lead">
          <strong>Duels turn the dead air between Eurovision performances into a battlefield.</strong> Challenge anyone in
          your room to a 3-question trivia fight. Win, and you choose: <em>steal</em> their points, or <em>double</em> your
          own. Lose, and you might be giving up the lead you spent the whole show building.
        </p>

        <h2>What a duel is</h2>
        <p>
          A duel is a private 3-question Eurovision trivia round between exactly two players in the same room. Both
          players answer the same questions on a 12-second timer. The first question fires once the challenger accepts;
          everyone else in the room sees a discreet &quot;duel in progress&quot; chip but the questions stay private.
        </p>
        <ul>
          <li><strong>3 questions.</strong> Pulled from the Eurovision trivia bank, weighted toward whatever decade the room is from.</li>
          <li><strong>12 seconds per question.</strong> Score = 12 minus elapsed seconds, rounded down. Wrong or out of time = 0.</li>
          <li><strong>Winner takes the bigger answer total</strong>, plus a flat +12 win bonus.</li>
          <li><strong>Steal or Double.</strong> Winner picks one. Loser keeps their points if Double; loses up to <em>winner_score</em> if Steal.</li>
        </ul>

        <h2>When duels are available</h2>
        <p>
          Duels are unlocked from the <strong>Live Show</strong> phase onward. During the Preshow phase (lobby +
          predictions), all duel buttons are inactive — that's also when Quiz mode is open. Once the Eurovision broadcast
          starts and the host advances to Live Show, Quiz locks and duels open. Both stay open through Results and
          Winners reveal.
        </p>

        <h2>Scoring math</h2>
        <table>
          <thead>
            <tr><th>Scenario</th><th>Points</th></tr>
          </thead>
          <tbody>
            <tr><td>Correct answer at 0–1s</td><td>11–12</td></tr>
            <tr><td>Correct answer at 5s</td><td>7</td></tr>
            <tr><td>Correct answer at 11s</td><td>1</td></tr>
            <tr><td>Wrong / timeout</td><td>0</td></tr>
            <tr><td>Win bonus</td><td>+12</td></tr>
          </tbody>
        </table>
        <p>
          The winner's total earned that duel is called <em>winner_score</em>. They then pick:
        </p>
        <ul>
          <li><strong>Steal</strong> — take <em>winner_score</em> from the loser's banked total. Capped at what the loser has (you cannot take them below zero).</li>
          <li><strong>Double</strong> — add another <em>winner_score</em> to yourself. Loser keeps their score.</li>
        </ul>

        <h2>Steal vs Double — when each one wins</h2>
        <p>
          <strong>Steal</strong> creates a zero-sum swing — your gain is matched by their loss. Use it when overtaking the
          leader matters more than the absolute gain (e.g. mid-show, leaderboard tight).
        </p>
        <p>
          <strong>Double</strong> is a flat add — better when you're already ahead and don't want to fuel a revenge
          challenge from the loser. Also strictly better when the loser has less than <em>winner_score</em> banked.
        </p>

        <h2>How duels feed the winner trophies</h2>
        <p>At the end of the night, two of the five trophies come straight from duel data:</p>
        <ul>
          <li><strong>Duelist</strong> — most duels won.</li>
          <li><strong>Thief</strong> — most points stolen via Steal across the whole night.</li>
        </ul>

        <h2>Hosting tips</h2>
        <ul>
          <li>Set the per-pair cap to 3 unless your group is small (then 5+ is fine).</li>
          <li>Encourage duels during ad breaks and postcards — they drag on otherwise.</li>
          <li>Refusing duels is allowed but tracked. No point penalty, but the Duelist trophy rewards participation.</li>
        </ul>

        <p>
          Related: <a href="/eurovision-trivia">trivia question bank</a> · <a href="/scoring">full scoring formulas</a>{' '}
          · <a href="/rules">rule book</a> · <a href="/eurovision-2026-predictions">2026 predictions</a>.
        </p>
        <p>
          <a href="/" className="btn-primary">Start a room and duel your friends →</a>
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
