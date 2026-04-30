import LocaleLink from './LocaleLink';
import { useTranslation } from 'react-i18next';

export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-white/10 mt-16 px-4 pb-10 pt-10 text-sm bg-black/30">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">

        {/* About */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.about')}</h4>
          <ul className="space-y-2">
            <li><LocaleLink to="/about" className="text-white/70 hover:text-white transition">{t('siteFooter.links.whatIs')}</LocaleLink></li>
            <li><LocaleLink to="/" className="text-white/70 hover:text-white transition">{t('siteFooter.links.freeGame')}</LocaleLink></li>
            <li><button data-cc="show-preferencesModal" className="text-white/70 hover:text-white transition text-left">{t('siteFooter.links.cookies')}</button></li>
          </ul>
        </div>

        {/* How to Play */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.howToPlay')}</h4>
          <ul className="space-y-2">
            <li><LocaleLink to="/how-to-play" className="text-white/70 hover:text-white transition">{t('siteFooter.links.gameStages')}</LocaleLink></li>
            <li><LocaleLink to="/eurovision-trivia" className="text-white/70 hover:text-white transition">{t('siteFooter.links.trivia')}</LocaleLink></li>
            <li><LocaleLink to="/eurovision-trivia" className="text-white/70 hover:text-white transition">{t('siteFooter.links.duels')}</LocaleLink></li>
            <li><LocaleLink to="/eurovision-2026-predictions" className="text-white/70 hover:text-white transition">{t('siteFooter.links.predictions')}</LocaleLink></li>
            <li><LocaleLink to="/scoring" className="text-white/70 hover:text-white transition">{t('siteFooter.links.dashboard')}</LocaleLink></li>
          </ul>
        </div>

        {/* FAQs */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.faq')}</h4>
          <ul className="space-y-2">
            <li><LocaleLink to="/faq" className="text-white/70 hover:text-white transition">{t('siteFooter.links.create')}</LocaleLink></li>
            <li><LocaleLink to="/faq" className="text-white/70 hover:text-white transition">{t('siteFooter.links.join')}</LocaleLink></li>
            <li><LocaleLink to="/faq" className="text-white/70 hover:text-white transition">{t('siteFooter.links.leave')}</LocaleLink></li>
            <li><LocaleLink to="/scoring" className="text-white/70 hover:text-white transition">{t('siteFooter.links.scoring')}</LocaleLink></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.legal')}</h4>
          <ul className="space-y-2">
            <li><LocaleLink to="/privacy" className="text-white/70 hover:text-white transition">{t('siteFooter.links.privacy')}</LocaleLink></li>
            <li><LocaleLink to="/terms" className="text-white/70 hover:text-white transition">{t('siteFooter.links.terms')}</LocaleLink></li>
          </ul>
        </div>

      </div>

      {/* EBU disclaimer */}
      <p className="max-w-5xl mx-auto text-white/35 text-xs mt-8 text-center leading-relaxed">
        {t('siteFooter.disclaimer')}
      </p>
      <p className="max-w-5xl mx-auto text-white/30 text-xs mt-2 text-center">
        <a href={`mailto:${t('siteFooter.contactEmail')}`} className="hover:text-white/60 transition">
          {t('siteFooter.contactEmail')}
        </a>
      </p>
    </footer>
  );
}
