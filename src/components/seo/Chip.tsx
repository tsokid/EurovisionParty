// Small category pill on the Stage `.chip` (the hero chip on every SEO page).
// The boards show the pink chip for pink and purple tones alike.
interface ChipProps {
  children: React.ReactNode;
  tone?: 'pink' | 'purple' | 'gold';
}

const TONES: Record<NonNullable<ChipProps['tone']>, string> = {
  pink: 'chip chip-pink',
  purple: 'chip chip-pink',
  gold: 'chip chip-gold',
};

export default function Chip({ children, tone = 'pink' }: ChipProps) {
  return <span className={TONES[tone]}>{children}</span>;
}
