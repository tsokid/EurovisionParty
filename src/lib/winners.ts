import { supabase } from './supabase';

export type WinnerCategory = 'champion' | 'thief' | 'duelist' | 'oracle' | 'guru';

export const CATEGORY_META: Record<WinnerCategory, {
  label: string; emojiFallback: string; metricLabel: string; image: string;
}> = {
  champion: { label: 'Champion', emojiFallback: '🏆', metricLabel: 'Most Points',                 image: '/cards/champion.jpg' },
  thief:    { label: 'Thief',    emojiFallback: '🥷', metricLabel: 'Most Points Stolen in Duels', image: '/cards/thief.jpg'    },
  duelist:  { label: 'Duelist',  emojiFallback: '⚔️', metricLabel: 'Most Duels Won',              image: '/cards/duelist.jpg'  },
  oracle:   { label: 'Oracle',   emojiFallback: '🔮', metricLabel: 'Most Predictions Correct',    image: '/cards/oracle.jpg'   },
  guru:     { label: 'Guru',     emojiFallback: '🧠', metricLabel: 'Most Correct Quiz Answers',   image: '/cards/guru.jpg'     },
};

export interface WinnerRow {
  id: string;
  room_id: string;
  category: WinnerCategory;
  player_id: string;
  metric_value: number;
  is_sudden_death_winner: boolean;
}

export async function computeWinners(roomId: string): Promise<number> {
  const { data, error } = await supabase.rpc('compute_winners', { p_room_id: roomId });
  if (error) throw error;
  return data as number;
}

export async function fetchWinners(roomId: string): Promise<WinnerRow[]> {
  const { data, error } = await supabase
    .from('winners').select('*').eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []) as WinnerRow[];
}

export function groupByCategory(rows: WinnerRow[]): Record<WinnerCategory, WinnerRow[]> {
  const out: Record<WinnerCategory, WinnerRow[]> = { champion: [], thief: [], duelist: [], oracle: [], guru: [] };
  for (const r of rows) out[r.category].push(r);
  return out;
}

export function hasTie(group: WinnerRow[]): boolean {
  return group.length >= 2;
}
