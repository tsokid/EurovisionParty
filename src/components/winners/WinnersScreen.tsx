// src/components/winners/WinnersScreen.tsx
// Card-carousel winners screen.
// Slide order: Champion → other categories → Dashboard (final standings).
// Each card is portrait, covers ~90% of mobile screen width.
// Dot indicators + swipe navigation. Tie/sudden-death panels live below the carousel.

import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Search, Crown } from 'lucide-react';
import clsx from 'clsx';
import TieVotePanel from './TieVotePanel';
import {
  computeWinners, fetchWinners, groupByCategory, hasTie, CATEGORY_META,
} from '../../lib/winners';
import type { WinnerRow, WinnerCategory } from '../../lib/winners';
import { useGameStore } from '../../stores/gameStore';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { avatarGradient, avatarInitial } from '../../lib/avatarUtils';

const CAT_DISPLAY: Record<WinnerCategory, { name: string; subtitle: string }> = {
  champion: { name: 'Champion',    subtitle: 'Most Points' },
  duelist:  { name: 'The Duelist', subtitle: 'Most Duels Won' },
  thief:    { name: 'Thief',       subtitle: 'Most Points Stolen' },
  guru:     { name: 'Guru',        subtitle: 'Most Quiz Answers' },
  oracle:   { name: 'The Oracle',  subtitle: 'Most Predictions' },
};

const CARD_ORDER: WinnerCategory[] = ['champion', 'duelist', 'thief', 'guru', 'oracle'];

// Carousel card geometry (shared by category cards and dashboard card)
const CARD_STYLE: CSSProperties = {
  width: 'calc(100vw - 40px)',
  maxWidth: '360px',
  // Tall portrait — fills most of the phone screen vertically
  height: 'clamp(440px, 72svh, 600px)',
  scrollSnapAlign: 'start',
  flexShrink: 0,
};

interface Props {
  roomId: string;
  isHost: boolean;
  playerNameById: Record<string, string>;
}

