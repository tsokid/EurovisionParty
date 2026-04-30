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
  { label: 'Cookies', href: '/cookies' },
];

export default function CookiesPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Cookies & Consent — Eurovision Games',
    description:
      'What cookies Eurovision Games uses, why, and how to change your consent. Strict necessary only by default; analytics is opt-in.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/cookies' },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Cookies & Consent — Eurovision Games',
    url: 'https://eurovision.games/cookies',
    description:
      'Cookie policy for Eurovision Games. Strictly necessary cookies are always on; analytics is off by default and opt-in.',
    dateModified: MODIFIED,
    mainEntity: {
      '@type': 'CreativeWork',
      name: 'Eurovision Games cookie policy',
      about: 'Cookies, consent, and tracking practices on eurovision.games',
    },
  };

  return (
    <>
      <SchemaHead
        title="Cookies & Consent — Eurovision Games"
        description="What cookies Eurovision Games uses, why, and how to change your consent. Strictly necessary only by default; analytics is opt-in."
        canonical="https://eurovision.games/cookies"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games cookies',
          'cookie consent',
          'gdpr cookie policy',
          'eurovision games privacy',
          'analytics opt-in',
        ]}
        jsonLd={[article, webPage, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Cookies & consent"
        chipTone="purple"
        title="Cookies & consent"
        lede="Eurovision Games keeps cookies to the bare minimum: one strictly-necessary category that keeps the game working, and one optional analytics category you can flip on or off any time. No advertising, no cross-site tracking, no dark patterns."
      />

      <ContentLayout>
        <Section title="What we use">
          <p>
            Two categories, one of which you can switch off without breaking anything you can see. Reject is the same
            number of clicks as Accept — we don&apos;t bury the off switch.
          </p>
          <DataTable
            headers={['Category', 'Purpose', 'Default']}
            align={['left', 'left', 'left']}
            rows={[
              [
                <strong key="a-cat" className="text-white">Strictly necessary</strong>,
                'Keeps you signed into your room (player ID, room code, name), remembers your language preference, and stores the consent choice itself.',
                <span key="a-def" className="text-white/70">Always on — required for the game to work.</span>,
              ],
              [
                <strong key="b-cat" className="text-white">Analytics</strong>,
                'Anonymous, aggregated page-view counts so we can see which guides and pages people actually use. No personal identifiers, no cross-site tracking.',
                <span key="b-def" className="text-euro-pink-light">Off until you opt in.</span>,
              ],
            ]}
          />
        </Section>

        <Section title="What we do NOT use">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">No advertising cookies.</strong> Eurovision Games doesn&apos;t run ads.</li>
            <li><strong className="text-white">No social tracking pixels.</strong> No Meta Pixel, no LinkedIn Insight tag, no TikTok pixel.</li>
            <li><strong className="text-white">No third-party retargeting.</strong> Nothing that follows you off the site.</li>
            <li><strong className="text-white">No fingerprinting libraries.</strong> No device hashing or behavioural ID.</li>
          </ul>
        </Section>

        <Section title="Change your consent">
          <p>
            Open the preferences modal below or click the <em>Cookies &amp; Consent</em> entry in the footer of any page.
            You can flip Analytics on or off without affecting the strictly-necessary category.
          </p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">Open cookie preferences</h3>
            <p className="text-white/80 text-[15px] leading-relaxed mb-4">
              Launches the preferences modal where you can revisit your choice. Your selection is remembered across
              visits on this device until cleared.
            </p>
            <button
              type="button"
              data-cc="show-preferencesModal"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-euro-purple-light to-euro-pink text-white font-bold text-sm hover:opacity-95 transition shadow-lg shadow-euro-pink/20"
            >
              Manage cookie preferences
            </button>
          </div>
        </Section>

        <Section title="Where data lives">
          <p>
            The strictly-necessary state lives in your browser&apos;s local storage and standard cookies — nothing leaves
            your device until you actively join a room. Game state (room, players, predictions, scores) lives in our
            database while the room is active and is purged according to the retention policy in our{' '}
            <a href="/privacy" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Browser storage</strong> — language, room code, player name, consent choice.</li>
            <li><strong className="text-white">Server (Supabase Postgres)</strong> — room and game data tied to a room ID, not to identifying data for guests.</li>
            <li><strong className="text-white">Hosting (Vercel)</strong> — request logs retained 14 days for security and abuse prevention.</li>
          </ul>
        </Section>

        <Section title="Cookie consent banner">
          <p>
            On first visit you see a small banner at the bottom of the page with three buttons:{' '}
            <em>Accept all</em>, <em>Reject all</em> (analytics off), and <em>Manage preferences</em>. Reject is the
            same number of clicks as Accept — we don&apos;t dark-pattern you into agreeing. The banner reappears if you
            clear browser storage or revoke your choice from this page.
          </p>
        </Section>

        <RelatedCards
          items={[
            { href: '/privacy', title: 'Privacy policy', blurb: 'Data we collect, retention, your GDPR rights, and how to delete your data.' },
            { href: '/terms', title: 'Terms of use', blurb: 'Player conduct, host responsibilities, and the EBU trademark disclaimer.' },
            { href: '/about', title: 'About Eurovision Games', blurb: 'Why this exists, who built it, and the no-ads, no-accounts philosophy.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
