import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { WinnerCategory } from '../../lib/winners';
import { CATEGORY_META } from '../../lib/winners';

interface Props {
  roomId: string;
  isHost: boolean;
  tiedCategories: WinnerCategory[];
  onResolved: () => void;
}

export default function SuddenDeathPanel({ roomId, isHost, tiedCategories, onResolved }: Props) {
  const [activeRound, setActiveRound] = useState<{ id: string; category: WinnerCategory } | null>(null);

  async function openRound(category: WinnerCategory) {
    const qid = 1 + Math.floor(Math.random() * 200);
    const { data, error } = await supabase.rpc('open_sudden_death',
      { p_room_id: roomId, p_category: category, p_question_id: qid });
    if (error) { console.error(error); return; }
    setActiveRound({ id: data as string, category });
    setTimeout(() => resolve(data as string), 22_000);
  }

  async function resolve(roundId: string) {
    await supabase.rpc('resolve_sudden_death', { p_round_id: roundId });
    setActiveRound(null);
    onResolved();
  }

  if (tiedCategories.length === 0) return null;
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
      <h3 className="font-bold">Tiebreak</h3>
      {tiedCategories.map((cat) => (
        <div key={cat} className="flex items-center justify-between gap-2">
          <span>{CATEGORY_META[cat].emojiFallback} {CATEGORY_META[cat].label} — co-winners</span>
          {isHost && !activeRound && (
            <button
              onClick={() => openRound(cat)}
              className="px-3 py-1 bg-euro-gold text-black rounded font-bold text-sm"
            >
              Sudden death
            </button>
          )}
          {activeRound?.category === cat && <span className="text-euro-gold animate-pulse">Live · 20s</span>}
        </div>
      ))}
      {!isHost && (
        <p className="text-xs text-white/50">Waiting for host to open sudden-death rounds…</p>
      )}
    </div>
  );
}
