// src/hooks/useParticipants.ts
// Loads the active grand-final lineup from the parser-populated table
// (public.eurovision_2026_participants). Falls back to the hardcoded
// COUNTRIES_2026 constant only if the table is empty (e.g. fresh DB
// before the participants parser runs) so existing 2026 flows keep
// working.
//
// Returns the same Country[] shape consumers were getting from the
// hardcoded constant — drop-in replacement for `import { COUNTRIES_2026 }`.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { COUNTRIES_2026 } from "../lib/countries2026";
import type { Country } from "../lib/types";

interface DbRow {
  iso: string;
  name: string;
  artist: string | null;
  song: string | null;
  running_order: number | null;
}

// ISO → Greek country name lookup, derived from the canonical 2026
// constant. Used only when the DB row doesn't carry name_el. Future:
// add name_el column to eurovision_2026_participants so this lookup
// becomes redundant.
const ISO_TO_GREEK: Record<string, string> = Object.fromEntries(
  COUNTRIES_2026.map((c) => [c.id, c.name_el]),
);

function fromDbRow(row: DbRow): Country {
  return {
    id: row.iso,
    name: row.name,
    name_el: ISO_TO_GREEK[row.iso] ?? row.name,
    // Flag emoji isn't used by the redesigned UIs (we render <img> via
    // flagcdn.com keyed on iso). Empty string keeps the type happy.
    flag: "",
    artist: row.artist ?? "",
    song: row.song ?? "",
    language: "",
    semi: "big5" as const,
    runningOrder: row.running_order ?? undefined,
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
      .from("eurovision_2026_participants")
      .select("iso, name, artist, song, running_order")
      .order("name")
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
