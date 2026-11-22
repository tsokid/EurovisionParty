import LocaleLink from './LocaleLink';
import Wordmark from './Wordmark';
import { useCurrentYear } from '../../lib/currentContest';
import { useLocale } from '../../lib/seo/LocaleContext';
import { resolveLinks, useSiteDoc, type ResolvedLink } from '../../lib/cms/siteChrome';
import type { NavLink } from '../../../supabase/functions/_shared/cms/siteLinks';

function Column({ title, links }: { title: string; links: ResolvedLink[] }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {links.map((l) => (
          <li key={l.to}>
            {l.target.kind === 'external' ? (
              <a href={l.to} rel="noopener">{l.label}</a>
            ) : (
              <LocaleLink to={l.to}>{l.label}</LocaleLink>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Site footer (Stage board): brand column on desktop, then the four columns
 * of the footer doc (content/pages/site-footer.json: About / How to play /
 * Eurovision / Help) and the EBU disclaimer. Links name pages by id, so every
 * target is a route in src/routeConfig.tsx.
 */
export default function SiteFooter() {
  const year = useCurrentYear();
  const locale = useLocale();
  const doc = useSiteDoc('site-footer');

  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="fcols">
          <div className="fbrand">
            <Wordmark />
            <span className="t-meta">{doc.tagline}</span>
          </div>

          {doc.columns.map((c) => (
            <Column key={c.id} title={c.heading} links={resolveLinks(c.links as NavLink[], locale, year)} />
          ))}
        </div>

        {/* EBU disclaimer */}
        <p className="t-meta fdisclaimer">{doc.disclaimer}</p>
      </div>
    </footer>
  );
}
