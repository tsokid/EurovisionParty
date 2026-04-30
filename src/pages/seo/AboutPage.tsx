import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
];

export default function AboutPage() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Eurovision Games',
    url: 'https://eurovision.games',
    logo: 'https://eurovision.games/logo.png',
    description:
      'A free, fan-built browser party game for the Eurovision Song Contest. Live predictions, trivia, duels, and trophies for any group hosting a Eurovision night.',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@eurovision.games',
      contactType: 'customer support',
    },
  };

  const aboutPage = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Eurovision Games',
    url: 'https://eurovision.games/about',
    description:
      'Eurovision Games is a free, fan-built browser party game for the Eurovision Song Contest. Origin, philosophy, what is in the game, and contact.',
    mainEntity: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      url: 'https://eurovision.games',
    },
  };

  return (
    <>
      <SchemaHead
        title="About Eurovision Games — Free Eurovision Party Game"
        description="Eurovision Games is a free, fan-built browser party game for the Eurovision Song Contest. Predictions, trivia, duels, trophies. No ads, no accounts for guests, no install."
        canonical="https://eurovision.games/about"
        ogType="website"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        keywords={[
          'about eurovision games',
          'eurovision party game',
          'free eurovision game',
          'eurovision song contest game',
          'fan-built eurovision game',
          'eurovision watch party',
        ]}
        jsonLd={[organization, aboutPage, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="About"
        chipTone="gold"
        title="About Eurovision Games"
        lede="A free, fan-built browser party game for the Eurovision Song Contest. It started as a spreadsheet between friends and grew into a real-time multiplayer app for any group hosting a Eurovision night — with automatic scoring so the host doesn't have to miss the show."
      />

      <ContentLayout>
        <Section title="What is Eurovision Games?">
          <p>
            Eurovision Games is a free, browser-based party game played alongside the Eurovision Song Contest broadcast.
            Hosts spin up a private room in 60 seconds and share the code; guests join with just a display name. The
            game runs through three live phases: <strong className="text-white">predictions</strong> before the show
            (lock your Top 5 and Worst 5), <strong className="text-white">trivia and duels</strong> during the show
            (head-to-head 12-second rounds during ad breaks), and <strong className="text-white">trophies</strong>{' '}
            after the winner is announced (Champion, Oracle, Quizmaster, Duelist, Thief). Everything scores
            automatically.
          </p>
        </Section>

        <Section title="Why we built it">
          <p>
            Watching Eurovision is great. Watching Eurovision <em>with stakes</em> is better. The existing options —
            printed bingo cards, paid quiz packs, custom Google Sheets — all break in the same way: someone has to do
            the scoring, and that someone misses half the show. We wanted live, automatic scoring that didn&apos;t cost
            anything and didn&apos;t require an install. That&apos;s the entire product.
          </p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">Five principles, no exceptions</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-white/85 text-[15px]">
              <li><strong className="text-white">Free, always.</strong> No subscriptions, no ads, no premium tier.</li>
              <li><strong className="text-white">No download.</strong> If it can&apos;t open in a browser, it&apos;s not the Eurovision experience.</li>
              <li><strong className="text-white">No accounts for guests.</strong> Hosts sign in once; guests join with a name.</li>
              <li><strong className="text-white">Mobile-first.</strong> Most people host from a sofa with a phone in hand.</li>
              <li><strong className="text-white">Real fun, not gamified.</strong> Five winner categories, sudden death, real bragging rights — no streaks, no daily challenges.</li>
            </ul>
          </div>
        </Section>

        <Section title="What's in the game">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li>
              <strong className="text-white">Predictions</strong> — lock your Top 5 and Worst 5 before the show. Points
              stack as the broadcast plays out. See{' '}
              <a href="/eurovision-2026-predictions" className="text-euro-pink-light hover:text-white underline underline-offset-2">
                this year&apos;s predictions page
              </a>
              .
            </li>
            <li>
              <strong className="text-white">Quiz</strong> — open-room Eurovision trivia in the Preshow phase. Locks
              when the live show starts.
            </li>
            <li>
              <strong className="text-white">Duels</strong> — 3-question head-to-head trivia battles during the live
              show. Steal points or double your own.{' '}
              <a href="/duels" className="text-euro-pink-light hover:text-white underline underline-offset-2">
                Full duel rules
              </a>
              .
            </li>
            <li>
              <strong className="text-white">Trophies</strong> — five end-of-night categories (Champion, Oracle,
              Quizmaster, Duelist, Thief). Sudden-death tiebreaks if two players tie.
            </li>
          </ul>
        </Section>

        <Section title="Free, no account, no install">
          <p>
            Eurovision Games is free for personal Eurovision watch parties. There is no subscription, no in-app
            purchase, and no advertising — anywhere on the site. Hosts authenticate once with an email one-time code;
            guests join with just a display name and a room code. Nothing to download, nothing to install. The whole
            thing runs in your browser on phone, tablet, or laptop.
          </p>
        </Section>

        <Section title="Not affiliated with the EBU">
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">Independent fan project</h3>
            <p className="text-white/85 text-[15px] leading-relaxed">
              Eurovision Games is an independent fan project. We are not affiliated with, endorsed by, or sponsored by
              the European Broadcasting Union, the Eurovision Song Contest, the host broadcaster, or any participating
              broadcaster. &quot;Eurovision&quot; is a trademark of the EBU; we use it descriptively only to indicate
              the broadcast this game is designed to accompany. Country names, song titles, artist names, and related
              marks remain the property of their respective owners.
            </p>
          </div>
        </Section>

        <Section title="Built by">
          <p>
            Built by a small team of Eurovision fans who got tired of doing prediction maths by hand. Bug reports,
            feature requests, hosting questions:{' '}
            <a href="mailto:hello@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              hello@eurovision.games
            </a>
            . Press and partnership enquiries:{' '}
            <a href="mailto:press@eurovision.games" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              press@eurovision.games
            </a>
            . We aim to reply within 3 business days; during Eurovision week (May), within 24 hours.
          </p>
        </Section>

        <CtaBanner
          title="Try Eurovision Games tonight"
          body="Set up a watch party in 60 seconds. Spin up a private room, share the code, and have your friends locked in before the first postcard."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/how-to-play', title: 'How to play in 60 seconds', blurb: 'Setup walkthrough from create-room to trophy reveal.' },
            { href: '/eurovision-night', title: 'Hosting a Eurovision night', blurb: 'Run-of-show, snack ideas, and how the game fits the broadcast.' },
            { href: '/eurovision-2026-predictions', title: '2026 predictions', blurb: 'Lock your Top 5 and Worst 5 before the show — points stack with duels.' },
            { href: '/faq', title: 'FAQ', blurb: 'Hosting, scoring, leaving rooms, and other common questions.' },
            { href: '/privacy', title: 'Privacy policy', blurb: 'Data we collect, retention, and how to delete your account.' },
            { href: '/terms', title: 'Terms of use', blurb: 'Player conduct, host responsibilities, and the EBU disclaimer.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
