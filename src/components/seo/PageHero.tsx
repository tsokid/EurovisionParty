import { createContext, useContext, type ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from './Breadcrumbs';
import Chip from './Chip';

interface Props {
  crumbs: Crumb[];
  chip?: string;
  chipTone?: 'pink' | 'purple' | 'gold';
  title: string;
  lede: string;
  /** Shown before the H1 on the same row (e.g. the country's flag). */
  titleLead?: ReactNode;
  /** Under the lede in the text column (stats, CTA). */
  children?: ReactNode;
  /** Right column from 1024px, under the text on phones (Stage split hero). */
  aside?: ReactNode;
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
export default function PageHero({ crumbs, chip, chipTone = 'pink', title, lede, titleLead, children, aside }: Props) {
  const slot = usePageHeroSlot();
  if (aside || titleLead || children) {
    const h1 = <h1 className="hero-title">{title}</h1>;
    return (
      <header className={aside ? 'hero hero-split' : 'hero'}>
        <div className="wrap hero-inner">
          <div className="hero-main">
            <Breadcrumbs items={crumbs} />
            {chip && <Chip tone={chipTone}>{chip}</Chip>}
            {titleLead ? <div className="hero-title-row">{titleLead}{h1}</div> : h1}
            <p className="hero-lede">{lede}</p>
            {children}
          </div>
          {aside && <div className="hero-aside">{aside}</div>}
          {slot}
        </div>
      </header>
    );
  }
  return (
    <header className="hero">
      <div className="wrap hero-inner">
        <Breadcrumbs items={crumbs} />
        {chip && <Chip tone={chipTone}>{chip}</Chip>}
        <h1 className="hero-title">{title}</h1>
        <p className="hero-lede">{lede}</p>
        {slot}
      </div>
    </header>
  );
}
