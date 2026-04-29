import WinnerCard from './WinnerCard';
import type { WinnerCategory, WinnerRow } from '../../lib/winners';
import { groupByCategory } from '../../lib/winners';

const ORDER: WinnerCategory[] = ['champion', 'guru', 'oracle', 'thief', 'duelist'];

interface Props { winners: WinnerRow[]; playerNameById: Record<string, string>; }

export default function WinnerGrid({ winners, playerNameById }: Props) {
  const groups = groupByCategory(winners);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 justify-items-center">
      {ORDER.map((cat, i) => {
        const rows = groups[cat];
        if (rows.length === 0) return null;
        const names = rows.map((r) => playerNameById[r.player_id] ?? '?');
        return (
          <WinnerCard
            key={cat}
            category={cat}
            playerNames={names}
            metricValue={Number(rows[0].metric_value)}
            delayMs={i * 250}
          />
        );
      })}
    </div>
  );
}
