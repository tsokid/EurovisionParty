import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

const FAQ = [
  { q: 'Is Eurovision Games free?', a: 'Yes — completely free. No subscriptions, no in-app purchases, no ads.' },
  { q: 'Do I need an account?', a: 'Only the host signs in (with email). Players join with a room code and a name — no account.' },
  { q: 'How many players can join a room?', a: '2 to 10. Couples can share a single device.' },
  { q: 'Does it work on mobile?', a: 'Yes. The app is mobile-first and installs as a PWA on iOS and Android.' },
  { q: 'What browsers are supported?', a: 'Chrome 120+, Safari 17+, Firefox 121+, Edge 120+. Older browsers may work but are not tested.' },
  { q: 'Can players join late?', a: 'Yes — until the host advances past the predictions phase. Late joiners can still play trivia duels.' },
  { q: 'What happens if a player disconnects?', a: 'A reconnect banner appears; one tap rejoins them with state preserved. Predictions and points are not lost.' },
  { q: 'Can the host eject a player?', a: 'Yes — host has a player-management panel from the lobby onward.' },
  { q: 'How do duels work?', a: '3-question head-to-head trivia. Winner steals points from loser. Each pair can duel a maximum of 2 times per night.' },
  { q: 'How is scoring calculated?', a: 'See the Scoring page for full formulas. Top-5 picks earn variable points by rank match; Worst-5 earn flat points if the country lands in the bottom 5; trivia and duels add quiz points.' },
  { q: 'What are the five winner categories?', a: 'Champion (most total points), Thief (most points stolen in duels), Duelist (most duels won), Oracle (best predictions), Guru (most correct trivia answers).' },
  { q: 'What is sudden death?', a: 'An optional host-toggleable tiebreak: if two players tie a winner category, one trivia question decides it — fastest correct answer wins.' },
  { q: 'How do you handle Eurovision results?', a: 'Either the host enters jury and televote results live, or the auto-parser pulls them from the official source on grand-final night.' },
  { q: 'Is Eurovision Games official?', a: 'No. We are not affiliated with the European Broadcasting Union, ORF, or the Eurovision Song Contest brand.' },
  { q: 'Where does my data go?', a: 'Stored on Supabase (Postgres + auth). See the Privacy page for retention details.' },
  { q: 'Can I host more than one room?', a: 'Yes — but only one room is active per host at a time during the broadcast.' },
];

export default function FAQPage() {
  const faqSchema = {
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
        title="Eurovision Games FAQ — Setup, Rules, Scoring &amp; Troubleshooting"
        description="Frequently asked questions about Eurovision Games: setup, players, scoring, duels, sudden death, mobile install, troubleshooting, and privacy."
        canonical="https://eurovision.games/faq"
        jsonLd={faqSchema}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision Games FAQ</h1>
        <p className="lead">
          Quick answers to the questions players ask most. For deeper detail see the{' '}
          <a href="/rules">rule book</a>, <a href="/scoring">scoring page</a>, or <a href="/how-to-play">setup guide</a>.
        </p>
        {FAQ.map((f) => (
          <section key={f.q}>
            <h2>{f.q}</h2>
            <p>{f.a}</p>
          </section>
        ))}
        <p>
          Still stuck? See <a href="/about">About</a> for contact details, or{' '}
          <a href="/eurovision-night">Eurovision night hosting guide</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
