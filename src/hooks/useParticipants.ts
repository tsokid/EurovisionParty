// src/hooks/useParticipants.ts
// Loads a grand-final lineup (finalists, in_final).
//   * useParticipants(year) — inside a room, pass room.year: reads
//     entries_with_names for that year, so a room keeps its own year's
//     lineup whatever the live year is. Falls back to the hardcoded
//     COUNTRIES_2026 only when year is 2026 and the query is empty or
//     errors; any other year gets an empty lineup (source 'db').
//   * useParticipants() — no year: the live year's lineup from the
//     current_participants view, with the COUNTRIES_2026 fallback.
//
// Returns the same Country[] shape consumers were getting from the
// hardcoded constant — drop-in replacement for `import { COUNTRIES_2026 }`.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { COUNTRIES_2026 } from "../lib/countries2026";
import type { Country } from "../lib/types";

interface DbRow {
  iso: string;
  name_en: string;
  name_el: string;
  artist: string | null;
  song: string | null;
  final_running_order: number | null;
}

function fromDbRow(row: DbRow): Country {
  return {
    id: row.iso,
    name: row.name_en,
    name_el: row.name_el,
    // Flag emoji isn't used by the redesigned UIs (we render <img> via
    // /flags keyed on iso). Empty string keeps the type happy.
    flag: "",
    artist: row.artist ?? "",
    song: row.song ?? "",
    language: "",
    semi: "big5" as const,
    runningOrder: row.final_running_order ?? undefined,
  };
}

export interface UseParticipants {
  participants: Country[];
  byId: Map<string, Country>;
  loading: boolean;
  source: "db" | "hardcoded" | "loading";
}

const COLUMNS = "iso, name_en, name_el, artist, song, final_running_order";

/**
 * One read per year per page load (F13): the line-up is the same for every
 * player and every screen of the night, so the screens share it instead of
 * each asking the database. An empty or failed read is not kept, so the
 * next screen tries again.
 */
const cache = new Map<number | "live", Promise<DbRow[] | null>>();

function lineup(year: number | undefined): Promise<DbRow[] | null> {
  const key = year ?? "live";
  const hit = cache.get(key);
  if (hit) return hit;
  const query =
    year === undefined
      ? supabase.from("current_participants").select(COLUMNS).order("name_en")
      : supabase
          .from("entries_with_names")
          .select(COLUMNS)
          .eq("year", year)
          .eq("in_final", true)
          .order("name_en");
  const p = Promise.resolve(query).then(
    ({ data, error }) => {
      const rows = !error && Array.isArray(data) && data.length > 0 ? (data as DbRow[]) : null;
      if (!rows) cache.delete(key);
      return rows;
    },
    () => { cache.delete(key); return null; },
  );
  cache.set(key, p);
  return p;
}

/** Tests only. */
export function __resetParticipantsCache(): void { cache.clear(); }

export function useParticipants(year?: number): UseParticipants {
  // The loaded lineup, tagged with the year it was loaded for, so a year
  // change reads as loading until the new lineup arrives.
  const key = year ?? "live";
  const [loaded, setLoaded] = useState<{
    key: number | "live";
    participants: Country[];
    source: "db" | "hardcoded";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void lineup(year).then((rows) => {
      if (cancelled) return;
      const k = year ?? "live";
      if (rows) {
        setLoaded({ key: k, participants: rows.map(fromDbRow), source: "db" });
      } else if (year === undefined || year === 2026) {
        // Empty or query error — fall back so 2026 flows still work
        // while the parser hasn't published yet.
        setLoaded({ key: k, participants: COUNTRIES_2026, source: "hardcoded" });
      } else {
        // Any other year has no hardcoded lineup.
        setLoaded({ key: k, participants: [], source: "db" });
      }
    });
    return () => { cancelled = true; };
  }, [year]);

  const ready = loaded !== null && loaded.key === key;
  const participants = useMemo(() => (ready ? loaded.participants : []), [ready, loaded]);
  const byId = useMemo(
    () => new Map(participants.map((c) => [c.id, c])),
    [participants],
  );

  return { participants, byId, loading: !ready, source: ready ? loaded.source : "loading" };
}
