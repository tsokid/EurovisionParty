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
  { label: 'Eurovision Party', href: '/eurovision-party' },
];

const FAQ = [
  {
    q: 'How long does a Eurovision party last?',
    a: 'Plan for four to five hours from doors to last drink. Doors open an hour before broadcast, the grand final runs roughly three and a half hours including the jury and televote, and trophy reveals plus debrief takes another twenty minutes.',
  },
  {
    q: 'What if guests turn up late?',
    a: 'Lock predictions before song one no matter what — that is the only hard deadline. Late arrivals can still join the room and play quiz rounds (if the preshow is still running), duels, and trophy categories that do not need predictions. They simply forfeit the 500-point predictions ceiling.',
  },
  {
    q: 'What if I do not have a TV?',
    a: 'Stream the official broadcast on a laptop or projector. Most national broadcasters carry it free in the EBU region, and the official Eurovision YouTube channel runs an English-language stream live in many territories.',
  },
  {
    q: 'Can I host the party on Zoom?',
    a: 'Yes. Share the room link in the Zoom chat and screen-share the broadcast. Guests play on their phones while watching the call. The Dashboard works as a second window on a tablet so everyone can glance at the leaderboard.',
  },
  {
    q: 'What if someone leaves early?',
    a: 'Their score freezes. Predictions and quiz totals are already banked, duel records stay on the leaderboard, and they keep any trophies they win — so the friend who has to put kids to bed at 22:00 can still walk away with Oracle or Guru.',
  },
  {
    q: 'How many guests is too many?',
    a: 'The app supports 20 in a single room, but past 12 the watch dynamic changes — fewer people pay close attention to each song, and trivia duels cannot rotate through everyone before the night ends. For a competitive party, 6\u201310 is the sweet spot.',
  },
];

