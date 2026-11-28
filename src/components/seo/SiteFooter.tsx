import LocaleLink from './LocaleLink';
import Wordmark from './Wordmark';
import { useCurrentYear } from '../../lib/currentContest';
import { useLocale } from '../../lib/seo/LocaleContext';
import { resolveLinks, useSiteDoc, type ResolvedLink } from '../../lib/cms/siteChrome';
import type { NavLink } from '../../../supabase/functions/_shared/cms/siteLinks';
import { useCmsAttrs, type CmsAttrs } from '../../lib/cms/cmsAttrs';

function Column({ title, links, attrs }: { title: string; links: ResolvedLink[]; attrs: (path: string) => CmsAttrs }) {
  return (
    <div>
      <h4 {...attrs('heading')}>{title}</h4>
      <ul>
        {links.map((l) => (
          <li key={l.to}>
            {l.target.kind === 'external' ? (
              <a href={l.to} rel="noopener" {...attrs(`links.${l.index}.label`)}>{l.label}</a>
            ) : (
              <LocaleLink to={l.to} {...attrs(`links.${l.index}.label`)}>{l.label}</LocaleLink>
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
  // Admin preview only (click-to-edit); {} on the site.
  const attrs = useCmsAttrs('site-footer');

  return (
    <footer className="footer" role="contentinfo">
      <div className="wrap footer-inner">
        <div className="fcols">
          <div className="fbrand">
            <Wordmark />
            <span className="t-meta" {...attrs('tagline')}>{doc.tagline}</span>
          </div>

          {doc.columns.map((c, i) => (
            <Column key={c.id} title={c.heading} links={resolveLinks(c.links as NavLink[], locale, year)} attrs={(p) => attrs(`columns.${i}.${p}`)} />
          ))}
        </div>

        {/* EBU disclaimer */}
        <p className="t-meta fdisclaimer" {...attrs('disclaimer')}>{doc.disclaimer}</p>
      </div>
    </footer>
  );
}
