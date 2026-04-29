import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function PrivacyPage() {
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy — Eurovision Games',
    dateModified: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Privacy Policy — Eurovision Games"
        description="Privacy policy for Eurovision Games: what data we collect, how we use it, retention periods, cookies, analytics, email OTP, and contact for data requests."
        canonical="https://eurovision.games/privacy"
        jsonLd={webPage}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Privacy policy</h1>
        <p className="lead">
          <em>Last updated: 30 April 2026.</em>
        </p>
        <p>
          Eurovision Games is a free browser-based game. This page explains what data we collect, why, and how long we keep it.
          We do not sell data and we do not run third-party advertising.
        </p>

        <h2>Data we collect</h2>
        <ul>
          <li><strong>Host email</strong> — used to authenticate the host via a one-time code (OTP). Stored in our auth system.</li>
          <li><strong>Player display name</strong> — chosen by each player when joining a room. Visible to other players in the room.</li>
          <li><strong>Game state</strong> — predictions, trivia answers, duel outcomes, scores. Tied to a room ID, not to identifying data for guest players.</li>
          <li><strong>Browser and connection data</strong> — IP and user-agent for security and abuse prevention. Not used for tracking across sessions.</li>
        </ul>

        <h2>What we do not collect</h2>
        <ul>
          <li>Real names, addresses, phone numbers, or payment details.</li>
          <li>Cross-site tracking cookies.</li>
          <li>Behavioural advertising data.</li>
          <li>Microphone or camera input.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use a single technical cookie to keep your session alive. No advertising cookies. No third-party trackers in the
          default install.
        </p>

        <h2>Analytics</h2>
        <p>
          We use first-party, privacy-friendly analytics (event counts, page views) without IP storage. No cross-site profile
          building.
        </p>

        <h2>Email OTP</h2>
        <p>
          Hosts authenticate via email one-time codes. We do not send marketing email. The email address is stored only to
          identify your host account; you can delete it at any time by emailing us at <em>privacy@eurovision.games</em>.
        </p>

        <h2>Retention</h2>
        <ul>
          <li>Active rooms: kept for the duration of play plus 24 hours.</li>
          <li>Completed game results: kept for 30 days, then anonymised (player names stripped, room ID retained for aggregate stats).</li>
          <li>Host email: retained until you delete your account.</li>
          <li>Server logs: 14 days.</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          Under GDPR (EU) and UK GDPR you have the right to access, correct, port, or delete your data. Email{' '}
          <em>privacy@eurovision.games</em> with your request and we&apos;ll respond within 30 days.
        </p>

        <h2>Children</h2>
        <p>
          Eurovision Games is not directed at children under 13. The host should be an adult; children playing in a hosted room
          do so under the host&apos;s supervision.
        </p>

        <h2>Changes</h2>
        <p>
          If we change this policy, we&apos;ll update the &quot;Last updated&quot; date and post a note in the FAQ.
        </p>

        <p>
          Related: <a href="/terms">terms of service</a> · <a href="/about">about</a> · <a href="/faq">FAQ</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
