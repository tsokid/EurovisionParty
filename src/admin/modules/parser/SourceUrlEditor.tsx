// src/admin/modules/parser/SourceUrlEditor.tsx
// Saved-URL chip + edit form. Two visual states:
//
//   1. Saved: shows "Source URL" label, the URL as a read-only mono-text
//      pill, and a Remove button that clears the value (next save commits).
//   2. Editing (no saved value, or after Remove): input + Save button.
//
// Only the super-admin RPC enforces auth; the UI is a thin shell.

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
  // Local "editing" mode: when the user clicks Remove we drop into edit
  // state without immediately wiping the saved value (saves only on Save).
  const [editing, setEditing] = useState(!currentUrl);
  const [value, setValue] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState<"save" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // When the saved value updates externally (e.g. another tab), reflect it.
  useEffect(() => {
    setValue(currentUrl ?? "");
    setEditing(!currentUrl);
  }, [currentUrl]);

  const dirty = value.trim() !== (currentUrl ?? "").trim();

  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      const { error } = await supabase.rpc("set_parse_job_url", {
        p_year: year,
        p_kind: kind,
        p_url: value.trim(),
      });
      if (error) throw error;
      setMsg({ kind: "ok", text: "Saved." });
      setEditing(false);
      onSaved();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  // Display state — show the saved URL as a pill with a Remove button
  if (!editing && currentUrl) {
    return (
      <div className="mb-3 pb-3 border-b border-white/5">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
          Source URL · saved
        </label>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 min-w-0 truncate bg-emerald-500/10 border border-emerald-400/30 rounded px-2.5 py-1.5 text-xs text-emerald-200 font-mono"
            title={currentUrl}
          >
            {currentUrl}
          </code>
          <button
            type="button"
            onClick={() => { setEditing(true); setValue(currentUrl); setMsg(null); }}
            className="shrink-0 px-2.5 py-1.5 rounded bg-white/5 hover:bg-white/15 text-white/70 hover:text-white text-xs font-semibold cursor-pointer"
            aria-label="Edit source URL"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => { setEditing(true); setValue(""); setMsg(null); }}
            className="shrink-0 px-2.5 py-1.5 rounded bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-300 text-xs font-semibold cursor-pointer"
            aria-label="Remove saved URL"
          >
            Remove
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

  // Edit state — input + Save (and a Cancel back to saved if there was one)
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
          disabled={!dirty || busy !== null || !value.trim()}
          className="shrink-0 px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-xs disabled:opacity-40 cursor-pointer"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={() => { setEditing(false); setValue(currentUrl); setMsg(null); }}
            className="shrink-0 px-2.5 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 text-xs cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
      {msg && (
        <p className={`text-[11px] mt-1.5 ${msg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
