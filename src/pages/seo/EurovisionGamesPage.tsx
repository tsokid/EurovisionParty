import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Eurovision Games', href: '/eurovision-games' },
];

const FAQ = [
  {
    q: 'Is Eurovision Games really free?',
    a: 'Yes. No subscription, no in-app purchases, no signup required for guests to join. The host authenticates once by email so the room can be saved; players just need the room code.',
  },
  {
    q: 'How many players can join?',
    a: 'Two to twenty per room. The sweet spot is six to ten — enough variety in predictions and duels without the trivia rotation getting stale across a four-hour show.',
  },
  {
    q: 'Does it work on mobile?',
    a: 'Yes. It is a mobile-first PWA that runs in any modern browser on iOS, Android, or desktop. No app store install — players just open the link, type the room code, and play.',
  },
  {
    q: 'Do players need an account?',
    a: 'No. Only the host creates a free account (email or Google). Guests join with the room code and a display name; nothing is saved against them between sessions unless they choose to sign up.',
  },
  {
    q: 'Is this affiliated with the EBU or the official Eurovision Song Contest?',
    a: 'No. Eurovision Games is an independent fan project. Eurovision Song Contest, ESC, and the heart logo are trademarks of the European Broadcasting Union. We use the country and song data only to score your predictions.',
  },
  {
    q: 'How long does a full session take?',
    a: 'Roughly four hours, matched to the broadcast. Predictions lock before song one, quiz runs in the preshow, duels run during ad breaks and the interval, results post live, and trophies reveal after the winner is announced.',
  },
];

