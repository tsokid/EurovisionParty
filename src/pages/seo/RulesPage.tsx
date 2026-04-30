import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function RulesPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Games — Full Rule Book',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Eurovision Games Rules — Full Rule Book (2026)"
        description="The complete rules of Eurovision Games: phases, prediction lists, trivia duels, scoring, winner categories, sudden-death tiebreak, and dispute resolution."
        canonical="https://eurovision.games/rules"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision Games — full rule book</h1>
        <p className="lead">
          The official rules of <a href="/">Eurovision Games</a>. For a faster overview see{' '}
          <a href="/how-to-play">the 2-minute setup</a>; for scoring formulas see <a href="/scoring">the scoring page</a>.
        </p>

        <h2>Phases</h2>
        <p>The room moves through four phases, advanced manually by the host:</p>
        <ol>
          <li><strong>Lobby</strong> — players join, host configures quiz rounds and duel limits.</li>
          <li><strong>Predictions</strong> — Top 5 / Worst 5 lists are built. Trivia warm-up runs concurrently.</li>
          <li><strong>Voting Live</strong> — show is on, predictions are locked, host enters jury and televote results.</li>
          <li><strong>Final</strong> — winners crowned. Optional sudden-death tiebreak rounds.</li>
        </ol>

        <h2>Predictions rules</h2>
        <ul>
          <li>Each player builds a Top 5 (ordered) and Worst 5 (ordered).</li>
          <li>A country can appear in only one list per player.</li>
          <li>Lists lock when the host advances past Predictions. No edits after lock.</li>
          <li>Late joiners (after lock) cannot enter predictions but can play trivia and duels.</li>
        </ul>

        <h2>Quiz rules</h2>
        <ul>
          <li>The host triggers each quiz round. Default: 3 rounds, 5 questions each.</li>
          <li>Each question has 4 options and a 15-second timer.</li>
          <li>No question is repeated to the same player across the night.</li>
          <li>Answer ties broken by response time.</li>
        </ul>

        <h2>Duel rules</h2>
        <ul>
          <li>Any player can challenge any other player in the room.</li>
          <li>Each duel: 3 questions, 15 sec each, single device per player.</li>
          <li>Winner steals points from the loser; the &quot;steal vs double&quot; choice belongs to the winner.</li>
          <li>Per-pair limit: 2 duels per night, including rematches.</li>
          <li>Refused or expired challenges do not count toward the limit.</li>
        </ul>

        <h2>Scoring rules (summary)</h2>
        <p>See the <a href="/scoring">scoring page</a> for formulas. Headlines:</p>
        <ul>
          <li>Top-5 pick correct: 10-50 pts depending on your position vs theirs.</li>
          <li>Worst-5 pick lands in bottom 5: flat 10 pts each.</li>
          <li>Quiz: 100 pts per correct answer; speed bonus up to +50.</li>
          <li>Duel won: stealer takes 100-300 pts from loser.</li>
        </ul>

        <h2>Winner categories</h2>
        <ul>
          <li><strong>Champion</strong> — most total points across all phases.</li>
          <li><strong>Thief</strong> — most points stolen in duels.</li>
          <li><strong>Duelist</strong> — most duels won.</li>
          <li><strong>Oracle</strong> — highest prediction-only score.</li>
          <li><strong>Guru</strong> — most correct trivia answers.</li>
        </ul>
        <p>
          A player can win multiple categories. Co-winners (2-5 players tied) split a single trophy unless the host triggers
          sudden death.
        </p>

        <h2>Sudden-death tiebreak</h2>
        <p>
          For any tied category, the host can open a 20-second sudden-death round. One trivia question, all tied players
          answer in parallel. Fastest correct answer wins the title outright; the previous co-winners forfeit. If no one is
          correct, the co-winner status persists.
        </p>

        <h2>Disputes</h2>
        <p>
          The host has final authority within a room — they can reset trivia rounds, void duels, or override scoring entries
          if there&apos;s a clear input error. Disputes between players outside the host&apos;s authority should be settled before
          the lobby starts.
        </p>

        <h2>Fair play</h2>
        <ul>
          <li>One device per player. No shared accounts, no AI-assisted answering.</li>
          <li>Treat the game as the entertainment, not the competition.</li>
        </ul>

        <p>
          Related: <a href="/scoring">scoring formulas</a> · <a href="/faq">FAQ</a> ·{' '}
          <a href="/how-to-play">setup guide</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
