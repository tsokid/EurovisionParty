import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function OnlineGamesPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Online Games — Free Browser Multiplayer',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Eurovision Online Games — Free Browser Multiplayer for 2026"
        description="Play Eurovision online with friends across cities or countries. Free browser-based multiplayer, no download, real-time scoring. Up to 20 players."
        canonical="https://eurovision.games/online-games"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision online games — play with friends remotely</h1>
        <p className="lead">
          <strong>Eurovision online games are multiplayer games played in a browser during the Eurovision broadcast, designed
          for friends watching from different homes or countries.</strong> <a href="/">Eurovision Games</a> is free, runs on
          phone or desktop, and synchronises predictions, trivia duels, and live scoring across up to 20 players in real time.
        </p>

        <h2>What &quot;online&quot; means here</h2>
        <p>
          Each player sits at home, watches the Eurovision broadcast on their own TV (or stream), and uses a phone or laptop to
          interact with the game. State syncs across everyone in the room within ~200 ms — when one player locks predictions,
          the host sees it instantly. There&apos;s no shared screen requirement: every player has their own dashboard.
        </p>

        <h2>No download, no install</h2>
        <p>
          The game opens in any modern browser — Chrome, Safari, Firefox, Edge — on any operating system. No App Store, no Play
          Store, no &quot;please download our launcher.&quot; The host signs in with email once. Players join by clicking the room link
          and typing their name; no account required.
        </p>

        <h2>Multiplayer mechanics</h2>
        <ul>
          <li><strong>Predictions:</strong> every player builds their own Top 5 / Worst 5 privately; lists lock together when the host advances.</li>
          <li><strong>Trivia duels:</strong> head-to-head challenges between any two players, regardless of where they&apos;re sitting.</li>
          <li><strong>Live leaderboard:</strong> every player sees the full standings, refreshed in real time as scoring happens.</li>
          <li><strong>Sudden-death tiebreak:</strong> if two players tie a winner category at the end, one buzzer-question round resolves it.</li>
        </ul>

        <h2>Browser support</h2>
        <p>
          Tested on Chrome 120+, Safari 17+, Firefox 121+, Edge 120+, on iOS 16+, Android 12+, macOS 13+, Windows 10+, and Linux
          (Chromium and Firefox). Network requirement is light — just enough for real-time presence and scoring updates, well
          under 1 MB per hour of play. Works fine on hotel and café Wi-Fi.
        </p>

        <h2>Mobile vs desktop</h2>
        <p>
          The interface is mobile-first: trivia duels and prediction lists work better on touch than on mouse. Hosts often use a
          laptop for the leaderboard and a phone for personal play. See <a href="/mobile-games">mobile-specific notes</a> for
          installing it as a home-screen app.
        </p>

        <h2>Get started</h2>
        <p>
          Open <a href="/">eurovision.games</a>, click <em>Create Room</em>, and share the join link in your group chat.
          See <a href="/how-to-play">the 2-minute setup guide</a> for the full walkthrough.
        </p>
        <p>
          Related: <a href="/mobile-games">mobile games</a> · <a href="/eurovision-games">Eurovision games overview</a> ·{' '}
          <a href="/eurovision-2026-predictions">2026 predictions</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
