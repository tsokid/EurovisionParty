import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function AboutPage() {
  const aboutSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Eurovision Games',
    description: 'A free, fan-built party game for the Eurovision Song Contest.',
  };
  return (
    <>
      <SchemaHead
        title="About Eurovision Games — Why We Built It"
        description="Eurovision Games is a free, fan-built browser party game for the Eurovision Song Contest. Origin, philosophy, and contact."
        canonical="https://eurovision.games/about"
        jsonLd={aboutSchema}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>About Eurovision Games</h1>
        <p className="lead">
          <strong>Eurovision Games is a free, fan-built party game for the Eurovision Song Contest.</strong> It started as a
          spreadsheet between friends — a way to score predictions automatically instead of arguing about jury vs televote
          maths during the broadcast — and grew into a real-time multiplayer app for any group hosting a Eurovision night.
        </p>

        <h2>Why we built it</h2>
        <p>
          Watching Eurovision is great. Watching Eurovision <em>with stakes</em> is better. Existing options — printed bingo
          cards, paid quiz packs, custom Google Sheets — all break in the same way: someone has to do the scoring, and that
          someone misses half the show. We wanted live, automatic scoring that didn&apos;t cost anything and didn&apos;t require an
          install. That&apos;s the entire product.
        </p>

        <h2>Philosophy</h2>
        <ul>
          <li><strong>Free, always.</strong> No subscriptions, no ads, no &quot;premium tier.&quot;</li>
          <li><strong>No download.</strong> If it can&apos;t open in a browser, it&apos;s not the Eurovision experience.</li>
          <li><strong>No accounts for guests.</strong> Hosts sign in once; guests join with a name.</li>
          <li><strong>Mobile-first.</strong> Most people host from a sofa with a phone in hand.</li>
          <li><strong>Real fun, not gamified.</strong> Five winner categories, sudden death, real bragging rights — we don&apos;t add streaks or daily challenges.</li>
        </ul>

        <h2>Not affiliated</h2>
        <p>
          Eurovision Games is an independent project. We are not affiliated with the European Broadcasting Union, ORF, or the
          Eurovision Song Contest brand. &quot;Eurovision&quot; is a trademark of the EBU. We use it descriptively only — to indicate
          the broadcast this game is designed to accompany.
        </p>

        <h2>Contact</h2>
        <p>
          Bug reports, feature requests, hosting questions: email the maintainers at <em>hello@eurovision.games</em> (replace
          this line with the live address before launch).
        </p>

        <p>
          Related: <a href="/privacy">privacy policy</a> · <a href="/terms">terms of service</a> · <a href="/faq">FAQ</a>.
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
