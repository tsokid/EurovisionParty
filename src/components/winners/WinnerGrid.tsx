import { motion } from 'framer-motion';
import WinnerCard from './WinnerCard';
import type { WinnerCategory, WinnerRow } from '../../lib/winners';
import { groupByCategory } from '../../lib/winners';

const ORDER: WinnerCategory[] = ['champion', 'guru', 'oracle', 'thief', 'duelist'];

interface Props {
  winners: WinnerRow[];
  playerNameById: Record<string, string>;
  /** When provided, the cards are reordered so the current player's
   *  winning card (if any) renders first with a "YOUR CARD" banner. */
  currentPlayerId?: string;
}

export default function WinnerGrid({ winners, playerNameById, currentPlayerId }: Props) {
  const groups = groupByCategory(winners);

  // Categories the current player won (if any). Used to bubble those
  // cards to the front of the grid.
  const myCategories: WinnerCategory[] = currentPlayerId
    ? ORDER.filter((c) => groups[c].some((r) => r.player_id === currentPlayerId))
    : [];

  // Champion is the headline of the night — always first unless the
  // player won something else AND not champion (then their card jumps
  // ahead, with champion right after).
  const isMineFirst = myCategories.length > 0 && !myCategories.includes('champion');
  const order: WinnerCategory[] = isMineFirst
    ? [...myCategories, ...ORDER.filter((c) => !myCategories.includes(c))]
    : ORDER;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 justify-items-center">
      {order.map((cat, i) => {
        const rows = groups[cat];
        if (rows.length === 0) return null;
        const names = rows.map((r) => playerNameById[r.player_id] ?? '?');
        const isMine = currentPlayerId
          ? rows.some((r) => r.player_id === currentPlayerId)
          : false;
        return (
          <motion.div
            key={cat}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}
            className="relative"
          >
            {isMine && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-euro-gold text-black text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full shadow-[0_0_18px_rgba(255,209,102,0.55)]">
                Your card
              </div>
            )}
            <WinnerCard
              category={cat}
              playerNames={names}
              metricValue={Number(rows[0].metric_value)}
              delayMs={i * 250}
              isMine={isMine}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
