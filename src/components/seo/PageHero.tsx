import { createContext, useContext, type ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from './Breadcrumbs';
import Chip from './Chip';

interface Props {
  crumbs: Crumb[];
  chip?: string;
  chipTone?: 'pink' | 'purple' | 'gold';
  title: string;
  lede: string;
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
export default function PageHero({ crumbs, chip, chipTone = 'pink', title, lede }: Props) {
  const slot = usePageHeroSlot();
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
