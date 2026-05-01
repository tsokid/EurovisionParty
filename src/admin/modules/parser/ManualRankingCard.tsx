// src/admin/modules/parser/ManualRankingCard.tsx
// Manual override for the Results parser. Toggle ON disables auto-parsing
// (cron + edge function early-return). Admin then drag-drops the 26 grand-
// finalists into ranked slots and fires "Finalize Manual Rankings" — which
// atomically writes the scoreboard and pins the job to 'finalized'. A
// "Reset Rankings" CTA wipes results + un-finalizes for testing iteration.

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { supabase } from "../../../lib/supabase";
import type { ParseJob } from "./useParserState";

interface Props {
  job?: ParseJob;
  onRefresh: () => void;
}

interface Participant {
  iso: string;
  name: string;
  artist: string;
  song: string;
}

// Inline flag image (flagcdn.com w40)
function FlagImg({ iso, size = 22 }: { iso: string; size?: number }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      alt=""
      width={size}
      height={Math.round(size * 0.75)}
      className="rounded-[2px] object-cover shadow-[0_1px_2px_rgba(0,0,0,0.4)] flex-shrink-0"
      style={{ width: size, height: Math.round(size * 0.75) }}
      loading="lazy"
    />
  );
}

// ─── Ranked slot row (sortable within the right column) ─────────────────────
function SortableRankedRow({
  rank,
  participant,
  onRemove,
}: {
  rank: number;
  participant: Participant;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: participant.iso });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={clsx(
        "group flex items-center gap-2 px-2 py-1.5 rounded border border-white/10 bg-white/5 cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-30",
      )}
    >
      <span className="font-bold text-euro-pink-light text-sm w-7 text-right tabular-nums">
        {rank}
      </span>
      <FlagImg iso={participant.iso} />
      <span className="text-xs text-white flex-1 truncate font-medium">
        {participant.name}
      </span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-white/50 hover:bg-red-400/30 hover:text-white text-xs"
        aria-label={`Remove from rank ${rank}`}
      >
        ×
      </button>
    </div>
  );
}

// ─── Unranked tile (clickable to add to next available slot) ─────────────────
function UnrankedTile({
  participant,
  onClick,
}: {
  participant: Participant;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1.5 rounded border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 transition cursor-pointer text-left"
    >
      <FlagImg iso={participant.iso} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white font-medium truncate">{participant.name}</div>
        <div className="text-[10px] text-white/50 truncate italic">{participant.song}</div>
      </div>
    </button>
  );
}

