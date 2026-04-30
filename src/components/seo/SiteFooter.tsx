import { useTranslation } from 'react-i18next';

const SECTIONS = [
  {
    headerKey: 'play',
    links: [
      ['/how-to-play', 'howToPlay'],
      ['/rules', 'rules'],
      ['/scoring', 'scoring'],
    ],
  },
  {
    headerKey: 'games',
    links: [
      ['/eurovision-games', 'eurovisionGames'],
      ['/eurovision-trivia', 'trivia'],
      ['/online-games', 'online'],
      ['/mobile-games', 'mobile'],
    ],
  },
  {
    headerKey: 'hosting',
    links: [
      ['/eurovision-night', 'eurovisionNight'],
      ['/eurovision-party', 'party'],
      ['/eurovision-2026-predictions', 'predictions'],
    ],
  },
  {
    headerKey: 'about',
    links: [
      ['/about', 'aboutPage'],
      ['/faq', 'faq'],
      ['/privacy', 'privacy'],
      ['/terms', 'terms'],
    ],
  },
] as const;

export default function SiteFooter() {
  const { t } = useTranslation();
  const email = t('siteFooter.contactEmail');
  return (
    <footer className="border-t border-white/10 mt-16 px-4 py-10 text-sm bg-black/30">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {SECTIONS.map((s) => (
          <div key={s.headerKey} className="flex flex-col items-center">
            <h4 className="text-euro-gold font-bold mb-2">{t(`siteFooter.${s.headerKey}`)}</h4>
            <ul className="space-y-1">
              {s.links.map(([href, labelKey]) => (
                <li key={href}>
                  <a href={href} className="text-white/70 hover:text-white">
                    {t(`siteFooter.links.${labelKey}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="max-w-5xl mx-auto text-white/40 text-xs mt-6 text-center">
        {t('siteFooter.disclaimerStart')}
        <a href={`mailto:${email}`} className="text-white/60 hover:text-white">{email}</a>
      </p>
    </footer>
  );
}
