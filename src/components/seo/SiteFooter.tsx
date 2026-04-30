const SECTIONS = [
  {
    h: 'Play',
    links: [
      ['/how-to-play', 'How to play'],
      ['/rules', 'Rules'],
      ['/scoring', 'Scoring'],
    ],
  },
  {
    h: 'Games',
    links: [
      ['/eurovision-games', 'Eurovision games'],
      ['/eurovision-trivia', 'Trivia'],
      ['/online-games', 'Online'],
      ['/mobile-games', 'Mobile'],
    ],
  },
  {
    h: 'Hosting',
    links: [
      ['/eurovision-night', 'Eurovision night'],
      ['/eurovision-party', 'Party'],
      ['/eurovision-2026-predictions', '2026 predictions'],
    ],
  },
  {
    h: 'About',
    links: [
      ['/about', 'About'],
      ['/faq', 'FAQ'],
      ['/privacy', 'Privacy'],
      ['/terms', 'Terms'],
    ],
  },
] as const;

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 mt-16 px-4 py-10 text-sm bg-black/30">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {SECTIONS.map((s) => (
          <div key={s.h}>
            <h4 className="text-euro-gold font-bold mb-2">{s.h}</h4>
            <ul className="space-y-1">
              {s.links.map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="text-white/70 hover:text-white">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="max-w-5xl mx-auto text-white/40 text-xs mt-6">
        © Eurovision Games. Not affiliated with the European Broadcasting Union or the Eurovision Song Contest.
      </p>
    </footer>
  );
}
