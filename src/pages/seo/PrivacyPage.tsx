import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Privacy', href: '/privacy' },
];

export default function PrivacyPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Privacy Policy — Eurovision Games',
    description:
      'Privacy policy for Eurovision Games: what data we collect, how we use it, retention, cookies, your GDPR rights, and how to delete your data.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/privacy' },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy — Eurovision Games',
    url: 'https://eurovision.games/privacy',
    description:
      'How Eurovision Games collects, stores, and deletes player data. GDPR-compliant; no advertising; no third-party tracking.',
    dateModified: MODIFIED,
    mainEntity: {
      '@type': 'CreativeWork',
      name: 'Eurovision Games privacy policy',
      about: 'Personal data handling, retention periods, and user rights on eurovision.games',
    },
  };

  return (
    <>
      <SchemaHead
        title="Privacy Policy — Eurovision Games"
        description="What data Eurovision Games collects, why, and how to delete it. GDPR-compliant; no ads, no third-party tracking, no data sales."
        canonical="https://eurovision.games/privacy"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games privacy',
          'privacy policy',
          'gdpr eurovision games',
          'data deletion eurovision games',
          'eurovision party game privacy',
        ]}
        jsonLd={[article, webPage, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Privacy"
        chipTone="purple"
        title="Privacy policy"
        lede="Eurovision Games is a free browser-based party game. We do not sell data, we do not run third-party advertising, and we collect the minimum needed for the game to work. Last updated 30 April 2026."
      />

      <ContentLayout>
        <Section title="What we collect">
          <p>
            Three categories — what each is for, and how long we keep it. Guest players (people who join a room with
            just a name) are not tied to identifying data on our side.
          </p>
          <DataTable
            headers={['Data type', 'Purpose', 'Retention']}
            align={['left', 'left', 'left']}
            rows={[
              [
                <strong key="a-d" className="text-white">Host email</strong>,
                'Authenticate the host via one-time code (OTP). No marketing email.',
                'Until you delete your account.',
              ],
              [
                <strong key="b-d" className="text-white">Player display name</strong>,
                'Chosen by each player joining a room. Visible to other players in the same room only.',
                'Stripped 30 days after the room ends.',
              ],
              [
                <strong key="c-d" className="text-white">Game state</strong>,
                'Predictions, trivia answers, duel outcomes, scores. Tied to a room ID, not to identifying data for guests.',
                'Active room + 24 hours; aggregate stats anonymised after 30 days.',
              ],
              [
                <strong key="d-d" className="text-white">Browser & connection data</strong>,
                'IP and user-agent for security and abuse prevention. Not used for cross-session tracking.',
                'Server logs retained 14 days.',
              ],
            ]}
          />
        </Section>

        <Section title="What we do NOT collect">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">No real names, addresses, phone numbers, or payment details.</strong> The game is free and there&apos;s nothing to bill.</li>
            <li><strong className="text-white">No cross-site tracking cookies.</strong> No advertising or behavioural profiling.</li>
            <li><strong className="text-white">No microphone or camera input.</strong> The game is text and tap only.</li>
            <li><strong className="text-white">No data sales.</strong> Ever. We&apos;re not in that business.</li>
          </ul>
        </Section>

        <Section title="Who has access">
          <p>
            Eurovision Games runs on two infrastructure providers. No other third parties see your data.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li>
              <strong className="text-white">Supabase (Postgres database, auth)</strong> — stores room state, host
              accounts, and game data. Row-level security policies prevent cross-room data access.
            </li>
            <li>
              <strong className="text-white">Vercel (hosting)</strong> — serves the app and retains short-term request
              logs for security and abuse prevention.
            </li>
            <li>
              <strong className="text-white">No-one else.</strong> No analytics broker, no advertising network, no CRM,
              no data warehouse, no third-party email provider beyond the OTP transactional sender.
            </li>
          </ul>
        </Section>

        <Section title="Your rights">
          <p>
            Under GDPR (EU) and UK GDPR, you have the right to:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Access</strong> — request a copy of the data we hold about you.</li>
            <li><strong className="text-white">Rectification</strong> — correct inaccurate or incomplete data.</li>
            <li><strong className="text-white">Erasure</strong> — request that we delete your data (the &quot;right to be forgotten&quot;).</li>
            <li><strong className="text-white">Portability</strong> — receive your data in a machine-readable format.</li>
            <li><strong className="text-white">Restriction & objection</strong> — limit or object to how we process your data.</li>
            <li><strong className="text-white">Complain</strong> — lodge a complaint with your local data protection authority.</li>
          </ul>
          <p>
            Email{' '}
            <a href="mailto:privacy@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              privacy@eurovision.games
            </a>{' '}
            with your request and we&apos;ll respond within 30 days.
          </p>
        </Section>

        <Section title="Data deletion">
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">How to delete your account</h3>
            <p className="text-white/80 text-[15px] leading-relaxed">
              Email{' '}
              <a href="mailto:privacy@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
                privacy@eurovision.games
              </a>{' '}
              from the address you signed up with. We delete the host email and detach any historical room data within
              7 days. Guest player names are stripped automatically 30 days after the room ends — you do not need to
              ask for that.
            </p>
          </div>
          <p>
            If you joined a room as a guest and want your display name removed sooner, ask the room host to delete the
            room (they can do that from the host dashboard) or email us with the room code.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use one strictly-necessary cookie category to keep your session alive (room code, language, consent
            choice). Analytics cookies are off by default and opt-in. No advertising cookies, no cross-site tracking.
            Full breakdown on the{' '}
            <a href="/cookies" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              cookies page
            </a>
            .
          </p>
        </Section>

        <Section title="Children">
          <p>
            Eurovision Games is not directed at children under 13. Hosts should be adults; children playing in a hosted
            room do so under the host&apos;s supervision.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change this policy, we&apos;ll update the &quot;Last updated&quot; date in the hero above and post a note
            in the FAQ. Material changes will be highlighted at the top of this page for at least 30 days.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Privacy questions and data requests:{' '}
            <a href="mailto:privacy@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              privacy@eurovision.games
            </a>
            . General contact:{' '}
            <a href="mailto:hello@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              hello@eurovision.games
            </a>
            . We aim to reply within 3 business days; during Eurovision week (May), within 24 hours.
          </p>
        </Section>

        <RelatedCards
          items={[
            { href: '/cookies', title: 'Cookies & consent', blurb: 'What we store, how to flip analytics off, and where the data lives.' },
            { href: '/terms', title: 'Terms of use', blurb: 'Player conduct, host responsibilities, and the EBU trademark disclaimer.' },
            { href: '/about', title: 'About Eurovision Games', blurb: 'Why this exists, who built it, and the no-ads philosophy.' },
            { href: '/faq', title: 'FAQ', blurb: 'Hosting, scoring, leaving rooms, and other common questions.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
