import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Terms', href: '/terms' },
];

export default function TermsPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Terms of Use — Eurovision Games',
    description:
      'Terms of use for Eurovision Games: who we are, free-to-use rules, player conduct, account & rooms, disclaimer of warranties, limitation of liability, and the EBU trademark disclaimer.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/terms' },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms of Use — Eurovision Games',
    url: 'https://eurovision.games/terms',
    description:
      'Terms governing use of the Eurovision Games browser party game. Free, fan-made, not affiliated with the European Broadcasting Union.',
    dateModified: MODIFIED,
    mainEntity: {
      '@type': 'CreativeWork',
      name: 'Eurovision Games terms of use',
      about: 'User agreement for the eurovision.games browser game',
    },
  };

  return (
    <>
      <SchemaHead
        title="Terms of Use — Eurovision Games"
        description="The agreement you accept when you use Eurovision Games. Free fan project, no affiliation with the EBU, player conduct rules and liability disclaimers."
        canonical="https://eurovision.games/terms"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games terms',
          'terms of use',
          'eurovision party game terms',
          'eurovision games disclaimer',
          'fan game terms',
        ]}
        jsonLd={[article, webPage, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Terms of use"
        chipTone="purple"
        title="Terms of use"
        lede="By using Eurovision Games you agree to these terms. The short version: it's a free fan project, play nicely, and we're not affiliated with the European Broadcasting Union. Last updated 30 April 2026."
      />

      <ContentLayout>
        <Section title="Who we are">
          <p>
            Eurovision Games (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;) is an independent fan-built browser
            party game for the Eurovision Song Contest. The Service is operated by the Eurovision Games maintainers and
            is not a registered company, broadcaster, or commercial product. Contact:{' '}
            <a href="mailto:hello@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              hello@eurovision.games
            </a>
            .
          </p>
        </Section>

        <Section title="Free to use">
          <p>
            The Service is free. There is no subscription, no in-app purchase, no paid tier, and no advertising. You
            may use it for private Eurovision watch parties at no cost. Commercial use — paid Eurovision events,
            broadcast use, sponsored play — requires written permission from the maintainers.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">No fees.</strong> We do not charge to host or join a room.</li>
            <li><strong className="text-white">No accounts for guests.</strong> Hosts authenticate via email OTP; guests join with a display name.</li>
            <li><strong className="text-white">No download.</strong> Everything runs in your browser.</li>
          </ul>
        </Section>

        <Section title="Player conduct">
          <p>By using the Service, you agree not to:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Harass, threaten, or harm</strong> other players, in display names, in chat-like fields, or anywhere else.</li>
            <li><strong className="text-white">Cheat or exploit.</strong> No automated tools, scripts, scrapers, or attempts to manipulate scoring beyond the in-game rules.</li>
            <li><strong className="text-white">Impersonate</strong> another person, broadcaster, artist, or the Service itself.</li>
            <li><strong className="text-white">Access rooms</strong> you have not been invited to, attempt to bypass row-level security, or reverse-engineer the Service.</li>
            <li><strong className="text-white">Use the Service for hate speech</strong>, illegal content, or harassment of any group.</li>
          </ul>
          <p>
            We can suspend or remove access for violations — especially harassment or scale abuse — without notice.
          </p>
        </Section>

        <Section title="Account & rooms">
          <p>
            Hosts authenticate via email one-time code. The host owns the room: they can change settings, advance the
            game phase, and delete the room. Guests join with a display name visible only to other players in the same
            room.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Host responsibilities.</strong> The host is responsible for sharing the room code with the right people and removing anyone who breaks player conduct rules.</li>
            <li><strong className="text-white">RLS protects data.</strong> Row-level security policies in the database prevent cross-room data access; players only see their own room.</li>
            <li><strong className="text-white">Account deletion.</strong> Hosts can delete their account at any time by emailing{' '}
              <a href="mailto:privacy@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
                privacy@eurovision.games
              </a>{' '}
              — see the{' '}
              <a href="/privacy" className="text-euro-pink-light hover:text-white underline underline-offset-2">
                Privacy Policy
              </a>{' '}
              for retention details.
            </li>
          </ul>
        </Section>

        <Section title="User content">
          <p>
            Names, predictions, trivia answers, and similar content you enter remain your own. By entering them you
            grant the Service a non-exclusive, free licence to display them to other players in the same room and to
            store them for the retention periods listed in the{' '}
            <a href="/privacy" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              Privacy Policy
            </a>
            . You are responsible for ensuring you have the right to use any name, nickname, or input you provide.
          </p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>
            The Service is provided <strong className="text-white">&quot;as is&quot;</strong> and{' '}
            <strong className="text-white">&quot;as available&quot;</strong>, without warranties of any kind, express or
            implied. We aim for high uptime — especially during Eurovision week — but we do not guarantee
            uninterrupted, error-free, or bug-free operation. Scheduled maintenance, broadcast-day load spikes, or
            upstream provider outages may briefly affect play.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, Eurovision Games and its maintainers are not liable for indirect,
            incidental, consequential, or punitive damages arising from use of the Service — including (without
            limitation) lost predictions, missed trivia points, ruined parties, or interrupted broadcasts. The Service
            is free; total aggregate liability is limited to the fees you paid to use it (which is zero).
          </p>
        </Section>

        <Section title="Eurovision Song Contest disclaimer">
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">Not affiliated with the EBU</h3>
            <p className="text-white/85 text-[15px] leading-relaxed">
              Eurovision Games is an independent fan project. <strong className="text-white">We are not affiliated
              with, endorsed by, or sponsored by the European Broadcasting Union, the Eurovision Song Contest, the
              host broadcaster, or any participating broadcaster.</strong> The trademark &quot;Eurovision&quot; and the
              official Eurovision Song Contest branding belong to the EBU. We use &quot;Eurovision&quot;
              descriptively only — to indicate the broadcast this game is designed to accompany. Country names, song
              titles, artist names, and related marks remain the property of their respective owners.
            </p>
          </div>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We can update these terms at any time. Material changes will be announced in the FAQ and reflected in the
            &quot;Last updated&quot; date in the hero above. Continued use of the Service after a material change
            constitutes acceptance of the updated terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            General contact and bug reports:{' '}
            <a href="mailto:hello@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              hello@eurovision.games
            </a>
            . Privacy and data requests:{' '}
            <a href="mailto:privacy@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              privacy@eurovision.games
            </a>
            . DMCA / copyright notices:{' '}
            <a href="mailto:legal@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              legal@eurovision.games
            </a>
            .
          </p>
        </Section>

        <RelatedCards
          items={[
            { href: '/privacy', title: 'Privacy policy', blurb: 'Data we collect, retention, your GDPR rights, and how to delete your data.' },
            { href: '/cookies', title: 'Cookies & consent', blurb: 'What we store, how to flip analytics off, and where the data lives.' },
            { href: '/about', title: 'About Eurovision Games', blurb: 'Why this exists, who built it, and the no-ads, no-accounts philosophy.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
