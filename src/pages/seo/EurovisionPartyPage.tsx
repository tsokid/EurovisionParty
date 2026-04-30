import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function EurovisionPartyPage() {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Party — Hosting Playbook',
    author: { '@type': 'Organization', name: 'Eurovision Games' },
    datePublished: '2026-04-30',
  };
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Throw a Eurovision Party',
    step: [
      { '@type': 'HowToStep', name: 'Set the date', text: 'Eurovision 2026 grand final is Saturday 16 May.' },
      { '@type': 'HowToStep', name: 'Plan the guest list', text: '6-10 guests works best for predictions and duels.' },
      { '@type': 'HowToStep', name: 'Choose a theme', text: 'Country flags, glitter, sequins, or a "wear your favourite" rule.' },
      { '@type': 'HowToStep', name: 'Set up scoring', text: 'Open eurovision.games and create a room before guests arrive.' },
      { '@type': 'HowToStep', name: 'Run the night', text: 'Predictions before kick-off, duels in the breaks, votes during the televote.' },
    ],
  };
  return (
    <>
      <SchemaHead
        title="Eurovision Party — The Complete Hosting Playbook for 2026"
        description="How to throw a Eurovision party in 2026: guests, theme, decor, food, scoring games, and a minute-by-minute run-of-show. Free playbook."
        canonical="https://eurovision.games/eurovision-party"
        jsonLd={[article, howTo]}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>Eurovision party — the complete hosting playbook</h1>
        <p className="lead">
          <strong>A Eurovision party is a watch party for the Eurovision Song Contest, usually styled as a costume night with
          themed food, voting games, and rowdy commentary.</strong> Done right, it&apos;s the most chaotic dinner party of the year.
          This playbook covers guest list, theme, food, run-of-show, and how to use a free scoring app to keep everyone
          competitive across the four-hour broadcast.
        </p>

        <h2>What makes a great Eurovision party</h2>
        <p>
          Three ingredients: <strong>opinions</strong> (everyone has a take), <strong>stakes</strong> (a scored game makes every
          song matter), and <strong>sustained energy</strong> (food, costumes, and breaks structured around the broadcast). Skip
          any one and you get a quiet living-room screening — fun, but not a party.
        </p>

        <h2>Guest list</h2>
        <p>
          The sweet spot is 6-10. Below that, predictions feel sparse and duels run out of opponents. Above 10, the room becomes
          a viewing party rather than a competitive one — fewer people pay close attention to each song, and the trivia duels
          can&apos;t cycle through everyone in a single night. Mix Eurovision die-hards with newcomers — the newcomers ask the best
          questions and the regulars hold the trivia knowledge.
        </p>

        <h2>Theme and decor</h2>
        <ul>
          <li><strong>Flags everywhere.</strong> A printed bunting of the 26 grand-final flags goes up cheap.</li>
          <li><strong>Sequins and glitter.</strong> The unofficial Eurovision dress code.</li>
          <li><strong>Country assignments.</strong> Each guest draws a country at the door and roots for it all night.</li>
          <li><strong>A scoreboard.</strong> A second screen showing the live leaderboard from <a href="/">Eurovision Games</a>.</li>
        </ul>

        <h2>Food and drink</h2>
        <p>
          Pick six countries from the running order and serve one dish per country. Sweden meatballs, Italy arancini, Greece
          tiropita, France baguette and brie, UK sausage rolls, Israel hummus. Avoid hot mains that need plating during the
          show — finger food only. For drinks, country-themed cocktails (Aperol = Italy, Aquavit = Sweden, Limoncello = Italy)
          plus a generous mocktail option.
        </p>

        <h2>Voting and games</h2>
        <p>
          The official broadcast lets juries and the public vote. Your party gets to vote too, and you score it with{' '}
          <a href="/">Eurovision Games</a>:
        </p>
        <ul>
          <li><strong>Predictions:</strong> Top 5 and Worst 5, locked before song 1.</li>
          <li><strong>Trivia duels:</strong> Head-to-head between any pair, winner steals points.</li>
          <li><strong>Live scoring:</strong> Each song updates predictions automatically against jury + televote.</li>
          <li><strong>Five winners:</strong> At the end, five trophy cards reveal Champion, Thief, Duelist, Oracle, Guru.</li>
        </ul>

        <h2>Hosting checklist (12 hours before the show)</h2>
        <ul>
          <li>☐ Confirm broadcast source (TV channel, stream, or projector setup)</li>
          <li>☐ Print or screenshot the running order</li>
          <li>☐ Test the scoring app: create a test room, add a fake player</li>
          <li>☐ Cook ahead — anything that survives 4 hours warm</li>
          <li>☐ Prepare country-draw slips for arriving guests</li>
          <li>☐ Stock alcohol-free options for drivers and non-drinkers</li>
          <li>☐ Charge phones — players use them all night for predictions and duels</li>
        </ul>

        <h2>Run-of-show (Saturday 16 May 2026)</h2>
        <ul>
          <li><strong>20:00</strong> — Doors. Costume judging. Country draws.</li>
          <li><strong>20:30</strong> — Open Eurovision Games room. Lock predictions before kick-off.</li>
          <li><strong>21:00</strong> — Grand final live (CET). 25 entries (Big Four + host + 20 semi qualifiers).</li>
          <li><strong>~22:30</strong> — Interval act. Trivia duel window.</li>
          <li><strong>23:00</strong> — Jury vote. Most chaotic 25 min on TV.</li>
          <li><strong>23:30</strong> — Televote. Winner declared.</li>
          <li><strong>23:45</strong> — Trophy cards revealed in the app. Photos.</li>
        </ul>

        <p>
          Related: <a href="/eurovision-night">how to host Eurovision night</a> ·{' '}
          <a href="/eurovision-2026-predictions">2026 predictions format</a> ·{' '}
          <a href="/eurovision-trivia">trivia samples</a>.
        </p>
        <p>
          <a href="/" className="btn-primary">Create your party room →</a>
        </p>
      </article>
      <SiteFooter />
    </>
  );
}
