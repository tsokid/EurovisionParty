// Small category pill, matches the inspiration screens (e.g. "Hosting playbook")
interface ChipProps {
  children: React.ReactNode;
  tone?: 'pink' | 'purple' | 'gold';
}

const TONES: Record<NonNullable<ChipProps['tone']>, string> = {
  pink: 'bg-euro-pink/15 text-euro-pink-light border-euro-pink/30',
  purple: 'bg-euro-purple-light/15 text-euro-purple-light border-euro-purple-light/30',
  gold: 'bg-euro-gold/15 text-euro-gold border-euro-gold/30',
};

export default function Chip({ children, tone = 'pink' }: ChipProps) {
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
