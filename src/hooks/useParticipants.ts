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
    // flagcdn.com keyed on iso). Empty string keeps the type happy.
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

export function useParticipants(year?: number): UseParticipants {
  const [participants, setParticipants] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<UseParticipants["source"]>("loading");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSource("loading");
    const query =
      year === undefined
        ? supabase.from("current_participants").select(COLUMNS).order("name_en")
        : supabase
            .from("entries_with_names")
            .select(COLUMNS)
            .eq("year", year)
            .eq("in_final", true)
            .order("name_en");
    query.then(({ data, error }) => {
      if (cancelled) return;
      if (!error && Array.isArray(data) && data.length > 0) {
        setParticipants((data as DbRow[]).map(fromDbRow));
        setSource("db");
      } else if (year === undefined || year === 2026) {
        // Empty or query error — fall back so 2026 flows still work
        // while the parser hasn't published yet.
        setParticipants(COUNTRIES_2026);
        setSource("hardcoded");
      } else {
        // Any other year has no hardcoded lineup.
        setParticipants([]);
        setSource("db");
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [year]);

  const byId = useMemo(
    () => new Map(participants.map((c) => [c.id, c])),
    [participants],
  );

  return { participants, byId, loading, source };
}
