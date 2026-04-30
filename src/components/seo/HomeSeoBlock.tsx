// Home page SEO/GEO answer block. Lives BELOW the hero so mobile CTAs stay
// above the fold (per UX rule), while crawlers and AI extractors see a clean
// definition block + sibling links in the DOM.
export default function HomeSeoBlock() {
  return (
    <section className="bg-euro-deep text-white px-4 py-16 border-t border-white/10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl md:text-5xl font-bold text-center text-euro-gold">
          Eurovision Games — host the perfect Eurovision night
        </h1>
        <p className="text-lg text-white/80 text-center">
          <strong>Eurovision Games is a free, browser-based party game</strong> where 2-20 friends predict the Eurovision 2026 Top
          5 and Worst 5, battle in trivia duels, and crown five winners — Champion, Thief, Duelist, Oracle, Guru. No download,
          no account.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10">
          <a href="/eurovision-night" className="rounded-xl border border-white/10 p-4 hover:border-euro-gold/60 transition">
            <h3 className="font-bold mb-1">Eurovision night</h3>
            <p className="text-sm text-white/60">Hosting playbook for the watch party.</p>
          </a>
          <a href="/eurovision-2026-predictions" className="rounded-xl border border-white/10 p-4 hover:border-euro-gold/60 transition">
            <h3 className="font-bold mb-1">2026 predictions</h3>
            <p className="text-sm text-white/60">Top 5 / Worst 5 format and 35-country line-up.</p>
          </a>
          <a href="/eurovision-trivia" className="rounded-xl border border-white/10 p-4 hover:border-euro-gold/60 transition">
            <h3 className="font-bold mb-1">Eurovision trivia</h3>
            <p className="text-sm text-white/60">10 sample questions and how duels work.</p>
          </a>
          <a href="/eurovision-party" className="rounded-xl border border-white/10 p-4 hover:border-euro-gold/60 transition">
            <h3 className="font-bold mb-1">Eurovision party</h3>
            <p className="text-sm text-white/60">Full hosting playbook with run-of-show.</p>
          </a>
          <a href="/eurovision-games" className="rounded-xl border border-white/10 p-4 hover:border-euro-gold/60 transition">
            <h3 className="font-bold mb-1">Eurovision games</h3>
            <p className="text-sm text-white/60">What the game does and why play.</p>
          </a>
          <a href="/how-to-play" className="rounded-xl border border-white/10 p-4 hover:border-euro-gold/60 transition">
            <h3 className="font-bold mb-1">How to play</h3>
            <p className="text-sm text-white/60">2-minute setup guide.</p>
          </a>
        </div>
      </div>
    </section>
  );
}
