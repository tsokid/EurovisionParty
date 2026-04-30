import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function MobileGamesPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Mobile Games — Free PWA for iOS and Android',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Eurovision Mobile Games — Free PWA for iOS &amp; Android (2026)"
        description="Play Eurovision on your phone — a free, mobile-first progressive web app. Install to home screen on iOS or Android, no store download required."
        canonical="https://eurovision.games/mobile-games"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision mobile games — play on your phone</h1>
        <p className="lead">
          <strong>Eurovision Games is a mobile-first progressive web app (PWA) for the Eurovision Song Contest, optimised for
          phone screens and built to install to your home screen on iOS and Android.</strong> No App Store, no Play Store, no
          download — just open the URL and add it to your home screen.
        </p>

        <h2>Mobile-first design</h2>
        <p>
          The interface assumes a phone in portrait. Touch targets are at least 44 × 44 px. Trivia options stack vertically.
          The leaderboard is one-handed scrollable. Prediction lists use long-press drag-to-reorder. Everything that fits the
          phone scales up to tablet and desktop without losing layout.
        </p>

        <h2>Install on iOS</h2>
        <ol>
          <li>Open Safari (must be Safari, not Chrome on iOS)</li>
          <li>Visit <a href="/">eurovision.games</a></li>
          <li>Tap the share button (square with up-arrow)</li>
          <li>Tap <em>Add to Home Screen</em></li>
          <li>Confirm. The icon appears on your home screen and launches without a browser chrome.</li>
        </ol>

        <h2>Install on Android</h2>
        <ol>
          <li>Open Chrome</li>
          <li>Visit <a href="/">eurovision.games</a></li>
          <li>Tap the three-dot menu</li>
          <li>Tap <em>Add to home screen</em> or <em>Install app</em></li>
          <li>Launch from your home screen — opens in standalone mode.</li>
        </ol>

        <h2>Offline behaviour</h2>
        <p>
          The app is designed for live online play, so most features require an internet connection. The shell loads from cache,
          which means even on a flaky hotel Wi-Fi you&apos;ll see the splash screen and your last-known room state. If you lose
          connection mid-game, the reconnect banner offers a one-tap rejoin when service comes back.
        </p>

        <h2>Bandwidth and battery</h2>
        <p>
          A typical Eurovision night uses well under 50 MB of data per device — far less than streaming the broadcast itself.
          Battery drain is light because the screen-on time is mostly the leaderboard with minimal animation. A 4-hour play
          session typically uses 25-30% of an iPhone or Pixel battery. Plug in if your phone is below 50% before kick-off.
        </p>

        <h2>Notifications</h2>
        <p>
          The app uses lightweight push prompts inside the room — &quot;X challenged you to a duel,&quot; &quot;predictions are about to lock&quot;
          — which work on both iOS (16.4+) and Android. Disable them in your phone&apos;s settings if you prefer silent play.
        </p>

        <p>
          Related: <a href="/online-games">online games (multiplayer mechanics)</a> ·{' '}
          <a href="/how-to-play">2-minute setup guide</a> · <a href="/eurovision-night">host Eurovision night</a>.
        </p>
        <p>
          <a href="/" className="btn-primary">Open the app on mobile →</a>
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
