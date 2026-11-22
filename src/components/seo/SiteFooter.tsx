import LocaleLink from './LocaleLink';
import Wordmark from './Wordmark';
import { useTranslation } from 'react-i18next';
import { useCurrentYear } from '../../lib/currentContest';
import { hubPath } from '../../lib/seo/dynamicPages';

interface FooterLink {
  to: string;
  label: string;
}

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {links.map((l) => (
          <li key={l.to}><LocaleLink to={l.to}>{l.label}</LocaleLink></li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Site footer (Stage board): brand column on desktop, then four columns
 * (About / How to play / Eurovision / Help) and the EBU disclaimer.
 * Every target is a route in src/routeConfig.tsx.
 */
export default function SiteFooter() {
  const { t } = useTranslation();
  const year = useCurrentYear();
  const l = (key: string) => t(`siteFooter.links.${key}`, { year });

  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="fcols">
          <div className="fbrand">
            <Wordmark />
            <span className="t-meta">{t('siteFooter.tagline')}</span>
          </div>

          <Column
            title={t('siteFooter.about')}
            links={[
              { to: '/about', label: l('whatIs') },
              { to: '/eurovision-games', label: l('freeGame') },
              { to: '/cookies', label: l('cookies') },
            ]}
          />

          <Column
            title={t('siteFooter.howToPlay')}
            links={[
              { to: '/how-to-play', label: l('gameStages') },
              { to: '/eurovision-trivia', label: l('trivia') },
              { to: '/duels', label: l('duels') },
              { to: '/eurovision-predictions', label: l('predictions') },
              { to: '/dashboard', label: l('dashboard') },
              { to: '/rules', label: l('rules') },
            ]}
          />

          <Column
            title={t('siteFooter.eurovision')}
            links={[
              { to: hubPath(year), label: l('hub') },
              { to: '/past-contests', label: l('pastContests') },
              { to: '/countries', label: l('countries') },
              { to: '/winners', label: l('winners') },
            ]}
          />

          <Column
            title={t('siteFooter.help')}
            links={[
              { to: '/faq', label: l('faq') },
              { to: '/faq#create', label: l('create') },
              { to: '/faq#join', label: l('join') },
              { to: '/faq#leave', label: l('leave') },
              { to: '/scoring', label: l('scoring') },
              { to: '/privacy', label: l('privacy') },
              { to: '/terms', label: l('terms') },
            ]}
          />
        </div>

        {/* EBU disclaimer */}
        <p className="t-meta fdisclaimer">{t('siteFooter.disclaimer')}</p>
      </div>
    </footer>
  );
}
