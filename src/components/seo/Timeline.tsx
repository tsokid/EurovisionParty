export interface TimelineItem {
  time: string;
  label: string;
}

interface Props {
  title?: string;
  items: TimelineItem[];
}

export default function Timeline({ title, items }: Props) {
  return (
    <div>
      {title && <h3 className="font-bold text-white text-lg mb-5">{title}</h3>}
      <ol className="relative pl-6">
        <span className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-euro-purple-light/60 via-euro-pink/40 to-transparent" aria-hidden />
        {items.map((it) => (
          <li key={it.time} className="relative pb-5 last:pb-0">
            <span className="absolute -left-[19px] top-2 w-2.5 h-2.5 rounded-full bg-euro-pink shadow-[0_0_0_3px_rgba(15,5,32,1)]" aria-hidden />
            <div className="font-mono text-xs text-euro-purple-light tabular-nums tracking-wide">{it.time}</div>
            <div className="text-white/85 mt-0.5">{it.label}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
