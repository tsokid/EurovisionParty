// src/admin/modules/parser/TestCard.tsx
// Ephemeral parser tester. Hits the edge function with test-* actions, which
// run the same extractors against 2025 (or an override URL) and return rows
// without writing to the DB. Used to verify parser health before the show.
//
// On a successful test, results auto-open in a full-screen modal so admins
// can scan all 26 rows without scrolling a small embedded table. The modal
// is dismissable via Esc / backdrop click / × button.

import { useEffect, useState } from "react";
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
  // Synthetic — set client-side so the modal title can say which test ran
  _action?: TestAction;
}

const COLUMN_ORDER = [
  'iso', 'name', 'ranking', 'artist', 'song',
  'total_points', 'jury_points', 'televote_points',
  'runningOrder', 'source',
];
const COLUMN_LABEL: Record<string, string> = {
  iso: 'ISO',
  name: 'Country',
  ranking: 'Rank',
  artist: 'Artist',
  song: 'Song',
  total_points: 'Total',
  jury_points: 'Jury',
  televote_points: 'Televote',
  runningOrder: 'Running order',
  source: 'Source',
};
const NUMERIC_COLS = new Set(['ranking', 'total_points', 'jury_points', 'televote_points', 'runningOrder']);

function buildHeaders(rows: Row[]): string[] {
  const allKeys = rows[0] ? Object.keys(rows[0]) : [];
  return [
    ...COLUMN_ORDER.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !COLUMN_ORDER.includes(k)),
  ];
}

function FlagImg({ iso }: { iso: string }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      alt=""
      width={28}
      height={21}
      className="rounded-[2px] object-cover shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
      style={{ width: 28, height: 21 }}
      loading="lazy"
    />
  );
}

function ResultsTable({ rows, headers }: { rows: Row[]; headers: string[] }) {
  return (
    <div className="overflow-auto max-h-[70vh] border border-white/5 rounded-lg">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-white/55 sticky top-0 bg-black/60 backdrop-blur z-10">
          <tr>
            {headers.map((k) => (
              <th
                key={k}
                className={`px-3 py-2 font-bold uppercase tracking-wider text-xs ${
                  NUMERIC_COLS.has(k) ? 'text-right' : 'text-left'
                }`}
              >
                {COLUMN_LABEL[k] ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const iso = (r.iso as string | undefined)?.toLowerCase();
            return (
              <tr key={i} className="border-t border-white/5 hover:bg-white/[0.04]">
                {headers.map((k) => {
                  const cellValue = String(r[k] ?? '');
                  // Render flag inline next to the ISO cell
                  if (k === 'iso' && iso) {
                    return (
                      <td key={k} className="px-3 py-2 font-mono text-white/70 text-xs">
                        <span className="inline-flex items-center gap-2">
                          <FlagImg iso={iso} />
                          {cellValue}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={k}
                      className={`px-3 py-2 text-white/85 ${
                        NUMERIC_COLS.has(k) ? 'text-right tabular-nums' : 'text-left'
                      } ${k === 'name' ? 'font-medium text-white' : ''} ${
                        k === 'song' || k === 'source' ? 'italic text-white/65' : ''
                      } ${k === 'source' ? 'text-xs max-w-[260px] truncate' : ''}`}
                      title={k === 'source' ? cellValue : undefined}
                    >
                      {cellValue}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultsModal({
  resp,
  onClose,
}: {
  resp: TestResponse;
  onClose: () => void;
}) {
  const headers = buildHeaders(resp.rows);
  const isResults = resp._action === 'test-results-2025';
  const title = isResults ? 'Results — Final Scoreboard (Basel 2025)' : 'Participants — Grand Final lineup (Basel 2025)';

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-default"
      />

      {/* Panel */}
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-euro-deep shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-white truncate">{title}</h3>
            <p className="text-xs text-white/50 mt-0.5 truncate">
              {resp.count} rows
              {resp.source ? ` · source: ${resp.source}` : ''}
              {resp.http_status ? ` · http ${resp.http_status}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white text-lg flex items-center justify-center transition cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-hidden flex-1">
          {resp.rows.length === 0 ? (
            <p className="text-white/50 text-sm py-8 text-center">
              No rows returned. Either the page markup changed or the URL didn&apos;t hit a populated grand final.
            </p>
          ) : (
            <ResultsTable rows={resp.rows} headers={headers} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 text-xs text-white/40 shrink-0">
          Tip — these rows are NOT written to the database. This is a read-only verification of what the parser would extract on live night.
        </div>
      </div>
    </div>
  );
}

export function TestCard() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<TestAction | null>(null);
  const [resp, setResp] = useState<TestResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
      const next = { ...(data as TestResponse), _action: action };
      setResp(next);
      setModalOpen(true); // auto-open the modal on success
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="font-semibold text-white mb-2">Test Parsers (2025)</h3>
        <p className="text-xs text-white/50 mb-3">
          Override URL is optional. If empty, the test hits the Basel 2025 grand
          final. Output is for verification only — nothing is written to the DB.
          Results auto-open in a full-screen view.
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
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-white text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy === "test-participants-2025" ? "Running…" : "Test Participants"}
          </button>
          <button
            type="button"
            onClick={() => run("test-results-2025")}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-white text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy === "test-results-2025" ? "Running…" : "Test Results"}
          </button>
        </div>
        {err && <p className="text-sm text-red-300 mb-2">{err}</p>}
        {resp && (
          <div className="text-xs text-white/60 mb-2 flex items-center gap-3 flex-wrap">
            <span>
              {resp.count} rows
              {resp.source ? ` · source: ${resp.source}` : ""}
              {resp.http_status ? ` · http ${resp.http_status}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-euro-pink-light hover:text-white underline underline-offset-2 cursor-pointer"
            >
              View full table →
            </button>
          </div>
        )}
      </section>

      {modalOpen && resp && (
        <ResultsModal resp={resp} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
