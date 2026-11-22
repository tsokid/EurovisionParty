import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import PageHero from './PageHero';
import Section from './Section';
import LocaleLink from './LocaleLink';
import { IconBox, TocCard, TocSeg, type IconName, type TocItem } from './StageKit';
import type { Crumb } from './Breadcrumbs';
import { Button } from '../stage';

export type LegalTab = 'privacy' | 'terms' | 'cookies' | 'about';
const TABS: LegalTab[] = ['privacy', 'terms', 'cookies', 'about'];

interface FrameProps {
  crumbs: Crumb[];
  chip?: ReactNode;
  title: string;
  lede: string;
  grad?: 'dash' | string;
  /** Hero buttons (primary + optional ghost). */
  actions?: { primary: { label: string; href: string }; secondary?: { label: string; href: string } };
  aside?: ReactNode;
  heroExtra?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Collects the direct <Section> children into the "on this page" menu (ids added when missing). */
function useSectionToc(children: ReactNode): { toc: TocItem[]; body: ReactNode[] } {
  const toc: TocItem[] = [];
  const body = Children.toArray(children).map((child, i) => {
    if (isValidElement(child) && child.type === Section) {
      const el = child as ReactElement<{ id?: string; title: string }>;
      const id = el.props.id ?? `s${i + 1}`;
      toc.push({ id, title: el.props.title });
      return el.props.id ? el : cloneElement(el, { id });
    }
    return child;
  });
  return { toc, body };
}

/**
 * Stage article template (package-2 guide pages): split hero with optional
 * buttons and aside, a left "on this page" menu from the direct <Section>
 * children (sticky `.seg` on phones), and the reading column.
 */
export function ArticleFrame({ crumbs, chip, title, lede, grad, actions, aside, heroExtra, className, children }: FrameProps) {
  const { t } = useTranslation();
  const { toc, body } = useSectionToc(children);
  return (
    <>
      <PageHero crumbs={crumbs} chip={chip} chipTone="pink" title={title} grad={grad} lede={lede} aside={aside} className={className}>
        {heroExtra}
        {actions && (
          <div className="kit-actions">
            <Button to={actions.primary.href} size="lg">{actions.primary.label}</Button>
            {actions.secondary && <Button to={actions.secondary.href} variant="ghost" size="lg">{actions.secondary.label}</Button>}
          </div>
        )}
      </PageHero>
      {toc.length > 1 && <TocSeg label={t('legalPage.onThisPage')} items={toc} />}
      <div className="wrap pg-body toc-left legal-body">
        <aside className="pg-aside howto-aside">
          {toc.length > 1 && <TocCard label={t('legalPage.onThisPage')} items={toc} />}
        </aside>
        <div className="pg-main stage-prose legal-main">{body}</div>
      </div>
    </>
  );
}

interface Props {
  current: LegalTab;
  crumbs: Crumb[];
  chip?: string;
  title: string;
  lede: string;
  /** ISO date of the last copy edit, shown under the lede. */
  updated?: string;
  /** Up to three short facts for the hero aside (legal board). */
  highlights?: { icon: IconName; title: ReactNode; body?: ReactNode }[];
  children: ReactNode;
}

/**
 * Shared Stage template of the privacy, terms, cookies and about pages (legal
 * board): hero with the four tabs (links to the existing routes), optional
 * highlight cards, then a left "on this page" menu built from the page's
 * direct <Section> children and the reading column.
 */
export default function LegalFrame({ current, crumbs, chip, title, lede, updated, highlights, children }: Props) {
  const { t } = useTranslation();
  const { toc, body } = useSectionToc(children);
  const d = updated ? updated.slice(0, 10).split('-') : null;

  return (
    <>
      <PageHero
        crumbs={crumbs}
        chip={chip}
        chipTone="pink"
        title={title}
        lede={lede}
        className="legal-hero"
        aside={highlights && highlights.length > 0 ? (
          <ul className="legal-hl">
            {highlights.map((h, i) => (
              <li key={i} className="card legal-hl-card">
                <IconBox name={h.icon} size={18} />
                <span>
                  <span className="legal-hl-t">{h.title}</span>
                  {h.body && <span className="t-meta">{h.body}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : undefined}
      >
        {d && (
          <p className="t-meta legal-updated m-0">
            {t('legalPage.updated')}{' '}
            <time dateTime={updated!.slice(0, 10)} className="num">{`${Number(d[2])} · ${Number(d[1])} · ${d[0]}`}</time>
          </p>
        )}
        <nav aria-label={t('legalPage.tabs')} className="seg legal-tabs">
          {TABS.map((tab) => (
            <LocaleLink key={tab} to={`/${tab}`} aria-current={tab === current ? 'page' : undefined}>
              {t(`legalPage.tab.${tab}`)}
            </LocaleLink>
          ))}
        </nav>
      </PageHero>

      {toc.length > 1 && <TocSeg label={t('legalPage.onThisPage')} items={toc} />}

      <div className="wrap pg-body toc-left legal-body">
        <aside className="pg-aside howto-aside">
          {toc.length > 1 && <TocCard label={t('legalPage.onThisPage')} items={toc} numbered={false} />}
        </aside>
        <div className="pg-main stage-prose legal-main">{body}</div>
      </div>
    </>
  );
}
