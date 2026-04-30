import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: 'Rules', href: '/rules' },
];

export default function RulesPage() {
  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Eurovision Games \u2014 Full Rule Book (2026)',
    description: 'The complete rules of Eurovision Games: phases, prediction lists, trivia duels, scoring, winner categories, sudden-death tiebreak, disputes, and edge cases.',
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/rules' },
  };

  return (
    <>
      <SchemaHead
        title="Eurovision Games Rules \u2014 Full Rule Book (2026)"
        description="The complete rules of Eurovision Games: phases, prediction lists, trivia duels, scoring, winner categories, sudden-death tiebreak, and dispute resolution."
        canonical="https://eurovision.games/rules"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={[
          'eurovision games rules',
          'eurovision party game rules',
          'eurovision trivia rules',
          'eurovision prediction rules',
        ]}
        jsonLd={[article, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="Rule book"
        chipTone="purple"
        title="Eurovision Games \u2014 the full rule book"
        lede="Everything one host or one player needs to settle a dispute mid-show. Phases, prediction rules, quiz and duel mechanics, trophy definitions, sudden-death tiebreak, and the disconnect policy. The defaults work for most groups; the host can override most of it from the lobby."
      />

      <ContentLayout>
        <Section title="Player limits and host responsibilities">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">2 to 20 players per room.</strong> Couples can share a single device.</li>
            <li><strong className="text-white">One host signs in.</strong> Magic-link email auth, no password. The host owns the room until they leave or delete it.</li>
            <li><strong className="text-white">Players join with a code.</strong> No account needed for guests \u2014 just the 6-character room code and a display name.</li>
            <li><strong className="text-white">Host advances phases.</strong> The room moves through Lobby \u2192 Predictions \u2192 Quiz \u2192 Live Show \u2192 Results \u2192 Final on host action; players cannot skip phases.</li>
            <li><strong className="text-white">Host has override authority.</strong> Reset trivia rounds, void duels, override scoring on clear input errors, and eject players from the host panel.</li>
          </ul>
        </Section>

        <Section title="Phases">
          <p>
            The room moves through six phases in fixed order. The host advances each one manually \u2014 there is no automatic
            timer pushing groups forward.
          </p>
          <DataTable
            headers={['Phase', 'Typical duration', 'What\u2019s locked']}
            align={['left', 'left', 'left']}
            rows={[
              ['Lobby', 'Until host starts', 'Predictions, quiz, duels'],
              ['Predictions', '5\u201310 min before show', 'Duels'],
              ['Quiz', 'Concurrent with Predictions', 'Duels'],
              ['Live Show', 'Duration of broadcast', <span key="ls">Predictions, quiz</span>],
              ['Results', 'Final 30 min of show', <span key="rs">Predictions, quiz</span>],
              ['Final', 'Trophy reveal', 'Everything except sudden death'],
            ]}
          />
        </Section>

        <Section title="Predictions rules">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Top 5.</strong> An ordered list of five countries you predict will finish 1\u20135 in the official combined jury + televote ranking.</li>
            <li><strong className="text-white">Worst 5.</strong> An ordered list of five countries you predict will finish at the bottom (last-place country = position 1 in your Worst 5).</li>
            <li><strong className="text-white">No overlap.</strong> A country can appear in only one of your two lists.</li>
            <li><strong className="text-white">Ordering matters.</strong> Exact-position match scores 50; correct list at the wrong position scores 20; outside the list scores 0.</li>
            <li><strong className="text-white">Hard lock at phase advance.</strong> Once the host advances past Predictions, no edits and no late entries.</li>
            <li><strong className="text-white">Late joiners</strong> can still play trivia and duels but cannot enter predictions.</li>
          </ul>
        </Section>

        <Section title="Quiz rules">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Host triggers each round.</strong> Default 3 rounds, 10 questions each (host configurable, 1\u20133).</li>
            <li><strong className="text-white">4 options per question.</strong> Single-select, 15-second timer.</li>
            <li><strong className="text-white">Tiered scoring by response time.</strong> 12 points (\u22643s), 8 points (\u22647s), 4 points (\u226415s); 0 for wrong or timeout.</li>
            <li><strong className="text-white">No question repeats per player</strong> across the entire night, including duels.</li>
            <li><strong className="text-white">Quiz locks at Live Show.</strong> Duels replace it from kick-off through Results.</li>
          </ul>
        </Section>

        <Section title="Duel rules">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Available from Live Show onward.</strong> Locked during Lobby, Predictions, and Quiz phases.</li>
            <li><strong className="text-white">3 questions per duel.</strong> Same questions for both players, answered in private.</li>
            <li><strong className="text-white">12-second timer per question.</strong> Score = 12 minus elapsed seconds; wrong or timeout = 0.</li>
            <li><strong className="text-white">Per-pair cap.</strong> Host-configurable (default 3, max 10) and counts rematches \u2014 you cannot grind one opponent.</li>
            <li><strong className="text-white">Refusing is allowed.</strong> No point penalty, and refused challenges do not count against the cap.</li>
            <li><strong className="text-white">Winner picks Steal or Double.</strong> Steal takes <em>winner_score</em> from the loser; Double adds the same to the winner. Loser keeps their points if Double.</li>
          </ul>
        </Section>

        <Section title="Trophy rules">
          <p>Five trophies are awarded at the Final phase. One player can win multiple categories.</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Champion</strong> \u2014 highest total points across all phases combined.</li>
            <li><strong className="text-white">Thief</strong> \u2014 most points taken via duel Steal effects.</li>
            <li><strong className="text-white">Duelist</strong> \u2014 most duels won across the night.</li>
            <li><strong className="text-white">Oracle</strong> \u2014 highest prediction-only score (Top 5 + Worst 5 totals).</li>
            <li><strong className="text-white">Guru</strong> \u2014 most correct trivia answers across quiz rounds and duels combined.</li>
          </ul>
          <p className="text-white/70 text-[15px]">
            Co-winners (2\u20135 players tied on a category) split a single trophy unless the host triggers sudden death.
          </p>
        </Section>

        <Section title="Sudden-death tiebreak">
          <p>
            For any tied trophy category, the host can open a 20-second sudden-death round. One trivia question, all
            tied players answer in parallel. Fastest correct answer wins the title outright \u2014 the previous co-winners
            forfeit. If nobody is correct, the co-winner status persists.
          </p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">Host toggle</h3>
            <p className="text-white/85 text-[15px] leading-relaxed">
              Sudden death is opt-in per category from the host panel during the Final phase. If the host doesn\u2019t open it,
              tied players share the trophy by default.
            </p>
          </div>
        </Section>

        <Section title="Disconnect policy">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Auto-rejoin.</strong> A reconnect banner appears the moment connection drops; one tap restores state with no manual rejoin.</li>
            <li><strong className="text-white">Points preserved.</strong> Predictions, quiz score, and duel results stay locked to your player slot through any drop.</li>
            <li><strong className="text-white">Active duels resolve fairly.</strong> If you disconnect mid-duel, your unanswered questions score 0; the duel resolves on whoever has more points.</li>
            <li><strong className="text-white">No bench penalty.</strong> Quiz rounds and duels you miss while away cannot be back-filled, but no points are deducted.</li>
          </ul>
        </Section>

        <Section title="Edge cases">
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">Player leaves mid-show.</strong> Slot frees up; their banked points stay frozen on the leaderboard so the rest of the room is unaffected.</li>
            <li><strong className="text-white">Host deletes the room.</strong> Session ends for everyone. A 5-second confirmation prevents accidents; deletion is irreversible.</li>
            <li><strong className="text-white">Cheating.</strong> Multi-device or AI-assisted answering: host discretion, suggested resolution is voiding affected duels and quiz rounds.</li>
            <li><strong className="text-white">Result entry error.</strong> Host can override scoring entries from the host panel. Re-running auto-parse pulls fresh official results.</li>
            <li><strong className="text-white">Multiple rooms per host.</strong> Allowed, but only one room is active per host at a time during the broadcast.</li>
          </ul>
        </Section>

        <CtaBanner
          title="Start a room with these rules"
          body="Default rules work for most groups. Open the host panel to tweak duel caps, quiz rounds, and sudden death."
          primary={{ label: 'Create room', href: '/' }}
          secondary={{ label: 'Scoring', href: '/scoring' }}
        />

        <RelatedCards
          items={[
            { href: '/scoring', title: 'Scoring formulas', blurb: 'Exact point math behind every prediction, quiz answer, and duel.' },
            { href: '/how-to-play', title: 'How to play', blurb: '60-second setup walkthrough from create-room to trophy reveal.' },
            { href: '/faq', title: 'FAQ', blurb: 'Quick answers on creating rooms, joining, leaving, and disputes.' },
            { href: '/eurovision-2026-predictions', title: 'Predictions', blurb: 'Top 5 and Worst 5 mechanics with the 2026 country list.' },
            { href: '/duels', title: 'Duels', blurb: 'Head-to-head trivia rules, Steal vs Double, and trophy impact.' },
            { href: '/eurovision-trivia', title: 'Trivia', blurb: 'Sample questions and the bank quiz/duels pull from.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
