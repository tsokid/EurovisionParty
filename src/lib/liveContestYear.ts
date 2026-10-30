import { supabase } from "./supabase";

/** Live contest year from the live_contest_year() RPC. Throws on RPC error. */
export async function fetchLiveContestYear(): Promise<number> {
  const { data, error } = await supabase.rpc("live_contest_year");
  if (error) throw error;
  return Number(data);
}
