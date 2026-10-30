// src/admin/modules/parser/ParseSemisButton.tsx
// "Parse semifinals" for one contest year, shown in the Contests entries
// editor for current and finalized years. Calls the eurovision-parse edge
// function (action 'semis'), which fetches both semi-final pages and writes
// the semi columns of contest_entries.
//
// eurovision.com is behind Cloudflare and may refuse the server-side fetch.
// When the call fails, two textareas let the admin paste each page's HTML
// (View Source in a browser, copy everything); the second button resends
// with html_sf1 / html_sf2, and the edge function parses those instead.

import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatError } from '../../lib/formatError';

interface Props {
  year: number;
  /** Called after a successful parse, so the entries can reload. */
  onParsed: () => void;
}

interface SemisResponse {
  ok?: boolean;
  rows?: number;
  error?: string;
}

const AREA = 'w-full h-24 bg-[#1a0a2e] border border-white/15 text-white rounded px-2 py-1 text-xs font-mono';

/** The edge function's own { error } message when the invoke failed with a response body. */
async function withBody(error: unknown): Promise<unknown> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as SemisResponse | null;
      if (body && typeof body.error === 'string') return new Error(body.error);
    } catch {
      /* not json: keep the original error */
    }
  }
  return error;
}

export function ParseSemisButton({ year, onParsed }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [sf1, setSf1] = useState('');
  const [sf2, setSf2] = useState('');

  const send = async (pasted: boolean) => {
    const what = pasted ? 'the pasted semi-final pages' : 'both semi-final pages from eurovision.com';
    if (!window.confirm(`Parse ${what} into ${year}? Semi data (running order, place, points, qualified) is overwritten.`)) {
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const body: Record<string, unknown> = { action: 'semis', year };
      if (pasted) {
        if (sf1.trim()) body.html_sf1 = sf1;
        if (sf2.trim()) body.html_sf2 = sf2;
      }
      const { data, error } = await supabase.functions.invoke('eurovision-parse', { body });
      if (error) throw await withBody(error);
      const res = (data ?? {}) as SemisResponse;
      if (res.ok === false) throw new Error(res.error ?? 'semi-final parse failed');
      setNotice(`Semi-finals parsed: ${res.rows ?? 0} entries written.`);
      setShowPaste(false);
      setSf1('');
      setSf2('');
      onParsed();
    } catch (e) {
      setErr(formatError(e));
      setShowPaste(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="basis-full space-y-2">
      <button
        type="button"
        onClick={() => send(false)}
        disabled={busy}
        className="px-3 py-1.5 rounded bg-sky-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
      >
        {busy ? 'Parsing…' : 'Parse semifinals'}
      </button>
      {notice && <p className="text-sm text-emerald-300">{notice}</p>}
      {err && <p className="text-sm text-red-300">{err}</p>}
      {showPaste && (
        <div className="space-y-2 rounded-lg border border-white/10 p-3">
          <p className="text-xs text-white/60">
            eurovision.com may block the server. Open each semi-final page in your browser, use View Source,
            select everything and paste it below. Leave a box empty to skip that semi-final.
          </p>
          <label className="block text-xs text-white/70">
            Paste page HTML for semi-final 1
            <textarea value={sf1} onChange={(e) => setSf1(e.target.value)} className={AREA} />
          </label>
          <label className="block text-xs text-white/70">
            Paste page HTML for semi-final 2
            <textarea value={sf2} onChange={(e) => setSf2(e.target.value)} className={AREA} />
          </label>
          <button
            type="button"
            onClick={() => send(true)}
            disabled={busy || (!sf1.trim() && !sf2.trim())}
            className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          >
            Parse pasted HTML
          </button>
        </div>
      )}
    </div>
  );
}
