import { useTranslation } from 'react-i18next';

const CARDS = [
  { href: '/eurovision-night', titleKey: 'nightTitle', descKey: 'nightDesc' },
  { href: '/eurovision-2026-predictions', titleKey: 'predictionsTitle', descKey: 'predictionsDesc' },
  { href: '/eurovision-trivia', titleKey: 'triviaTitle', descKey: 'triviaDesc' },
  { href: '/eurovision-party', titleKey: 'partyTitle', descKey: 'partyDesc' },
  { href: '/eurovision-games', titleKey: 'gamesTitle', descKey: 'gamesDesc' },
  { href: '/how-to-play', titleKey: 'howTitle', descKey: 'howDesc' },
] as const;

export default function HomeSeoBlock() {
  const { t } = useTranslation();
  return (
    <section className="bg-euro-deep text-white px-4 py-16 border-t border-white/10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl md:text-5xl font-bold text-center text-euro-gold">
          {t('homeSeo.headline')}
        </h1>
        <p className="text-lg text-white/80 text-center">
          <strong>{t('homeSeo.leadStrong')}</strong>{t('homeSeo.leadRest')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10">
          {CARDS.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="rounded-xl border border-white/10 p-4 hover:border-euro-gold/60 transition"
            >
              <h3 className="font-bold mb-1">{t(`homeSeo.cards.${c.titleKey}`)}</h3>
              <p className="text-sm text-white/60">{t(`homeSeo.cards.${c.descKey}`)}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
