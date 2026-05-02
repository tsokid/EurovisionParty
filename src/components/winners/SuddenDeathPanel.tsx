import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { WinnerCategory } from '../../lib/winners';
import { CATEGORY_META } from '../../lib/winners';

interface Question {
  id: number;
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
}

interface Props {
  roomId: string;
  isHost: boolean;
  tiedCategories: WinnerCategory[];
  onResolved: () => void;
}

export default function SuddenDeathPanel({ roomId, isHost, tiedCategories, onResolved }: Props) {
  const [activeRound, setActiveRound] = useState<{ id: string; category: WinnerCategory; qNum: number } | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);

  useEffect(() => {
    if (!activeRound) return;
    setTimeLeft(20);
    const tick = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    const done = setTimeout(() => { resolve(activeRound.id); clearInterval(tick); }, 22_000);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, [activeRound?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openRound(category: WinnerCategory, qNum = 1) {
    const qid = 1 + Math.floor(Math.random() * 200);
    const { data: rData, error: rErr } = await supabase.rpc('open_sudden_death',
      { p_room_id: roomId, p_category: category, p_question_id: qid });
    if (rErr) { console.error(rErr); return; }

    // Fetch question details
    const { data: qData } = await supabase.from('quiz_questions').select('*').eq('id', qid).single();
    setQuestion(qData as Question | null);
    setSelected(null);
    setActiveRound({ id: rData as string, category, qNum });
  }

  async function resolve(roundId: string) {
    await supabase.rpc('resolve_sudden_death', { p_round_id: roundId });
    setActiveRound(null);
    setQuestion(null);
    onResolved();
  }

  if (tiedCategories.length === 0) return null;

  return (
    <div className="space-y-4">
      {tiedCategories.map((cat) => {
        const meta = CATEGORY_META[cat];
        const isActive = activeRound?.category === cat;

        if (isActive && question) {
          const options = [question.answer_a, question.answer_b, question.answer_c, question.answer_d].filter(Boolean);
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-euro-pink/30 bg-[#1a0a2e]/80 p-4 sm:p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-euro-pink/20 border border-euro-pink/40 px-2.5 py-1 text-[11px] font-bold text-euro-pink tracking-widest uppercase">
                    ⚔ Sudden Death · Q{activeRound.qNum}/3
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <span className="font-semibold text-white/70 tabular-nums">{timeLeft}s</span>
                </div>
              </div>

              {/* Question */}
              <p className="text-base sm:text-lg font-bold text-white mb-4">{question.question}</p>

              {/* Answer grid */}
              <div className="grid grid-cols-2 gap-2">
                {options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelected(opt)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium text-left transition-all ${
                      selected === opt
                        ? 'border-euro-purple/60 bg-euro-purple/25 text-white'
                        : 'border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </motion.div>
          );
        }

        return (
          <div key={cat} className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">{meta.emojiFallback} {meta.label} tiebreak</p>
              <p className="text-xs text-white/45 mt-0.5">Co-winners — sudden death decides it</p>
            </div>
            {isHost && !activeRound && (
              <button
                type="button"
                onClick={() => openRound(cat)}
                className="flex-shrink-0 px-4 py-2 rounded-full bg-euro-pink text-white font-bold text-sm"
              >
                ⚔ Start
              </button>
            )}
            {isActive && !question && (
              <span className="text-euro-gold animate-pulse text-sm font-semibold">Loading…</span>
            )}
            {!isHost && !isActive && (
              <span className="text-xs text-white/35">Waiting for host…</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
