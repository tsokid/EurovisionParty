import Breadcrumbs, { type Crumb } from './Breadcrumbs';
import Chip from './Chip';

interface Props {
  crumbs: Crumb[];
  chip?: string;
  chipTone?: 'pink' | 'purple' | 'gold';
  title: string;
  lede: string;
}

// Hero row used at the top of every SEO page (Stage board): breadcrumb, chip,
// H1, lede on the stage glow, closed by a hairline that introduces the body.
export default function PageHero({ crumbs, chip, chipTone = 'pink', title, lede }: Props) {
  return (
    <header className="hero">
      <div className="wrap hero-inner">
        <Breadcrumbs items={crumbs} />
        {chip && <Chip tone={chipTone}>{chip}</Chip>}
        <h1 className="hero-title">{title}</h1>
        <p className="hero-lede">{lede}</p>
      </div>
    </header>
  );
}
