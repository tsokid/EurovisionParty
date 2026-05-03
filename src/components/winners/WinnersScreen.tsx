// src/components/winners/WinnersScreen.tsx
// Card-carousel winners screen.
// Slide order: Champion → other categories → Dashboard (final standings).
// Each card is portrait, covers ~90% of mobile screen width.
// Dot indicators + swipe navigation. Tie/sudden-death panels live below the carousel.

import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Search, Crown } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import clsx from 'clsx';
import TieVotePanel from './TieVotePanel';
import SuddenDeathPanel from './SuddenDeathPanel';
import {
  computeWinners, fetchWinners, groupByCategory, hasTie, CATEGORY_META,
} from '../../lib/winners';
import type { WinnerRow, WinnerCategory } from '../../lib/winners';
import { useGameStore } from '../../stores/gameStore';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { avatarGradient, avatarInitial } from '../../lib/avatarUtils';
import { supabase } from '../../lib/supabase';

type ChampionVoteStatus = 'active' | 'accept' | 'sudden_death' | null;

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
  const { t } = useTranslation();
  const [winners, setWinners]   = useState<WinnerRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [search, setSearch]     = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { player: currentPlayer, room } = useGameStore();
  const { players } = useLeaderboard(room?.id);

  const catName     = (cat: WinnerCategory) => t(`winners.cat.${cat}.name`);
  const catSubtitle = (cat: WinnerCategory) => t(`winners.cat.${cat}.subtitle`);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (isHost) await computeWinners(roomId).catch(() => {});
    setWinners(await fetchWinners(roomId));
    setLoading(false);
  }, [roomId, isHost]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Champion tie-vote status (drives SD panel visibility + card blur) ───
  const [championVoteStatus, setChampionVoteStatus] = useState<ChampionVoteStatus>(null);
  useEffect(() => {
    let mounted = true;
    const loadStatus = async () => {
      const { data } = await supabase
        .from('tie_votes')
        .select('status')
        .eq('room_id', roomId)
        .eq('category', 'champion')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setChampionVoteStatus((data?.status as ChampionVoteStatus) ?? null);
    };
    loadStatus();
    const ch = supabase
      .channel(`tie_votes_status:${roomId}:champion`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tie_votes', filter: `room_id=eq.${roomId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') { setChampionVoteStatus(null); return; }
            const row = payload.new as { category?: string; status?: string };
            if (row.category === 'champion' && row.status) {
              setChampionVoteStatus(row.status as ChampionVoteStatus);
            }
          }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [roomId]);

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
  const totalSlides = activeCats.length;

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
                {t('winners.tiebreakRequired')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                {t('winners.matchStillOn')}
              </h2>
              <p className="text-sm text-white/65 mt-1.5 max-w-md mx-auto">
                {t('winners.tiebreakSubtitle', { names: champNames.join(' & ') })}
              </p>
            </div>
            {/* Either the TieVotePanel (no-vote / active vote / accepted)
                OR the SuddenDeathPanel (after the room voted SD). Never
                both — TieVotePanel's "sudden death chosen" reminder is
                redundant once the SD panel takes over the same column. */}
            <div className="bg-[#0d061d]/60 rounded-[22px] m-1">
              {championVoteStatus === 'sudden_death' ? (
                <SuddenDeathPanel
                  roomId={roomId}
                  isHost={isHost}
                  tiedPlayerIds={champions.map((r) => r.player_id)}
                  tiedPlayerNames={Object.fromEntries(
                    champions.map((r) => [r.player_id, playerNameById[r.player_id] ?? '?']),
                  )}
                  onResolved={refresh}
                />
              ) : (
                <TieVotePanel
                  roomId={roomId}
                  isHost={isHost}
                  category="champion"
                  tiedPlayerNames={champNames}
                  onResolved={refresh}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Title ── */}
      <div className="px-4">
        <h2 className="text-[1.75rem] sm:text-3xl font-extrabold text-white leading-[1.1]">
          {t('winners.circleTitle1')}{' '}
          <span className="bg-gradient-to-r from-euro-purple-light to-euro-pink bg-clip-text text-transparent">
            {t('winners.circleTitle2')}
          </span>{' '}
          {t('winners.circleTitle3')}
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
                alt={catName(cat)}
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
                    {t('winners.yourCrown')}
                  </span>
                </div>
              )}

              {/* ── Bottom content ── */}
              <div className="absolute inset-x-0 bottom-0 p-5 z-10">
                {/* Subtitle */}
                <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.2em] mb-3">
                  {catSubtitle(cat)}
                </p>

                {/* Player name(s)
                    Champion + tied + vote unresolved → identity hidden.
                    Champion + tied + vote 'accept' → CO-CHAMPIONS, names shown.
                    Champion + single → normal champion display.
                    Other categories: stacked co-winners as before. */}
                {(() => {
                  const championIdentityHidden =
                    isChamp && catTied && championVoteStatus !== 'accept';
                  if (championIdentityHidden) {
                    return (
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
                    );
                  }
                  return (
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
                  );
                })()}

                {/* Score row */}
                <div className="flex items-end justify-between gap-3">
                  <div>
                    {(() => {
                      const tieUnresolved = isChamp && catTied && championVoteStatus !== 'accept';
                      const acceptedCo    = isChamp && catTied && championVoteStatus === 'accept';
                      if (tieUnresolved) {
                        return (
                          <>
                            <p className="text-3xl font-extrabold text-amber-300 tabular-nums leading-none">
                              {score.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-amber-200/70 mt-1.5 uppercase tracking-widest">
                              {t('winners.tiedAtTop')}
                            </p>
                          </>
                        );
                      }
                      return (
                        <>
                          <p className="text-5xl font-extrabold text-white tabular-nums leading-none">
                            {score.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-white/40 mt-1.5 uppercase tracking-widest">
                            {acceptedCo
                              ? t('winners.coChampions', { defaultValue: 'Co-champions' })
                              : isChamp
                                ? t('winners.totalPts')
                                : t('winners.stat')}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Status badge / crown icon */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {isChamp && catTied && championVoteStatus !== 'accept' ? (
                      <span className="rounded-full bg-amber-400/20 border border-amber-400/50 px-2.5 py-1 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                        {t('winners.tiebreakBadge')}
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

      {/* ── Final Standings — full analysis table ── */}
      <div className="px-4 mt-2">
        <div className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'linear-gradient(160deg,#130826 0%,#0d051a 100%)' }}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/8">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white/40 tracking-[0.2em] uppercase">{t('winners.fullAnalysis')}</p>
                <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{t('winners.finalStandings')}</h3>
              </div>
              <div className="text-right text-[11px] text-white/35 flex-shrink-0">
                <p>{t('winners.playersCount', { count: players.length })}</p>
                <p className="mt-0.5">{t('winners.topAt')} <span className="text-white/70 font-bold tabular-nums">{maxPts.toLocaleString()}</span></p>
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('winners.searchPlayer')}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
              />
            </div>
          </div>

          {/* Table — horizontal scroll on narrow screens so all 6 columns
              stay visible without crushing into unreadable widths. */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '560px', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="text-[10px] font-bold text-white/40 tracking-widest uppercase">
                  <th className="text-left  py-2.5 pl-4 sm:pl-5 pr-2 w-12">{t('winners.col.rank')}</th>
                  <th className="text-left  py-2.5 px-2">{t('winners.col.player')}</th>
                  <th className="text-right py-2.5 px-2 w-20">{t('winners.col.total')}</th>
                  <th className="text-right py-2.5 px-2 w-16">{t('winners.col.quiz')}</th>
                  <th className="text-right py-2.5 px-2 w-16">{t('winners.col.duel')}</th>
                  <th className="text-right py-2.5 px-2 pr-4 sm:pr-5 w-16">{t('winners.col.pred')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => {
                  const isMe   = p.id === currentPlayer?.id;
                  const isTop3 = !search && i < 3 && p.total_points > 0;
                  const medal  = ['🥇', '🥈', '🥉'][i];
                  const duelSign = p.duel_points > 0 ? '+' : '';
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={clsx(
                        'border-t border-white/[0.04]',
                        isMe ? 'bg-euro-purple/12' : 'hover:bg-white/[0.02]',
                      )}
                    >
                      {/* Rank */}
                      <td className="py-3 pl-4 sm:pl-5 pr-2 align-middle">
                        {isTop3 ? (
                          <span className="text-base">{medal}</span>
                        ) : (
                          <span className="text-xs font-bold text-white/40 tabular-nums">{i + 1}</span>
                        )}
                      </td>
                      {/* Player */}
                      <td className="py-3 px-2 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className={clsx(
                            'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs flex-shrink-0',
                            avatarGradient(i),
                          )}>
                            {avatarInitial(p.name)}
                          </div>
                          <span className={clsx(
                            'font-semibold truncate',
                            isMe ? 'text-euro-purple-light' : 'text-white',
                          )}>
                            {p.name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-bold text-euro-purple-light bg-euro-purple/25 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                              {t('winners.you')}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Total */}
                      <td className="py-3 px-2 text-right align-middle">
                        <span className="text-base font-extrabold text-white tabular-nums">
                          {p.total_points.toLocaleString()}
                        </span>
                      </td>
                      {/* Quiz */}
                      <td className="py-3 px-2 text-right align-middle">
                        <span className="text-sm font-semibold text-white/75 tabular-nums">
                          {p.quiz_points.toLocaleString()}
                        </span>
                      </td>
                      {/* Duel (signed balance) */}
                      <td className="py-3 px-2 text-right align-middle">
                        <span className={clsx(
                          'text-sm font-semibold tabular-nums',
                          p.duel_points > 0 ? 'text-emerald-400'
                            : p.duel_points < 0 ? 'text-red-400'
                            : 'text-white/50',
                        )}>
                          {duelSign}{p.duel_points.toLocaleString()}
                        </span>
                      </td>
                      {/* Predictions */}
                      <td className="py-3 px-2 pr-4 sm:pr-5 text-right align-middle">
                        <span className="text-sm font-semibold text-white/75 tabular-nums">
                          {p.pred_points.toLocaleString()}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPlayers.length === 0 && (
              <p className="text-center text-white/30 text-sm py-8">{t('winners.noPlayer')}</p>
            )}
          </div>

          {/* Legend */}
          <div className="px-4 sm:px-5 py-3 border-t border-white/8 text-[10px] text-white/35 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <Trans
                i18nKey="winners.legend.total"
                components={{ b: <span className="text-white/55 font-semibold" /> }}
              />
            </span>
            <span>
              <Trans
                i18nKey="winners.legend.duel"
                components={{ b: <span className="text-white/55 font-semibold" /> }}
              />
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