export default function EurovisionGamesPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Games — The Free Multiplayer Companion for Eurovision 2026',
    description: 'A free, browser-based party game built around Eurovision: predictions, quiz, duels, a live dashboard, and five trophies. Two to twenty players, no install.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-games' },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <SchemaHead
        title="Eurovision Games \u2014 Free Multiplayer Party Game for Eurovision 2026"
        description="The free, browser-based Eurovision party game: Top 5 and Worst 5 predictions, trivia duels, quiz rounds, a live dashboard, and five trophies. 2\u201320 players, no install."
        canonical="https://eurovision.games/eurovision-games"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games',
          'free eurovision party game',
          'eurovision online game',
          'eurovision games for friends',
          'eurovision quiz game',
          'eurovision predictions game',
        ]}
        jsonLd={[article, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="All games"
        chipTone="pink"
        title="Eurovision Games — every game in the suite"
        lede="Eurovision Games is the free, browser-based companion for the Eurovision Song Contest. Predictions before the show, quiz rounds in the preshow, head-to-head duels in the ad breaks, a live dashboard, and five trophies at the end. Two to twenty players, no install, no account for guests."
      />

      <ContentLayout>
        <Section title="What's inside Eurovision Games">
          <p>
            Four scoring modes layer across the four hours of the broadcast — each one targeting a different beat of
            the night so that the room never has &quot;nothing to do.&quot; Predictions are the long game. Quiz is the
            warm-up. Duels are the live-show weapon. The Dashboard is the running scoreboard everyone is watching.
          </p>
          <DataTable
            headers={['Game', 'When active', 'Scoring (cap)']}
            align={['left', 'left', 'left']}
            rows={[
              [
                <a key="p" href="/eurovision-2026-predictions" className="text-euro-pink-light hover:text-white underline underline-offset-2"><strong>Predictions</strong></a>,
                'Lobby \u2192 lock at song 1',
                'Top 5 + Worst 5, weighted slots, 500 cap',
              ],
              [
                <a key="q" href="/eurovision-trivia" className="text-euro-pink-light hover:text-white underline underline-offset-2"><strong>Quiz</strong></a>,
                'Preshow only',
                '3 rounds \u00d7 120 = 360 cap',
              ],
              [
                <a key="d" href="/duels" className="text-euro-pink-light hover:text-white underline underline-offset-2"><strong>Duels</strong></a>,
                'Live Show \u2192 Winners',
                '3 questions, 12s each, Steal or Double',
              ],
              [
                <a key="dash" href="/dashboard" className="text-euro-pink-light hover:text-white underline underline-offset-2"><strong>Dashboard</strong></a>,
                'Always',
                'Live total of all four sources',
              ],
            ]}
          />
        </Section>

        <Section title="Predictions — Top 5 and Worst 5">
          <p>
            Before song one, every player locks a Top 5 and a Worst 5 from the 2026 grand-final running order.
            Weighted slots reward conviction (your #1 pick is worth more than your #5), and the formula scores
            against the official jury + televote total once the host enters results. The hard cap is 500 points so
            no single category can run the night.
          </p>
          <p>
            Full format on the <a href="/eurovision-2026-predictions" className="text-euro-pink-light hover:text-white underline underline-offset-2">2026 predictions page</a>.
          </p>
        </Section>

        <Section title="Quiz rounds">
          <p>
            Three host-triggered rounds run during the preshow window: ten questions each, twelve seconds per
            question, drawn from the same Eurovision trivia bank that feeds duels. Quiz locks the moment the host
            advances to Live Show — that is the cutoff. Cap is 360 across all three rounds combined.
          </p>
          <p>
            Sample questions and the bank breakdown live on the <a href="/eurovision-trivia" className="text-euro-pink-light hover:text-white underline underline-offset-2">Eurovision trivia page</a>.
          </p>
        </Section>

        <Section title="Duels">
          <p>
            Once the broadcast starts, quiz locks and duels open. A duel is a private 3-question, 12-second-per-question
            head-to-head with another player. Winner picks <strong className="text-white">Steal</strong> (take points
            from the loser) or <strong className="text-white">Double</strong> (add points to themselves). Two trophies
            — Duelist and Thief — are decided here.
          </p>
          <p>
            Full rules and scoring on the <a href="/duels" className="text-euro-pink-light hover:text-white underline underline-offset-2">duels page</a>.
          </p>
        </Section>

        <Section title="Live Dashboard">
          <p>
            The Dashboard is the always-visible leaderboard, push-updated the moment any of the four sources resolves
            — predictions, quiz, duels won, points stolen. Tap a player for their per-source split. There is no
            refresh and no spectator mode; everyone in the room sees the same totals at the same time.
          </p>
          <p>
            Deep dive on the <a href="/dashboard" className="text-euro-pink-light hover:text-white underline underline-offset-2">Dashboard page</a>.
          </p>
        </Section>

        <Section title="Trophies — five winners every night">
          <p>
            Eurovision Games does not crown one winner — it crowns five. After the official Eurovision result is
            entered, trophy cards reveal one by one:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Champion</strong> — highest total across all four sources.</li>
            <li><strong className="text-white">Oracle</strong> — best Top 5 prediction score.</li>
            <li><strong className="text-white">Guru</strong> — highest quiz score across the three rounds.</li>
            <li><strong className="text-white">Duelist</strong> — most duels won across the night.</li>
            <li><strong className="text-white">Thief</strong> — most points taken via Steal.</li>
          </ul>
        </Section>

        <Section title="Free, no install, no account">
          <p>
            Eurovision Games is free to play and built to remove every reason a guest might bail before the first song.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Browser-based.</strong> Any modern browser on iOS, Android, or desktop.</li>
            <li><strong className="text-white">Mobile-first PWA.</strong> Add to home screen if you want, but you do not have to.</li>
            <li><strong className="text-white">Host-only signup.</strong> The host authenticates once; guests just type a room code and a display name.</li>
            <li><strong className="text-white">2\u201320 players.</strong> Sweet spot is 6\u201310 — enough variety without the trivia rotation getting stale.</li>
          </ul>
        </Section>

        <Section title="Frequently asked questions">
          <FaqAccordion items={FAQ} />
        </Section>

        <CtaBanner
          title="Try Eurovision Games tonight"
          body="A 60-second setup, the perfect Eurovision watch-party companion."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-2026-predictions', title: 'Predictions', blurb: 'Lock Top 5 and Worst 5 before the show — the 500-point engine of the night.' },
            { href: '/eurovision-trivia', title: 'Trivia', blurb: 'Sample questions plus the bank quiz and duels both pull from.' },
            { href: '/duels', title: 'Duels', blurb: '3-question head-to-head battles during the live show. Steal or Double.' },
            { href: '/dashboard', title: 'Dashboard', blurb: 'The live leaderboard everyone is watching. Push-updated, no refresh.' },
            { href: '/how-to-play', title: 'How to play', blurb: 'Sixty-second setup walkthrough from create-room to trophy reveal.' },
            { href: '/eurovision-night', title: 'Eurovision Night', blurb: 'How the four games fit into the four-hour broadcast.' },
            { href: '/eurovision-party', title: 'Eurovision Party', blurb: 'Hosting playbook — venue, food, run-of-show, and the games to layer on.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