export function ManualRankingCard({ job, onRefresh }: Props) {
  const overrideOn = job?.manual_override === true;
  const finalized = job?.status === "finalized";

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [ranked, setRanked] = useState<string[]>([]); // ordered ISO codes (rank = index+1)
  const [busy, setBusy] = useState<"toggle" | "finalize" | "reset" | null>(null);
  const [confirm, setConfirm] = useState<"finalize" | "reset" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Load participants whenever override turns on. Table is currently
  // year-namespaced (eurovision_2026_participants) — keep that for now since
  // schema is hardcoded; UI copy is the only thing being de-yeared in this
  // pass.
  useEffect(() => {
    if (!overrideOn) return;
    supabase
      .from("eurovision_2026_participants")
      .select("iso, name, artist, song")
      .order("name")
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        setParticipants((data ?? []) as Participant[]);
      });
  }, [overrideOn]);

  // Persist ranked draft per browser (no DB chatter on every drag).
  // Storage key is per-year so future years don't clash.
  const STORAGE_KEY = `eurovision-manual-rankings-${job?.year ?? "default"}`;
  useEffect(() => {
    if (!overrideOn) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRanked(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [overrideOn]);
  useEffect(() => {
    if (!overrideOn) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ranked)); } catch { /* ignore */ }
  }, [ranked, overrideOn]);

  const unranked = participants.filter((p) => !ranked.includes(p.iso));
  const total = participants.length;
  const allPlaced = ranked.length === total && total > 0;

  // ─── Toggle ────────────────────────────────────────────────────────────────
  const toggle = useCallback(async () => {
    setBusy("toggle"); setErr(null);
    try {
      const { error } = await supabase.rpc("set_manual_override", {
        p_year: job?.year ?? 2026, p_active: !overrideOn,
      });
      if (error) throw error;
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [overrideOn, onRefresh]);

  // ─── Add unranked tile to next available slot ──────────────────────────────
  const addToNextSlot = useCallback((iso: string) => {
    setRanked((prev) => prev.includes(iso) ? prev : [...prev, iso]);
  }, []);

  // ─── Remove from rank ──────────────────────────────────────────────────────
  const removeFromRank = useCallback((iso: string) => {
    setRanked((prev) => prev.filter((x) => x !== iso));
  }, []);

  // ─── Drag-end: reorder within ranked list ──────────────────────────────────
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ranked.indexOf(active.id as string);
    const to = ranked.indexOf(over.id as string);
    if (from !== -1 && to !== -1) {
      setRanked((prev) => arrayMove(prev, from, to));
    }
  }, [ranked]);

  // ─── Finalize ──────────────────────────────────────────────────────────────
  const finalize = useCallback(async () => {
    setBusy("finalize"); setErr(null);
    try {
      const { error } = await supabase.rpc("commit_manual_results", {
        p_year: job?.year ?? 2026, p_isos: ranked,
      });
      if (error) throw error;
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      onRefresh();
      setConfirm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [ranked, onRefresh]);

  // ─── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(async () => {
    setBusy("reset"); setErr(null);
    try {
      const { error } = await supabase.rpc("reset_manual_results", { p_year: job?.year ?? 2026 });
      if (error) throw error;
      setRanked([]);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      onRefresh();
      setConfirm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [onRefresh]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            🔧 Manual Override — Rankings
          </h3>
          <p className="text-xs text-white/50 mt-1 max-w-prose">
            Fallback for live night. When ON, the Results parser is disabled (cron
            + on-demand both skip). Drag-drop the finalists into rank order, then{" "}
            <span className="text-white">Finalize</span> to push the table to every
            room as the final scoreboard.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy !== null || finalized}
          className={clsx(
            "shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition",
            overrideOn
              ? "bg-euro-pink/20 border-euro-pink/50 text-euro-pink-light"
              : "bg-white/5 border-white/15 text-white/60 hover:bg-white/10",
            (busy !== null || finalized) && "opacity-40 cursor-not-allowed",
          )}
          aria-pressed={overrideOn}
        >
          <span
            className={clsx(
              "w-2.5 h-2.5 rounded-full",
              overrideOn ? "bg-euro-pink-light shadow-[0_0_6px_currentColor]" : "bg-white/30",
            )}
            aria-hidden
          />
          {overrideOn ? "ON" : "OFF"}
        </button>
      </div>

      {finalized && (
        <p className="text-xs text-emerald-300 mb-3">
          ✅ Results finalized. Use Reset Rankings to start over (testing) or leave as-is.
        </p>
      )}

      {!overrideOn && !finalized && (
        <p className="text-xs text-white/40">
          Toggle ON to disable auto-parsing and enter rankings manually.
        </p>
      )}

      {overrideOn && (
        <>
          <div className="text-xs text-white/60 mb-3 tabular-nums">
            {ranked.length} / {total || "?"} placed
            {total > 0 && !allPlaced && (
              <span className="ml-2 text-white/40">
                (need all {total} before Finalize is enabled)
              </span>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {/* LEFT: Unranked countries */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                Unranked ({unranked.length})
              </h4>
              <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                {unranked.length === 0 ? (
                  <p className="text-xs text-white/30 italic px-2 py-3">
                    All countries placed.
                  </p>
                ) : (
                  unranked.map((p) => (
                    <UnrankedTile key={p.iso} participant={p} onClick={() => addToNextSlot(p.iso)} />
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Ranked slots (drag-reorderable) */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                Final order ({ranked.length})
              </h4>
              <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                {ranked.length === 0 ? (
                  <p className="text-xs text-white/30 italic px-2 py-3">
                    Click an unranked country (or drag) to add it to rank {ranked.length + 1}.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={(e) => setActiveId(e.active.id as string)}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveId(null)}
                  >
                    <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
                      {ranked.map((iso, i) => {
                        const p = participants.find((x) => x.iso === iso);
                        if (!p) return null;
                        return (
                          <SortableRankedRow
                            key={iso}
                            rank={i + 1}
                            participant={p}
                            onRemove={() => removeFromRank(iso)}
                          />
                        );
                      })}
                    </SortableContext>
                    <DragOverlay>
                      {activeId && (() => {
                        const p = participants.find((x) => x.iso === activeId);
                        if (!p) return null;
                        return (
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-euro-pink/50 bg-euro-deep shadow-xl rotate-1">
                            <span className="font-bold text-euro-pink-light text-sm w-7 text-right tabular-nums">
                              {ranked.indexOf(activeId) + 1}
                            </span>
                            <FlagImg iso={p.iso} />
                            <span className="text-xs text-white font-medium">{p.name}</span>
                          </div>
                        );
                      })()}
                    </DragOverlay>
                  </DndContext>
                )}
              </div>
            </div>
          </div>

          {/* CTAs — Finalize + Reset */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
            {/* Finalize */}
            {confirm !== "finalize" ? (
              <button
                type="button"
                onClick={() => setConfirm("finalize")}
                disabled={!allPlaced || busy !== null || finalized}
                className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
              >
                {finalized ? "Already finalized" : "Finalize Manual Rankings"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={finalize}
                  disabled={busy !== null}
                  className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
                >
                  {busy === "finalize" ? "Finalizing…" : "Yes, push to all rooms"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  disabled={busy !== null}
                  className="px-3 py-1.5 rounded bg-white/10 text-white text-sm"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Reset */}
            {confirm !== "reset" ? (
              <button
                type="button"
                onClick={() => setConfirm("reset")}
                disabled={busy !== null}
                className="ml-auto px-3 py-1.5 rounded bg-white/10 border border-white/15 text-white/80 text-sm font-bold hover:bg-white/15 disabled:opacity-40"
                title="Wipes the scoreboard + un-finalizes the job. For testing."
              >
                Reset Rankings
              </button>
            ) : (
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy !== null}
                  className="px-3 py-1.5 rounded bg-red-500 text-white font-bold text-sm disabled:opacity-40"
                >
                  {busy === "reset" ? "Resetting…" : "Yes, wipe results"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  disabled={busy !== null}
                  className="px-3 py-1.5 rounded bg-white/10 text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {err && <p className="text-xs text-red-300 mt-3">{err}</p>}
    </section>
  );
}
