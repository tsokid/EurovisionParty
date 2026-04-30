import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Eurovision night', href: '/eurovision-night' },
];

const FAQ = [
  {
    q: 'Do I need an account?',
    a: 'No. Guests join with just a room code. The host signs in once.',
  },
  {
    q: 'How many players?',
    a: '2 to 20. Couples can share a screen.',
  },
  {
    q: 'Does it run on TV?',
    a: 'The phone or laptop is the dashboard; the broadcast stays on the TV.',
  },
  {
    q: 'When is Eurovision 2026?',
    a: 'The grand final airs on Saturday 16 May 2026 from Vienna, with semi-finals earlier that week. Start times vary by country (21:00 CET / 20:00 BST / 22:00 EET).',
  },
];

export default function EurovisionNightPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Night — How to Host the Perfect Watch Party',
    description: 'A practical 10-step playbook for hosting Eurovision night: setup, food, drinks, predictions, trivia duels, voting, and live scoring with friends.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-night' },
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
        title="Eurovision Night — Host the Perfect Watch Party (2026 Guide)"
        description="A practical guide to hosting Eurovision night: setup, food, drinks, predictions, trivia, voting, and live scoring with friends. Free to play."
        canonical="https://eurovision.games/eurovision-night"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision night',
          'host eurovision night',
          'eurovision watch party',
          'eurovision 2026 watch party',
          'eurovision party guide',
        ]}
        jsonLd={[article, howTo, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Hosting playbook"
        chipTone="pink"
        title="Eurovision night — host the perfect watch party"
        lede="Eurovision night is the annual living-room ritual where you watch the Eurovision Song Contest with friends, rate every song, and argue about which country deserves to win. This guide turns it from passive viewing into a competitive, scored party game using Eurovision Games — a free browser-based companion that handles predictions, trivia, and scoring while you watch."
      />

      <ContentLayout>
        <Section title="What is Eurovision night?">
          <p>
            Eurovision night is the live grand-final broadcast of the Eurovision Song Contest, held on the second Saturday of May
            each year. In 2026 the grand final airs on <strong className="text-white">Saturday 16 May 2026</strong> from Vienna, with semi-finals earlier
            that week. Across Europe (and Australia) it is a single televised live event watched by ~160 million people; in homes
            it has become a competitive social event, a costume party, and a drinking game all at once.
          </p>
        </Section>

        <Section title="How to host (10-step playbook)">
          <ol className="space-y-3">
            <li><strong className="text-white">1. Pick a venue.</strong> Living-room, garden, projector on a wall — or a Zoom/FaceTime call if you&apos;re scattered.</li>
            <li><strong className="text-white">2. Confirm the broadcast.</strong> National broadcaster (BBC One, ARD, ERT, RAI, etc.) or the official YouTube live-stream where licensing allows.</li>
            <li><strong className="text-white">3. Send a save-the-date.</strong> Doors open ~1 hour before kick-off so guests can settle and lock predictions.</li>
            <li><strong className="text-white">4. Open Eurovision Games.</strong> Create a room at <a href="/" className="text-euro-pink-light hover:text-white underline underline-offset-2">eurovision.games</a> on the host&apos;s phone or laptop, share the join link.</li>
            <li><strong className="text-white">5. Set the lineup.</strong> Print or screenshot the 2026 running order so everyone has a reference for predictions.</li>
            <li><strong className="text-white">6. Lock predictions.</strong> Before the first song, every guest picks Top 5 and Worst 5.</li>
            <li><strong className="text-white">7. Watch song-by-song.</strong> React, score, take photos. Encourage opinionated commentary.</li>
            <li><strong className="text-white">8. Use breaks for trivia duels.</strong> The interval act is ~25 minutes — perfect duel window.</li>
            <li><strong className="text-white">9. Watch the vote.</strong> Jury vote first, then televote — the most chaotic 25 minutes of TV all year.</li>
            <li><strong className="text-white">10. Crown winners.</strong> After the televote, the app reveals five trophy cards — Champion, Thief, Duelist, Oracle, Guru.</li>
          </ol>
        </Section>

        <Section title="Food and drink ideas">
          <p>
            The classic move: <strong className="text-white">one snack per favourite country</strong>. Sweden = meatballs and Daim. Italy = arancini.
            Greece = spanakopita. UK = sausage rolls. Don&apos;t over-cater — the focus is the screen. A flexible buffet that survives
            the 4-hour run-time beats a hot served dinner. Mocktails travel well; an alcohol-free option keeps drivers and
            non-drinkers happy through to the televote.
          </p>
        </Section>

        <Section title="Time-zone tips">
          <p>
            Grand final start times vary by country: 21:00 CET (Germany, France, Spain), 20:00 BST/UTC+1 (UK, Ireland), 22:00 EET
            (Greece, Cyprus, Finland, Israel), 05:00 AEDT next morning (Australia — record it). If you&apos;re hosting cross-country,
            align on the host&apos;s local kick-off and start the room 30 minutes earlier.
          </p>
        </Section>

        <Section title="Game options inside the room">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Predictions:</strong> Top 5, Worst 5 — locked before the show, scored automatically against jury + televote.</li>
            <li><strong className="text-white">Trivia duels:</strong> Head-to-head between any two players. Winner steals points from loser. Host-configurable cap per pair (default 3 duels, including rematches).</li>
            <li><strong className="text-white">Quiz rounds:</strong> Fast-fire rounds the host triggers between performances.</li>
            <li><strong className="text-white">Sudden-death tiebreak:</strong> Optional. If two players tie a winner category, one buzzer-style trivia question decides it.</li>
          </ul>
        </Section>

        <Section title="Frequently asked questions">
          <FaqAccordion items={FAQ} />
        </Section>

        <CtaBanner
          title="Lock in your watch party"
          body="Open a room now and share the join link with friends."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-party', title: 'Eurovision party', blurb: 'Themed Eurovision party planning — costumes, decor, and country menus.' },
            { href: '/how-to-play', title: 'How to play', blurb: 'The 60-second walkthrough from create-room to trophy reveal.' },
            { href: '/eurovision-2026-predictions', title: '2026 predictions', blurb: 'Top 5 and Worst 5 format, scoring, and strategy for the Vienna final.' },
            { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '10 sample questions and how the live trivia bank works.' },
            { href: '/duels', title: 'Eurovision duels', blurb: 'Head-to-head 3-question duels during the live show.' },
            { href: '/faq', title: 'FAQ', blurb: 'Answers to common questions about hosting, joining, and scoring.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
