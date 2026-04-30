// src/admin/modules/parser/TestCard.tsx
// Ephemeral parser tester. Hits the edge function with test-* actions, which
// run the same extractors against 2025 (or an override URL) and return rows
// without writing to the DB. Used to verify parser health before the show.

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

const TEST_DEFAULT =
  "https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-grand-final/";

type TestAction = "test-participants-2025" | "test-results-2025";

type Row = Record<string, unknown>;

interface TestResponse {
  url: string;
  source?: string;
  http_status?: number;
  rows: Row[];
  count: number;
  error?: string;
}

export function TestCard() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<TestAction | null>(null);
  const [resp, setResp] = useState<TestResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (action: TestAction) => {
    setBusy(action);
    setErr(null);
    setResp(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "eurovision-parse",
        {
          body: {
            action,
            override_url: url.trim() || undefined,
          },
        },
      );
      if (error) throw error;
      setResp(data as TestResponse);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const rows = resp?.rows ?? [];
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="font-semibold text-white mb-2">Test Parsers (2025)</h3>
      <p className="text-xs text-white/50 mb-3">
        Override URL is optional. If empty, the test hits the Basel 2025 grand
        final. Output is for verification only — nothing is written to the DB.
      </p>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={TEST_DEFAULT}
        className="w-full mb-3 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30"
      />
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => run("test-participants-2025")}
          disabled={busy !== null}
          className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
        >
          {busy === "test-participants-2025" ? "Running…" : "Test Participants"}
        </button>
        <button
          type="button"
          onClick={() => run("test-results-2025")}
          disabled={busy !== null}
          className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
        >
          {busy === "test-results-2025" ? "Running…" : "Test Results"}
        </button>
      </div>
      {err && <p className="text-sm text-red-300 mb-2">{err}</p>}
      {resp && (
        <div className="text-xs text-white/60 mb-2">
          {resp.count} rows
          {resp.source ? ` · source: ${resp.source}` : ""}
          {resp.http_status ? ` · http ${resp.http_status}` : ""}
        </div>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto max-h-96 border border-white/5 rounded">
          <table className="w-full text-xs">
            <thead className="text-white/50 sticky top-0 bg-black/40">
              <tr>
                {headers.map((k) => (
                  <th key={k} className="text-left px-2 py-1">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  {headers.map((k) => (
                    <td key={k} className="px-2 py-1 text-white/80">
                      {String(r[k] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
