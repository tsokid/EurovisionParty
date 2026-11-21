export interface TimelineItem {
  time: string;
  label: string;
}

interface Props {
  title?: string;
  items: TimelineItem[];
}

// Night timeline on the Stage rail (howto board): a dot per step on a
// vertical line, the time as a scoreboard numeral.
export default function Timeline({ title, items }: Props) {
  return (
    <div>
      {title && <h3 className="t-h3 text-stage-text mb-4">{title}</h3>}
      <ol className="tl">
        {items.map((it) => (
          <li key={it.time} className="tl-item">
            <span className="tl-dot" aria-hidden />
            <div className="pt-1.5">
              <div className="num text-[22px] text-stage-pink-2">{it.time}</div>
              <div className="t-small mt-1">{it.label}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
