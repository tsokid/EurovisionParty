// src/admin/modules/parser/SourceUrlEditor.tsx
// Small inline form to edit the parse_jobs.source_url for a (year, kind).
// Used inside ParticipantsCard + ResultsCard so admins can repoint the
// parser at next year's grand-final URL without redeploying.

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { JobKind } from "./useParserState";

interface Props {
  year: number;
  kind: JobKind;
  currentUrl: string | null;
  onSaved: () => void;
}

export function SourceUrlEditor({ year, kind, currentUrl, onSaved }: Props) {
  const [value, setValue] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Sync local input when external currentUrl changes (e.g. after refresh)
  useEffect(() => { setValue(currentUrl ?? ""); }, [currentUrl]);

  const dirty = value.trim() !== (currentUrl ?? "").trim();

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.rpc("set_parse_job_url", {
        p_year: year, p_kind: kind, p_url: value.trim(),
      });
      if (error) throw error;
      setMsg({ kind: "ok", text: "Saved." });
      onSaved();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 pb-3 border-b border-white/5">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
        Source URL
      </label>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://www.eurovision.com/..."
          spellCheck={false}
          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-white/30 font-mono"
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy || !value.trim()}
          className="shrink-0 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {msg && (
        <p className={`text-[11px] mt-1.5 ${msg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
