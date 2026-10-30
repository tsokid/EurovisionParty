// src/hooks/useParticipants.ts
// Loads the live-year grand-final lineup from the current_participants
// view (contest_entries filtered to the live year + finalists). Falls
// back to the hardcoded COUNTRIES_2026 constant only if the view is
// empty or errors (e.g. fresh DB before the participants parser runs).
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

export function useParticipants(): UseParticipants {
  const [participants, setParticipants] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<UseParticipants["source"]>("loading");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("current_participants")
      .select("iso, name_en, name_el, artist, song, final_running_order")
      .order("name_en")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          setParticipants((data as DbRow[]).map(fromDbRow));
          setSource("db");
        } else {
          // Empty table or query error — fall back so 2026 flows still work
          // while the parser hasn't published yet.
          setParticipants(COUNTRIES_2026);
          setSource("hardcoded");
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const byId = useMemo(
    () => new Map(participants.map((c) => [c.id, c])),
    [participants],
  );

  return { participants, byId, loading, source };
}
