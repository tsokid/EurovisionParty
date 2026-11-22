import { createContext, useContext, type ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from './Breadcrumbs';
import Chip from './Chip';
import { useCmsAttrs } from '../../lib/cms/cmsAttrs';

interface Props {
  crumbs: Crumb[];
  chip?: ReactNode;
  chipTone?: 'pink' | 'purple' | 'gold';
  title: string;
  lede: string;
  /** Shown before the H1 on the same row (e.g. the country's flag). */
  titleLead?: ReactNode;
  /** Under the lede in the text column (stats, CTA). */
  children?: ReactNode;
  /** Right column from 1024px, under the text on phones (Stage split hero). */
  aside?: ReactNode;
  /**
   * Gradient part of the H1 (boards): 'dash' = the part after the last "— " or
   * ": " (on its own line from 1024px), or a substring of the title. The H1
   * text is unchanged either way.
   */
  grad?: 'dash' | string;
  /** Extra class on the <header> (page-specific hero tweaks). */
  className?: string;
  /** The doc path of the hero's fields ("hero"), for the admin preview's click-to-edit (nothing on the site). */
  cms?: string;
}

/** The H1 content with the board's gradient words; the text stays `title`. */
export function heroTitle(title: string, grad?: 'dash' | string): ReactNode {
  if (!grad) return title;
  if (grad === 'dash') {
    const cut = Math.max(title.lastIndexOf('— '), title.lastIndexOf(': '));
    if (cut <= 0) return title;
    return <>{title.slice(0, cut + 2)}<span className="grad lg:block">{title.slice(cut + 2)}</span></>;
  }
  const at = title.lastIndexOf(grad);
  if (at < 0) return title;
  return <>{title.slice(0, at)}<span className="grad">{grad}</span>{title.slice(at + grad.length)}</>;
}

/**
 * Extra row a page frame puts at the bottom of every hero below it (the hub's
 * section menu, from HubFrame), so the pages in that frame inherit it
 * without passing it through each page.
 */
export const PageHeroSlot = createContext<ReactNode>(null);

/** The frame's hero slot (for pages that draw their own hero). */
export const usePageHeroSlot = (): ReactNode => useContext(PageHeroSlot);

// Hero row used at the top of every SEO page (Stage board): breadcrumb, chip,
// H1, lede on the stage glow, closed by a hairline that introduces the body.
export default function PageHero({ crumbs, chip, chipTone = 'pink', title, lede, titleLead, children, aside, grad, className, cms }: Props) {
  const slot = usePageHeroSlot();
  const attrs = useCmsAttrs();
  const at = (field: string) => (cms ? attrs(`${cms}.${field}`) : undefined);
  const extra = className ? ` ${className}` : '';
  if (aside || titleLead || children) {
    const h1 = <h1 className="hero-title" {...at('title')}>{heroTitle(title, grad)}</h1>;
    return (
      <header className={(aside ? 'hero hero-split' : 'hero') + extra}>
        <div className="wrap hero-inner">
          <div className="hero-main">
            <Breadcrumbs items={crumbs} />
            {chip && <Chip tone={chipTone}>{chip}</Chip>}
            {titleLead ? <div className="hero-title-row">{titleLead}{h1}</div> : h1}
            <p className="hero-lede" {...at('lede')}>{lede}</p>
            {children}
          </div>
          {aside && <div className="hero-aside">{aside}</div>}
          {slot}
        </div>
      </header>
    );
  }
  return (
    <header className={'hero' + extra}>
      <div className="wrap hero-inner">
        <Breadcrumbs items={crumbs} />
        {chip && <Chip tone={chipTone}>{chip}</Chip>}
        <h1 className="hero-title" {...at('title')}>{heroTitle(title, grad)}</h1>
        <p className="hero-lede" {...at('lede')}>{lede}</p>
        {slot}
      </div>
    </header>
  );
}