export default function WinnersScreen({ roomId, isHost, playerNameById }: Props) {
  const [winners, setWinners]   = useState<WinnerRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [search, setSearch]     = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { player: currentPlayer, room } = useGameStore();
  const { players } = useLeaderboard(room?.id);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (isHost) await computeWinners(roomId).catch(() => {});
    setWinners(await fetchWinners(roomId));
    setLoading(false);
  }, [roomId, isHost]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Scroll tracking ──────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>('[data-card]');
    const mid = el.scrollLeft + el.clientWidth / 2;
    let closest = 0, minD = Infinity;
    cards.forEach((card, i) => {
      const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
      if (d < minD) { minD = d; closest = i; }
    });
    setActiveIdx(closest);
  }, []);

  const scrollToCard = useCallback((i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>('[data-card]');
    if (cards[i]) {
      // Scroll so the card's left edge aligns with the carousel's paddingLeft
      el.scrollTo({ left: cards[i].offsetLeft - 16, behavior: 'smooth' });
    }
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="w-8 h-8 border-[3px] border-white/20 border-t-euro-gold rounded-full"
        />
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const groups     = groupByCategory(winners);
  const champions  = groups.champion;
  const isTied     = hasTie(champions);
  const champNames = champions.map((r) => playerNameById[r.player_id] ?? '?');

  const myWinCats: WinnerCategory[] = currentPlayer
    ? CARD_ORDER.filter((c) => groups[c].some((r) => r.player_id === currentPlayer.id))
    : [];

  // Only show categories that have at least one winner
  const activeCats = CARD_ORDER.filter((c) => groups[c].length > 0);
  const totalSlides = activeCats.length + 1; // +1 for Dashboard

  const maxPts = players[0]?.total_points || 1;
  const filteredPlayers = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">

      {/* ── PROMINENT TIE BANNER (champion only) — hoisted above everything
              so the host can act and players can vote without scrolling. ── */}
      {isTied && (
        <div className="px-4">
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 22 }}
            className="rounded-3xl border-2 border-amber-400/50 p-1 shadow-[0_0_60px_rgba(251,191,36,0.25)]"
            style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(236,72,153,0.10))' }}
          >
            {/* Headline strip */}
            <div className="px-4 sm:px-5 pt-4 pb-3 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/50 px-3 py-1 text-[10px] sm:text-[11px] font-bold text-amber-300 tracking-[0.18em] uppercase mb-3">
                ⚔ Tiebreak required
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                The match is still on.
              </h2>
              <p className="text-sm text-white/65 mt-1.5 max-w-md mx-auto">
                {champNames.join(' & ')} are tied at the top — the room decides what happens next.
              </p>
            </div>
            {/* Vote panel — full-bleed inside the banner */}
            <div className="bg-[#0d061d]/60 rounded-[22px] m-1">
              <TieVotePanel
                roomId={roomId}
                isHost={isHost}
                category="champion"
                tiedPlayerNames={champNames}
                onResolved={refresh}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Title ── */}
      <div className="px-4">
        <h2 className="text-[1.75rem] sm:text-3xl font-extrabold text-white leading-[1.1]">
          The{' '}
          <span className="bg-gradient-to-r from-euro-purple-light to-euro-pink bg-clip-text text-transparent">
            winners&apos;
          </span>{' '}
          circle.
        </h2>
      </div>

      {/* ── Carousel ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto"
        style={{
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingLeft: '16px',
        } as CSSProperties}
      >
        {/* ── Category cards ── */}
        {activeCats.map((cat, slideIdx) => {
          const rows    = groups[cat];
          const meta    = CATEGORY_META[cat];
          const display = CAT_DISPLAY[cat];
          const names   = rows.map((r) => playerNameById[r.player_id] ?? '?');
          const score   = rows[0] ? Number(rows[0].metric_value) : 0;
          const catTied = hasTie(rows);
          const isMyCat = myWinCats.includes(cat);
          const isChamp = cat === 'champion';

          return (
            <motion.div
              key={cat}
              data-card
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 22, delay: slideIdx * 0.07 }}
              className="relative rounded-3xl overflow-hidden"
              style={CARD_STYLE}
            >
              {/* Background image */}
              <img
                src={meta.image}
                alt={display.name}
                className="absolute inset-0 w-full h-full object-cover select-none"
                draggable={false}
              />

              {/* Gradient overlay — light at top, heavy at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />

              {/* ── Top badges ── (category name omitted — already on the card art) */}
              {isMyCat && (
                <div className="absolute top-4 right-4 z-10">
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-bold text-white tracking-[0.14em] uppercase backdrop-blur-sm"
                    style={{ background: 'linear-gradient(90deg,#be185d,#7c3aed)' }}
                  >
                    ★ Your Crown
                  </span>
                </div>
              )}

              {/* ── Bottom content ── */}
              <div className="absolute inset-x-0 bottom-0 p-5 z-10">
                {/* Subtitle */}
                <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.2em] mb-3">
                  {display.subtitle}
                </p>

                {/* Player name(s)
                    Champion + tied → identity is concealed until the tiebreak
                    resolves. We don't reveal who the champion is yet. */}
                {isChamp && catTied ? (
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center text-white/60 font-bold text-base flex-shrink-0">
                      ?
                    </div>
                    <span
                      className="text-[1.3rem] font-extrabold text-white/85 leading-tight truncate"
                      style={{ filter: 'blur(6px)', userSelect: 'none' }}
                      aria-label="Champion identity hidden until tiebreak resolves"
                    >
                      {names.join(' & ') || 'Hidden Player'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {names.slice(0, 3).map((name, ni) => (
                      <div key={name + ni} className="flex items-center gap-2.5">
                        <div className={clsx(
                          'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                          avatarGradient(ni),
                        )}>
                          {avatarInitial(name)}
                        </div>
                        <span className="text-[1.3rem] font-extrabold text-white leading-tight truncate">
                          {name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Score row */}
                <div className="flex items-end justify-between gap-3">
                  <div>
                    {isChamp && catTied ? (
                      <>
                        <p className="text-3xl font-extrabold text-amber-300 tabular-nums leading-none">
                          {score.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-amber-200/70 mt-1.5 uppercase tracking-widest">
                          Tied at top
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-5xl font-extrabold text-white tabular-nums leading-none">
                          {score.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-white/40 mt-1.5 uppercase tracking-widest">
                          {isChamp ? 'Total pts' : 'stat'}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Status badge / crown icon
                      Only Champion uses the tiebreak/vote flow. Other
                      categories that end with multiple top-scorers just
                      become co-winners — no extra badge needed since the
                      stacked names already communicate it. */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {isChamp && catTied ? (
                      <span className="rounded-full bg-amber-400/20 border border-amber-400/50 px-2.5 py-1 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                        ⚔ Tiebreak
                      </span>
                    ) : isChamp ? (
                      <div className="w-11 h-11 rounded-full bg-euro-gold/20 border border-euro-gold/40 flex items-center justify-center">
                        <Crown className="w-5 h-5 text-euro-gold" strokeWidth={2} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* ── Dashboard card — Final Standings ── */}
        <div
          data-card
          className="rounded-3xl border border-white/10 overflow-hidden flex flex-col"
          style={{
            ...CARD_STYLE,
            background: 'linear-gradient(160deg,#130826 0%,#0d051a 100%)',
          }}
        >
          <div className="p-5 flex flex-col h-full">
            {/* Header */}
            <div className="mb-4">
              <p className="text-lg font-extrabold text-white">Final Standings</p>
              <p className="text-xs text-white/35 mt-0.5">The show is over — here&apos;s where everyone landed.</p>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search player…"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
              />
            </div>

            {/* Player list */}
            <div
              className="flex-1 overflow-y-auto space-y-1.5 pr-0.5"
              style={{ scrollbarWidth: 'none' } as CSSProperties}
            >
              {filteredPlayers.map((p, i) => {
                const isMe = p.id === currentPlayer?.id;
                const pct  = Math.round((p.total_points / maxPts) * 100);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={clsx(
                      'rounded-xl px-3 py-2.5',
                      isMe
                        ? 'bg-euro-purple/15 border border-euro-purple/30'
                        : 'bg-white/[0.04]',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-center text-[11px] font-bold text-white/35 tabular-nums flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className={clsx(
                        'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                        avatarGradient(i),
                      )}>
                        {avatarInitial(p.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={clsx(
                            'text-sm font-semibold truncate',
                            isMe ? 'text-euro-purple-light' : 'text-white',
                          )}>
                            {p.name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-bold text-euro-purple-light bg-euro-purple/25 rounded-full px-1.5 py-0.5 flex-shrink-0 leading-none">
                              you
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 h-[2px] rounded-full bg-white/10 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, delay: i * 0.02, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                      <span className="text-base font-extrabold text-white tabular-nums flex-shrink-0">
                        {p.total_points.toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              {filteredPlayers.length === 0 && (
                <p className="text-center text-white/30 text-sm py-6">No player found</p>
              )}
            </div>
          </div>
        </div>

        {/* Right spacer — gives the last card right padding on snap */}
        <div style={{ width: '16px', flexShrink: 0 }} />
      </div>

      {/* ── Dot indicators ── */}
      {totalSlides > 1 && (
        <div className="flex justify-center items-center gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToCard(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={clsx(
                'rounded-full transition-all duration-300 focus:outline-none',
                i === activeIdx
                  ? 'w-5 h-[5px] bg-white'
                  : 'w-[5px] h-[5px] bg-white/30 hover:bg-white/55',
              )}
            />
          ))}
        </div>
      )}

    </div>
  );
}
