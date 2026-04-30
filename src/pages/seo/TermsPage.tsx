import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function TermsPage() {
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms of Service — Eurovision Games',
    dateModified: '2026-04-30',
  };
  return (
    <>
      <SchemaHead
        title="Terms of Service — Eurovision Games"
        description="Terms of service for Eurovision Games: eligibility, acceptable use, intellectual property, the Eurovision trademark disclaimer, and limitation of liability."
        canonical="https://eurovision.games/terms"
        jsonLd={webPage}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Terms of service</h1>
        <p className="lead">
          <em>Last updated: 30 April 2026.</em>
        </p>
        <p>
          By using Eurovision Games (the &quot;Service&quot;) you agree to these terms. If you do not agree, do not use the Service.
        </p>

        <h2>Eligibility</h2>
        <p>
          You must be at least 13 years old to use the Service. Hosts must be at least 18 or have permission from a parent or
          guardian.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not use the Service to harass, threaten, or harm others.</li>
          <li>Do not impersonate another person.</li>
          <li>Do not attempt to access another room you are not invited to, reverse-engineer the Service, or scrape data at scale.</li>
          <li>Do not use the Service for commercial purposes (paid Eurovision parties, broadcast use, sponsored play) without written permission.</li>
        </ul>

        <h2>Intellectual property</h2>
        <p>
          The Service&apos;s code, design, illustrations, and trivia question set are the intellectual property of the Eurovision
          Games maintainers. The trademark &quot;Eurovision&quot; and the official Eurovision Song Contest branding belong to the
          European Broadcasting Union (EBU). We use the term &quot;Eurovision&quot; descriptively only.
        </p>

        <h2>Eurovision trademark disclaimer</h2>
        <p>
          Eurovision Games is an independent fan project. <strong>We are not affiliated with, endorsed by, or sponsored by the
          European Broadcasting Union, the Eurovision Song Contest, ORF, or any participating broadcaster.</strong> All
          country names, song titles, artist names, and related marks remain the property of their respective owners.
        </p>

        <h2>User content</h2>
        <p>
          Any names, predictions, or chat-like content you enter into a room remains your own. By entering it, you grant the
          Service a non-exclusive, free licence to display it to other players in the same room and to store it for the
          retention periods listed in the <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>Service availability</h2>
        <p>
          The Service is provided &quot;as is.&quot; We aim for high uptime — especially during Eurovision week — but we do not
          guarantee uninterrupted availability. Scheduled maintenance, broadcast-day load spikes, or upstream provider outages
          may briefly affect play.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Eurovision Games and its maintainers are not liable for indirect, incidental,
          or consequential damages arising from use of the Service. The Service is free; our total liability is limited to the
          fees you paid to use it (which is zero).
        </p>

        <h2>Termination</h2>
        <p>
          We can suspend or terminate accounts that violate these terms, especially for harassment or scale abuse. Hosts can
          delete their account at any time by emailing <a href="mailto:privacy@eurovision.games">privacy@eurovision.games</a>. For
          DMCA / copyright notices, write to <a href="mailto:legal@eurovision.games">legal@eurovision.games</a>.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the European Union and the country where the maintainers operate. Disputes
          will be resolved in the appropriate courts of that jurisdiction.
        </p>

        <h2>Changes</h2>
        <p>
          We can update these terms at any time. Material changes will be announced in the FAQ and via the &quot;Last updated&quot;
          field above.
        </p>

        <p>
          Related: <a href="/privacy">privacy policy</a> · <a href="/about">about</a> · <a href="/faq">FAQ</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
