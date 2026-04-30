import Breadcrumbs, { type Crumb } from './Breadcrumbs';
import Chip from './Chip';

interface Props {
  crumbs: Crumb[];
  chip?: string;
  chipTone?: 'pink' | 'purple' | 'gold';
  title: string;
  lede: string;
}

// Hero row used at the top of every SEO page: breadcrumb, chip, H1, lede,
// followed by a hairline divider that introduces the article body.
export default function PageHero({ crumbs, chip, chipTone = 'pink', title, lede }: Props) {
  return (
    <header className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-euro-purple/20 via-transparent to-euro-pink/15 pointer-events-none" aria-hidden />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14 lg:pt-16 lg:pb-20">
        <Breadcrumbs items={crumbs} />
        {chip && (
          <div className="mt-5">
            <Chip tone={chipTone}>{chip}</Chip>
          </div>
        )}
        <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-white">
          {title}
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-white/75 max-w-3xl leading-relaxed">{lede}</p>
      </div>
      <div className="border-b border-white/10" aria-hidden />
    </header>
  );
}
