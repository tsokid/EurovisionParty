import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import { COUNTRIES_2026 as CANON, BOYCOTTING_2026 } from '../../lib/countries2026';

// Build the display list straight off the canonical participant table so the
// SEO copy can never drift from the actual game line-up. Sorted alphabetically
// and host (Austria) tagged inline for clarity.
const COUNTRIES_2026 = [...CANON]
  .map((c) => (c.semi === 'host' ? `${c.name} (host)` : c.name))
  .sort((a, b) => a.localeCompare(b));

export default function Predictions2026Page() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision 2026 Predictions — Top 5 / Worst 5 Format',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
    dateModified: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Eurovision 2026 Predictions — Top 5 / Worst 5 Format & Strategy"
        description="A complete predictions guide for Eurovision 2026 in Vienna: the 35 competing countries, the Top 5 / Worst 5 format, scoring formulas, and strategy tips."
        canonical="https://eurovision.games/eurovision-2026-predictions"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision 2026 predictions — Top 5 and Worst 5 format</h1>
        <p className="lead">
          <strong>Eurovision 2026 takes place in Vienna, Austria on Saturday 16 May 2026, hosted by ORF after JJ&apos;s 2025 win in
          Basel.</strong> In <a href="/">Eurovision Games</a> each player builds two prediction lists — Top 5 and Worst 5 — before
          the show starts, then watches them auto-score against the official jury and televote results in real time.
        </p>

        <h2>The 2026 line-up</h2>
        <p>{COUNTRIES_2026.length} countries are confirmed for Eurovision 2026 across two semi-finals and the grand final:</p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
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

        <h2>Prediction format</h2>
        <p>
          Each player builds two lists before the host advances the lobby phase:
        </p>
        <ul>
          <li><strong>Top 5</strong> — five countries you think will finish highest in the combined jury + televote.</li>
          <li><strong>Worst 5</strong> — five countries you think will finish lowest.</li>
        </ul>
        <p>
          Lists are <strong>ordered</strong>: a #1 pick that wins scores more than a #5 pick that wins. You cannot put the same
          country in both lists. Lists lock when the host clicks <em>Advance to Predictions Locked</em>.
        </p>

        <h2>Scoring — Top 5</h2>
        <p>For each Top-5 pick, you score against the official combined jury + televote ranking:</p>
        <table>
          <thead><tr><th>Result</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Country at the exact position you predicted</td><td>50</td></tr>
            <tr><td>Country in the official Top 5 but at a different position</td><td>20</td></tr>
            <tr><td>Country outside the Top 5</td><td>0</td></tr>
          </tbody>
        </table>
        <p>Maximum Top-5 points: 5 exact positions × 50 = <strong>250</strong>.</p>

        <h2>Scoring — Worst 5</h2>
        <p>Worst-5 is symmetrical — last place counts as position 1 in your list:</p>
        <table>
          <thead><tr><th>Result</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Country at the exact bottom position you predicted</td><td>50</td></tr>
            <tr><td>Country in the official Worst 5 but at a different position</td><td>20</td></tr>
            <tr><td>Country outside the Worst 5</td><td>0</td></tr>
          </tbody>
        </table>
        <p>Maximum Worst-5 points: <strong>250</strong>. Combined predictions cap: <strong>500</strong>.</p>

        <h2>Strategy tips</h2>
        <ul>
          <li><strong>Trust the betting markets, but don&apos;t copy them.</strong> Top-3 favourites usually deliver, but the #4-#10
          range is where rankings re-shuffle wildly between jury and televote.</li>
          <li><strong>Worst 5 is where games are won.</strong> Most players over-think the top and ignore the bottom. Three correct
          Worst-5 picks = 30 free points.</li>
          <li><strong>Watch the semi-final running order.</strong> Late slots in the second semi tend to make grand-final spots they
          don&apos;t deserve — they&apos;re fresh in jury memory.</li>
          <li><strong>Don&apos;t bet against the host.</strong> Austria 2026 won&apos;t win, but they probably won&apos;t bottom either.</li>
        </ul>

        <h2>FAQ</h2>
        <p>
          <strong>Can I change my list?</strong> Up until the host advances the phase. After that, locked.
          <br />
          <strong>What about semi-final exits?</strong> Eurovision Games scores against the grand-final result. Countries that
          don&apos;t qualify count as &quot;outside Top 5&quot; — zero points if you picked them.
          <br />
          <strong>How does the app know the results?</strong> The host enters jury and televote results live during the show; or
          the auto-parser pulls them from the official source.
        </p>

        <p>
          Related: <a href="/scoring">all scoring formulas</a> · <a href="/rules">full rule book</a> ·{' '}
          <a href="/eurovision-night">how to host watch night</a>.
        </p>
        <p>
          <a href="/" className="btn-primary">Lock your 2026 predictions →</a>
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
