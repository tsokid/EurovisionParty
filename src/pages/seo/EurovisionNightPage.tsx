import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function EurovisionNightPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Night — How to Host the Perfect Watch Party',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
    dateModified: '2026-04-30',
  };
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Host Eurovision Night',
    step: [
      { '@type': 'HowToStep', name: 'Pick a venue', text: 'Decide on living-room, garden, or video-call. Confirm the broadcast source.' },
      { '@type': 'HowToStep', name: 'Set up the game', text: 'Open eurovision.games, create a room, share the code with guests.' },
      { '@type': 'HowToStep', name: 'Plan food and drink', text: 'One country-themed snack per top contender; a flexible "voting break" buffet.' },
      { '@type': 'HowToStep', name: 'Lock predictions before the show', text: 'Everyone fills in Top 5 / Worst 5 before the first song airs.' },
      { '@type': 'HowToStep', name: 'Run trivia duels in the breaks', text: 'Use commentary slots and the interval act for head-to-head duels.' },
      { '@type': 'HowToStep', name: 'Crown your winners', text: 'After the final televote, the app reveals five trophy cards.' },
    ],
  };
  return (
    <>
      <SchemaHead
        title="Eurovision Night — Host the Perfect Watch Party (2026 Guide)"
        description="A practical guide to hosting Eurovision night: setup, food, drinks, predictions, trivia, voting, and live scoring with friends. Free to play."
        canonical="https://eurovision.games/eurovision-night"
        jsonLd={[article, howTo]}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision night — host the perfect watch party</h1>
        <p className="lead">
          <strong>Eurovision night is the annual living-room ritual where you watch the Eurovision Song Contest with friends</strong>,
          rate every song, and argue about which country deserves to win. This guide turns it from a passive viewing into a
          competitive, scored party game using <a href="/">Eurovision Games</a> — a free browser-based companion that handles
          predictions, trivia, and scoring while you watch.
        </p>

        <h2>What is Eurovision night?</h2>
        <p>
          Eurovision night is the live grand-final broadcast of the Eurovision Song Contest, held on the second Saturday of May
          each year. In 2026 the grand final airs on <strong>Saturday 16 May 2026</strong> from Vienna, with semi-finals earlier
          that week. Across Europe (and Australia) it is a single televised live event watched by ~160 million people; in homes
          it has become a competitive social event, a costume party, and a drinking game all at once.
        </p>

        <h2>How to host (10-step playbook)</h2>
        <ol>
          <li><strong>Pick a venue.</strong> Living-room, garden, projector on a wall — or a Zoom/FaceTime call if you&apos;re scattered.</li>
          <li><strong>Confirm the broadcast.</strong> National broadcaster (BBC One, ARD, ERT, RAI, etc.) or the official YouTube live-stream where licensing allows.</li>
          <li><strong>Send a save-the-date.</strong> Doors open ~1 hour before kick-off so guests can settle and lock predictions.</li>
          <li><strong>Open Eurovision Games.</strong> Create a room at <a href="/">eurovision.games</a> on the host&apos;s phone or laptop, share the join link.</li>
          <li><strong>Set the lineup.</strong> Print or screenshot the 2026 running order so everyone has a reference for predictions.</li>
          <li><strong>Lock predictions.</strong> Before the first song, every guest picks Top 5 and Worst 5.</li>
          <li><strong>Watch song-by-song.</strong> React, score, take photos. Encourage opinionated commentary.</li>
          <li><strong>Use breaks for trivia duels.</strong> The interval act is ~25 minutes — perfect duel window.</li>
          <li><strong>Watch the vote.</strong> Jury vote first, then televote — the most chaotic 25 minutes of TV all year.</li>
          <li><strong>Crown winners.</strong> After the televote, the app reveals five trophy cards — Champion, Thief, Duelist, Oracle, Guru.</li>
        </ol>

        <h2>Food and drink ideas</h2>
        <p>
          The classic move: <strong>one snack per favourite country</strong>. Sweden = meatballs and Daim. Italy = arancini.
          Greece = spanakopita. UK = sausage rolls. Don&apos;t over-cater — the focus is the screen. A flexible buffet that survives
          the 4-hour run-time beats a hot served dinner. Mocktails travel well; an alcohol-free option keeps drivers and
          non-drinkers happy through to the televote.
        </p>

        <h2>Time-zone tips</h2>
        <p>
          Grand final start times vary by country: 21:00 CET (Germany, France, Spain), 20:00 BST/UTC+1 (UK, Ireland), 22:00 EET
          (Greece, Cyprus, Finland, Israel), 05:00 AEDT next morning (Australia — record it). If you&apos;re hosting cross-country,
          align on the host&apos;s local kick-off and start the room 30 minutes earlier.
        </p>

        <h2>Game options inside the room</h2>
        <ul>
          <li><strong>Predictions:</strong> Top 5, Worst 5 — locked before the show, scored automatically against jury + televote.</li>
          <li><strong>Trivia duels:</strong> Head-to-head between any two players. Winner steals points from loser. Cap of 2 duels per pair.</li>
          <li><strong>Quiz rounds:</strong> Fast-fire rounds the host triggers between performances.</li>
          <li><strong>Sudden-death tiebreak:</strong> Optional. If two players tie a winner category, one buzzer-style trivia question decides it.</li>
        </ul>

        <h2>FAQ</h2>
        <p>
          <strong>Do I need an account?</strong> No. Guests join with just a room code. The host signs in once.
          <br />
          <strong>How many players?</strong> 2 to 10. Couples can share a screen.
          <br />
          <strong>Does it run on TV?</strong> The phone or laptop is the dashboard; the broadcast stays on the TV.
        </p>
        <p>
          Next: <a href="/eurovision-party">themed Eurovision party planning</a> ·{' '}
          <a href="/eurovision-2026-predictions">2026 prediction format</a> ·{' '}
          <a href="/how-to-play">how the game works in 2 minutes</a>.
        </p>
        <p>
          <a href="/" className="btn-primary">Create your Eurovision night room →</a>
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
