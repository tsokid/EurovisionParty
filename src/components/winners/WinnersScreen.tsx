import { useEffect, useState, useCallback } from 'react';
import WinnerGrid from './WinnerGrid';
import SuddenDeathPanel from './SuddenDeathPanel';
import { computeWinners, fetchWinners, groupByCategory, hasTie } from '../../lib/winners';
import type { WinnerRow, WinnerCategory } from '../../lib/winners';

interface Props { roomId: string; isHost: boolean; playerNameById: Record<string, string>; }

export default function WinnersScreen({ roomId, isHost, playerNameById }: Props) {
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (isHost) await computeWinners(roomId).catch(() => {});
    setWinners(await fetchWinners(roomId));
    setLoading(false);
  }, [roomId, isHost]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <p className="p-6 text-center text-white/60">Crowning the winners…</p>;
  const groups = groupByCategory(winners);
  const ties: WinnerCategory[] = (Object.keys(groups) as WinnerCategory[]).filter((c) => hasTie(groups[c]));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-euro-gold">Winners</h2>
      <WinnerGrid winners={winners} playerNameById={playerNameById} />
      <SuddenDeathPanel roomId={roomId} isHost={isHost} tiedCategories={ties} onResolved={refresh} />
    </div>
  );
}