export default function EurovisionPartyPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Party — The Complete Hosting Playbook for 2026',
    description: 'How to throw a Eurovision party in 2026: headcount, venue, theme, country-themed food, a four-hour run-of-show, and the free games to keep guests competitive.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-party' },
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
  const event = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: 'Eurovision Song Contest 2026 — Grand Final watch party',
    startDate: '2026-05-16T20:00:00+02:00',
    endDate: '2026-05-17T00:30:00+02:00',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    description:
      'Host a Eurovision watch party for the 2026 grand final on Saturday 16 May. Country-themed food, costumes, and a free scoring app for predictions, quiz, and duels.',
    location: {
      '@type': 'VirtualLocation',
      url: 'https://eurovision.games',
    },
    organizer: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      url: 'https://eurovision.games',
    },
  };

  return (
    <>
      <SchemaHead
        title="Eurovision Party \u2014 The Complete Hosting Playbook for 2026"
        description="Throw a Eurovision party in 2026: headcount, venue, theme, country-themed buffet, four-hour run-of-show, and the free scoring games that keep every song competitive."
        canonical="https://eurovision.games/eurovision-party"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision party',
          'how to host eurovision party',
          'eurovision watch party',
          'eurovision party games',
          'eurovision party ideas',
          'eurovision night',
        ]}
        jsonLd={[article, faqJsonLd, event, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Hosting playbook"
        chipTone="gold"
        title="Eurovision party — the complete hosting playbook"
        lede="A Eurovision party is a watch party for the Eurovision Song Contest, usually styled as a costume night with themed food, voting games, and rowdy commentary. Done right, it is the most chaotic dinner party of the year. Here is how to run one — guest list, theme, food, run-of-show, and how to keep every song competitive."
      />

      <ContentLayout>
        <Section title="What is a Eurovision party?">
          <p>
            A Eurovision party is a structured watch night built around the grand final of the Eurovision Song Contest.
            The broadcast lasts roughly three and a half hours; a good party turns that runtime into a competition by
            adding three ingredients: <strong className="text-white">opinions</strong> (everyone has a take),{' '}
            <strong className="text-white">stakes</strong> (a scored game makes every song matter), and{' '}
            <strong className="text-white">sustained energy</strong> (food, costumes, and breaks structured around the
            broadcast). Skip any one and you get a quiet living-room screening — fun, but not a party.
          </p>
        </Section>

        <Section title="Headcount and venue">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">2\u201320 players via the app.</strong> Sweet spot is 6\u201310 — enough variety in predictions and duels without the trivia rotation getting stale.</li>
            <li><strong className="text-white">Living room, garden, or Zoom.</strong> The scoring app runs on every guest&apos;s phone, so the venue just has to fit the broadcast and the buffet.</li>
            <li><strong className="text-white">Broadcast source.</strong> National broadcaster (BBC, RAI, ARD, ERT, etc.), the official Eurovision YouTube stream where available, or a projector pulled from any of the above.</li>
            <li><strong className="text-white">One screen for the show, one for the leaderboard.</strong> A second screen mirroring the <a href="/dashboard" className="text-euro-pink-light hover:text-white underline underline-offset-2">live Dashboard</a> keeps the standings visible without anyone craning at a phone.</li>
          </ul>
        </Section>

        <Section title="Theme and decor">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">National flag bunting.</strong> Print the 26 grand-final flags and string them across the room — cheapest, most legible decor on the night.</li>
            <li><strong className="text-white">A mini disco ball.</strong> One on a battery base in the buffet area is enough to tilt the whole room into Eurovision territory.</li>
            <li><strong className="text-white">Battery-powered LED lights.</strong> Pink and purple to match the broadcast palette; tape them along the screen frame.</li>
            <li><strong className="text-white">Country assignments.</strong> Each guest draws a country at the door from a bowl and roots for it all night — instant emotional investment.</li>
          </ul>
        </Section>

        <Section title="Food and drink — country-themed buffet">
          <p>
            Pick six countries from the running order and serve one dish per country, all finger food (no plating
            during the show). A representative spread:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Sweden</strong> — meatballs with lingonberry.</li>
            <li><strong className="text-white">Italy</strong> — arancini and bruschetta.</li>
            <li><strong className="text-white">Greece</strong> — spanakopita triangles.</li>
            <li><strong className="text-white">UK</strong> — sausage rolls.</li>
            <li><strong className="text-white">France</strong> — mini croissants with brie.</li>
            <li><strong className="text-white">Israel</strong> — hummus with pita.</li>
          </ul>
          <p>
            Drinks: country-themed cocktails (Aperol for Italy, Aquavit for Sweden, Limoncello for Italy, Pastis for
            France) plus a generous mocktail option for designated drivers and non-drinkers.
          </p>
        </Section>

        <Section title="Run-of-show — 4-hour timeline">
          <p>
            Times are relative to broadcast start (T-0 = first song). Anchor everything around T-0 and the night runs
            itself.
          </p>
          <DataTable
            headers={['Time', 'What happens', 'What to do']}
            align={['left', 'left', 'left']}
            rows={[
              ['T-60', 'Doors open', 'Country draw, costume judging, first drink'],
              ['T-45', 'Predictions phase', 'Open the room, share the join code'],
              ['T-30', 'Lock predictions', 'Run quiz round 1; final buffet top-up'],
              ['T-0', 'Broadcast starts', 'Host advances to Live Show; quiz locks, duels open'],
              ['T+0\u20132:00', '26 entries air', 'Duels run during postcards and ad breaks'],
              ['T+2:00', 'Interval act (~25 min)', 'Big duel window; hot food drop'],
              ['T+2:30', 'Voting opens', 'Lines for jury + televote'],
              ['T+3:00', 'Jury vote', 'Most chaotic 25 minutes on TV'],
              ['T+3:30', 'Televote + winner', 'Host enters official results into the room'],
              ['T+3:45', 'Trophy reveal', 'Five winners in the app; photos'],
            ]}
          />
        </Section>

        <Section title="Game options to layer on">
          <p>
            <a href="/eurovision-games" className="text-euro-pink-light hover:text-white underline underline-offset-2">Eurovision Games</a> stacks
            four scoring modes across the night — pick all four for full chaos, or just predictions if you want a
            quieter room.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white"><a href="/eurovision-2026-predictions" className="text-euro-pink-light hover:text-white underline underline-offset-2">Predictions</a></strong> — Top 5 and Worst 5, locked at T-0. The 500-point spine of the leaderboard.</li>
            <li><strong className="text-white"><a href="/eurovision-trivia" className="text-euro-pink-light hover:text-white underline underline-offset-2">Quiz</a></strong> — three preshow rounds, locked when the broadcast starts.</li>
            <li><strong className="text-white"><a href="/duels" className="text-euro-pink-light hover:text-white underline underline-offset-2">Duels</a></strong> — head-to-head trivia in the ad breaks. Steal or Double.</li>
            <li><strong className="text-white"><a href="/dashboard" className="text-euro-pink-light hover:text-white underline underline-offset-2">Dashboard</a></strong> — the live leaderboard everyone in the room is watching.</li>
          </ul>
        </Section>

        <Section title="Hosting in different time zones">
          <p>
            Eurovision broadcasts live in CET, which is mid-evening for most of Europe but late for the UK and Ireland
            and very late for Western Europe&apos;s Atlantic edges. In the Americas it is early afternoon to early
            evening; in Australia and New Zealand it lands as a Sunday morning brunch. Match the food to the local
            slot — brunch spreads in Sydney, full dinner in Berlin — but keep the run-of-show identical: doors at
            T-60, predictions locked at T-0, duels in the breaks. The room link works the same in every time zone.
          </p>
        </Section>

        <Section title="Frequently asked questions">
          <FaqAccordion items={FAQ} />
        </Section>

        <CtaBanner
          title="Lock in your Eurovision party"
          body="Send the room link with the invite — guests can predict from anywhere."
          primary={{ label: 'Create', href: '/' }}
          secondary={{ label: 'Eurovision night', href: '/eurovision-night' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-night', title: 'Eurovision Night', blurb: 'Minute-by-minute run-of-show across the four-hour broadcast.' },
            { href: '/how-to-play', title: 'How to play', blurb: 'Sixty-second setup walkthrough — create-room to trophy reveal.' },
            { href: '/eurovision-2026-predictions', title: 'Predictions', blurb: 'Top 5 and Worst 5 — the 500-point engine of every party leaderboard.' },
            { href: '/eurovision-trivia', title: 'Trivia', blurb: 'Sample quiz questions and how the bank is structured.' },
            { href: '/duels', title: 'Duels', blurb: 'Head-to-head battles for the ad-break window. Steal or Double.' },
            { href: '/faq', title: 'FAQ', blurb: 'Edge cases — late guests, leavers, Zoom hosting, and time zones.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
