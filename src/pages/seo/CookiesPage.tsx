import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function CookiesPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Cookies & Consent — Eurovision Games',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
    dateModified: '2026-04-30',
  };

  return (
    <>
      <SchemaHead
        title="Cookies & Consent — Eurovision Games"
        description="What cookies Eurovision Games uses, why, and how to change your consent. Strict necessary only by default; analytics is opt-in."
        canonical="https://eurovision.games/cookies"
        jsonLd={article}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Cookies &amp; consent</h1>
        <p className="lead">
          <strong>Eurovision Games keeps cookies to the bare minimum.</strong> We use one category of cookies that we
          can't avoid (without breaking the game), and one optional category you can switch on or off any time.
        </p>

        <h2>What we use</h2>
        <table>
          <thead>
            <tr><th>Category</th><th>Purpose</th><th>Default</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Strictly necessary</strong></td>
              <td>Keeps you signed into your room (player ID, room code, name), remembers your language preference, holds the consent choice itself.</td>
              <td>Always on — required for the game to work.</td>
            </tr>
            <tr>
              <td><strong>Analytics</strong></td>
              <td>Anonymous, aggregated page-view counts so we can see which guides and pages people actually use. No personal identifiers, no cross-site tracking.</td>
              <td>Off until you opt in.</td>
            </tr>
          </tbody>
        </table>

        <h2>What we do NOT use</h2>
        <ul>
          <li>No advertising cookies. Eurovision Games doesn't run ads.</li>
          <li>No social-tracking pixels (no Meta Pixel, no LinkedIn Insight tag, no TikTok pixel).</li>
          <li>No third-party retargeting.</li>
          <li>No fingerprinting libraries.</li>
        </ul>

        <h2>Change your consent</h2>
        <p>
          Click the link below or the &quot;Cookies &amp; Consent&quot; entry in the footer of any page. You'll see the
          full preferences modal where you can flip Analytics on or off without affecting the necessary category.
        </p>
        <p>
          <button
            type="button"
            data-cc="show-preferencesModal"
            className="btn-primary"
          >
            Open cookie preferences
          </button>
        </p>

        <h2>Where data lives</h2>
        <p>
          The strictly-necessary state lives in your browser's local storage and standard cookies — nothing leaves your
          device until you actively join a room. Game state (room, players, predictions, scores) lives in our database
          while the room is active and is purged according to the retention policy in our{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>Cookie consent banner</h2>
        <p>
          On first visit you see a small banner at the bottom of the page with three buttons: <em>Accept all</em>,{' '}
          <em>Reject all</em> (analytics off), and <em>Manage preferences</em>. Reject is the same number of clicks as
          Accept — we don't dark-pattern you into agreeing.
        </p>

        <p>
          See also: <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
