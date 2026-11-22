// src/admin/modules/parser/FinalizeCard.tsx
// Terminal action: finalize the contest of the job's year through the
// finalize_contest lifecycle RPC (current -> finalized). It locks the
// results, stops the Results parser, scores every room of that year and
// computes winners. Two-click confirm; cannot be undone.
//
// Game data and public data are separate (migration 081): Finalize changes
// only the game. Once finalized, "Copy to public" (copy_game_to_public)
// copies the game's final line-up and ranking into the public contest data;
// the owner reviews it in Contests and Publishes from there. Nothing here
// publishes.
//
// "Reset Finalized" (reset_manual_results) is refused by the database
// once the contest is finalized or archived, so it is offered only while
// the contest of the job's year is still upcoming or current.

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";
import type { ParseJob } from "./useParserState";
import { t } from "../../i18n";

const F = t.parserUi.finalize;

interface Props {
  job?: ParseJob;
  onRefresh: () => void;
}

export function FinalizeCard({ job, onRefresh }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Confirmation banner after success. finalize_contest returns the number
  // of rooms of the year whose winners it computed.
  const [report, setReport] = useState<{ winners: number } | null>(null);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  // Stage of the job year's contest; null until loaded (or no contest row).
  const [stage, setStage] = useState<string | null>(null);

  const finalized = job?.status === "finalized";
  const year = job?.year;

  useEffect(() => {
    if (year === undefined) return;
    let live = true;
    supabase
      .from("contests")
      .select("stage")
      .eq("year", year)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setStage((data as { stage?: string } | null)?.stage ?? null);
      });
    return () => {
      live = false;
    };
  }, [year, job?.status]);

  const contestLocked = stage === "finalized" || stage === "archived";
  // Unknown stage: keep the reset hidden rather than offer a refused action.
  const canReset = finalized && stage !== null && !contestLocked;

  const resetFinalized = async () => {
    if (!job) return;
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const { error } = await supabase.rpc("reset_manual_results", {
        p_year: job.year,
      });
      if (error) throw error;
      onRefresh();
      setConfirmReset(false);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!job) return;
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const { data, error } = await supabase.rpc("finalize_contest", {
        p_year: job.year,
      });
      if (error) throw error;
      setReport({ winners: typeof data === "number" ? data : 0 });
      setStage("finalized");

      onRefresh();
      setConfirm(false);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  // Copy to public: the game's final line-up and ranking into the public
  // contest data (copy_game_to_public). Nothing is published.
  const copyToPublic = async () => {
    if (!job) return;
    setBusy(true);
    setErr(null);
    setCopied(null);
    try {
      const { data, error } = await supabase.rpc("copy_game_to_public", { p_year: job.year });
      if (error) throw error;
      setCopied(typeof data === "number" ? data : 0);
      setConfirmCopy(false);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-red-400/30 bg-red-500/5 p-4">
      <h3 className="font-semibold text-red-300 mb-2">{F.title}</h3>
      <p className="text-sm text-white/70 mb-3">
        {job ? F.what(job.year) : F.noJob}
      </p>
      <p className="text-xs text-white/50 mb-3">
        {contestLocked && job ? F.locked(job.year) : F.final}
      </p>
      {!confirm ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={!job || finalized || busy}
            className="px-3 py-1.5 rounded bg-red-500 text-white font-bold text-sm disabled:opacity-40"
          >
            {finalized ? F.already : F.button(job?.year ?? "")}
          </button>
          {canReset && !confirmReset && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-white/10 text-amber-300 font-bold text-sm disabled:opacity-40"
              title={F.resetTitle}
            >
              {F.reset}
            </button>
          )}
          {canReset && confirmReset && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-amber-300/80">{F.resetConfirm}</span>
              <button
                type="button"
                onClick={resetFinalized}
                disabled={busy}
                className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40"
              >
                {busy ? F.resetting : F.yesReset}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={busy}
                className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
              >
                {t.parserUi.cancel}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={finalize}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-red-500 text-white font-bold text-sm disabled:opacity-40"
          >
            {busy ? F.finalizing : F.yes(job?.year ?? "")}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
          >
            {t.parserUi.cancel}
          </button>
        </div>
      )}
      {report && (
        <div className="mt-3 rounded bg-emerald-500/10 border border-emerald-400/30 p-3 text-xs sm:text-sm">
          <p className="font-semibold text-emerald-300">{F.done(job?.year ?? "")}</p>
          <p className="mt-1 text-white/75">
            {F.winners(job?.year ?? "")}{" "}
            <span className="text-white font-bold tabular-nums">{report.winners}</span>
          </p>
        </div>
      )}
      {stage === "finalized" && (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
          <h4 className="font-semibold text-emerald-300 text-sm">{F.copyTitle}</h4>
          <p className="text-xs text-white/60 mt-1">
            {F.copyText(job?.year ?? "")}
          </p>
          {!confirmCopy ? (
            <button
              type="button"
              onClick={() => setConfirmCopy(true)}
              disabled={busy}
              className="mt-2 px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
            >
              {F.copy(job?.year ?? "")}
            </button>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-white/80">{F.copyConfirm(job?.year ?? "")}</span>
              <button
                type="button"
                onClick={copyToPublic}
                disabled={busy}
                className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
              >
                {busy ? F.copying : F.yesCopy}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCopy(false)}
                disabled={busy}
                className="px-3 py-1.5 rounded bg-white/10 text-white text-sm disabled:opacity-40"
              >
                {t.parserUi.cancel}
              </button>
            </div>
          )}
          {copied !== null && (
            <p className="text-sm text-emerald-300 mt-2">
              {F.copied(copied)}
            </p>
          )}
        </div>
      )}
      {err && <p className="text-sm text-red-300 mt-2 break-all">{err}</p>}
    </section>
  );
}
