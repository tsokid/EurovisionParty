// src/components/leaderboard/LeaderboardScreen.tsx
//
// Live room leaderboard (boards leaderboard-after-{m,d}, motion map #9/#10,
// prototype motion-leaderboard-d). Rows reorder with FLIP, totals count up,
// ↑N / ↓N chips flash. When you pass someone: a toast «Πέρασες: …» and a
// subtle cold-spark crackle at your position chip (VFX preset `overtake`).
// No titles here: they belong to the end of the game only.
//
// Desktop aside: your card + the activity feed, built only from stored
// point events (src/lib/activityFeed.ts).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Search, TrendingUp, Activity } from 'lucide-react';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { useGameStore } from '../../stores/gameStore';
import { rankOrder, diffRanks } from '../../lib/rankMoves';
import { feedAge, feedRefreshKey, type FeedEvent } from '../../lib/activityFeed';
import { PlayerAvatar, useCountUp } from '../stage';
import { StageVfx, type StageVfxHandle } from '../stage/vfx';
import type { Player } from '../../lib/types';

const COUNT_MS = 600;
const TOAST_MS = 4200;

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

function Total({ value, reduce, className }: { value: number; reduce: boolean; className?: string }) {
  const shown = useCountUp(value, reduce ? 0 : COUNT_MS);
  return <span className={className}>{shown}</span>;
}

/** One feed line: «Douze Points · Trivia +12». Names are stage names. */
export function FeedLine({ e, nameOf }: { e: FeedEvent; nameOf: (id: string | null | undefined) => string }) {
  const { t } = useTranslation();
  let what: string;
  if (e.kind === 'trivia') what = t('board.feed.trivia', { points: e.points });
  else if (e.kind === 'prediction') what = t('board.feed.prediction', { points: e.points });
  else if (e.decision === 'steal') what = t('board.feed.steal', { points: e.points, name: nameOf(e.otherId) });
  else what = t('board.feed.double', { points: e.points });
  return <><b>{nameOf(e.playerId)}</b> · {what}</>;
}

export function FeedTime({ at, now }: { at: string; now: number }) {
  const { t } = useTranslation();
  const a = feedAge(at, now);
  return <time dateTime={at}>{a.unit === 'now' ? t('board.age.now') : t(`board.age.${a.unit}`, { n: a.n })}</time>;
}

export function useNow(everyMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { room, player: me } = useGameStore();
  const { players, isLoading } = useLeaderboard(room?.id);
  const reduce = useReducedMotion() ?? false;
  const [search, setSearch] = useState('');
  const vfx = useRef<StageVfxHandle>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const now = useNow();

  const ranked = useMemo(() => rankOrder(players), [players]);
  const order = ranked.map((p) => p.id);
  const orderKey = order.join('|');
  const nameOf = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? '—';

  const feed = useActivityFeed(room?.id, me?.id, feedRefreshKey(players, me?.id));

  // ── Movement: ↑↓ chips, overtake toast + spark ──
  const prevOrder = useRef<string[] | null>(null);
  const [delta, setDelta] = useState<{ map: Record<string, number>; key: number }>({ map: {}, key: 0 });
  const [toast, setToast] = useState<string[] | null>(null);
  useEffect(() => {
    const before = prevOrder.current;
    prevOrder.current = order;
    if (!before) return;
    const d = diffRanks(before, order, me?.id);
    if (Object.keys(d.delta).length === 0) return;
    setDelta((x) => ({ map: d.delta, key: x.key + 1 }));
    // Spark at most two overtakers (motion budget): you first, then the biggest climber.
    const climbers = Object.entries(d.delta).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const sparkIds = (me && climbers.includes(me.id) ? [me.id, ...climbers.filter((id) => id !== me.id)] : climbers).slice(0, 2);
    const tid = setTimeout(() => {
      for (const id of sparkIds) vfx.current?.fire('overtake', { target: tableRef.current?.querySelector(`[data-rk-chip="${id}"]`) });
    }, reduce ? 0 : 420);
    if (d.overtaken.length > 0) setToast(d.overtaken);
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  if (!room) {
    return <div className="pk-loading" role="status" aria-label={t('common.loading')}><span className="lb-spinner" aria-hidden="true" /></div>;
  }

  const myIdx = me ? order.indexOf(me.id) : -1;
  const mine = myIdx >= 0 ? ranked[myIdx] : null;
  const q = search.trim().toLowerCase();
  const rows = q ? ranked.filter((p) => p.name.toLowerCase().includes(q)) : ranked;
  const anySpent = ranked.some((p) => (p.points_spent ?? 0) > 0);
  const latest = feed[0];

  const gapLine = (p: Player, idx: number) => {
    if (ranked.length < 2) return t('board.rankOf', { rank: idx + 1, total: ranked.length });
    if (idx === 0) {
      const second = ranked[1];
      return t('board.leadBy', { rank: 1, total: ranked.length, points: p.total_points - second.total_points, name: second.name });
    }
    const ahead = ranked[idx - 1];
    return t('board.behind', { rank: idx + 1, total: ranked.length, points: ahead.total_points - p.total_points, name: ahead.name });
  };

  const myCard = mine && (
    <section className="rk-me" aria-label={t('board.yourCard')}>
      <PlayerAvatar name={mine.name} avatarId={mine.avatar_id} size="lg" />
      <div className="rk-me-who">
        <div className="rk-me-name">{mine.name} <span className="t-meta">· {t('lobby.you')}</span></div>
        <div className="t-meta">{gapLine(mine, myIdx)}</div>
      </div>
      <div className="rk-me-pts">
        <Total value={mine.total_points} reduce={reduce} className={clsx('num', myIdx === 0 && 'gold')} />
        <span className="t-meta">{t('board.points')}</span>
      </div>
    </section>
  );

  return (
    <div className="rk">
      <div className="rk-main">
        <header className="rk-head">
          <div className="rk-head-l">
            <span className="chip chip-live"><span className="dot" aria-hidden="true" />{t('board.live')}</span>
            <h1 className="rk-title">{t('board.title')}</h1>
          </div>
          <label className="rk-search">
            <Search aria-hidden="true" strokeWidth={2} />
            <span className="sr-only">{t('board.search')}</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('board.search')} />
          </label>
        </header>

        <div className="rk-only-m">{myCard}</div>

        {latest && (
          <div className="rk-tick rk-only-d" role="status" aria-live="polite">
            <span className="t-eyebrow">{t('board.lastMove')}</span>
            <span className="rk-tick-sep" aria-hidden="true" />
            <PlayerAvatar name={nameOf(latest.playerId)} avatarId={players.find((p) => p.id === latest.playerId)?.avatar_id} size="sm" interactive={false} />
            <motion.span key={latest.id} className="rk-tick-what" initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}>
              <FeedLine e={latest} nameOf={nameOf} />
            </motion.span>
            <span className="num rk-tick-pts">+{latest.points}</span>
          </div>
        )}

        {isLoading && players.length === 0 ? (
          <div className="pk-loading" role="status" aria-label={t('common.loading')}><span className="lb-spinner" aria-hidden="true" /></div>
        ) : players.length === 0 ? (
          <section className="card rk-empty"><p className="t-small">{t('board.empty')}</p></section>
        ) : (
          <div className="rk-table" ref={tableRef}>
            <StageVfx ref={vfx} layers="front" />
            <div className="rk-cols rk-thead t-eyebrow rk-only-d" aria-hidden="true">
              <span>#</span><span>{t('board.col.player')}</span><span className="r">{t('board.col.quiz')}</span><span className="r">{t('board.col.duel')}</span><span className="r">{t('board.col.pred')}</span><span className="c">{t('board.col.move')}</span><span className="r">{t('board.col.total')}</span>
            </div>
            <ol className="rk-list" aria-label={t('board.title')}>
              {rows.map((p) => {
                const idx = order.indexOf(p.id);
                const isMe = p.id === me?.id;
                const d = delta.map[p.id] ?? 0;
                const spent = p.points_spent ?? 0;
                return (
                  <motion.li
                    key={p.id}
                    layout={reduce ? false : 'position'}
                    transition={{ layout: { duration: 0.6, ease: [0.3, 1.12, 0.4, 1] } }}
                    className={clsx('rk-row rk-cols', isMe && 'me')}
                  >
                    <span className={clsx('num rk-pos', idx < 3 && `p${idx + 1}`)}>{idx + 1}</span>
                    <span className="rk-who">
                      <PlayerAvatar name={p.name} avatarId={p.avatar_id} size="md" />
                      <span className="rk-name">
                        <span className="rk-name-t">{p.name}{isMe && <span className="t-meta"> · {t('lobby.you')}</span>}</span>
                        <span className="t-meta rk-sub rk-only-m">
                          {t('board.sub', { quiz: p.quiz_points, duel: signed(p.duel_points), pred: p.pred_points })}
                          {spent > 0 && ` · ${t('board.spent', { points: spent })}`}
                        </span>
                      </span>
                    </span>
                    <span className="num r rk-only-d rk-cell">{p.quiz_points}</span>
                    <span className={clsx('num r rk-only-d rk-cell', p.duel_points > 0 && 'pos', p.duel_points < 0 && 'neg')}>{signed(p.duel_points)}</span>
                    <span className="num r rk-only-d rk-cell">{p.pred_points}</span>
                    <span className="c rk-chip-slot" data-rk-chip={p.id}>
                      {d !== 0 && (
                        <motion.span
                          key={`${delta.key}-${p.id}`}
                          className={clsx('rk-mv', d > 0 ? 'up' : 'down')}
                          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                          animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 1, 0.5, 1, 1], scale: [0.4, 1.3, 0.95, 0.95, 1.05, 1] }}
                          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: 'easeOut' }}
                          aria-label={t(d > 0 ? 'roundEnd.up' : 'roundEnd.down', { n: Math.abs(d) })}
                        >
                          {d > 0 ? `↑${d}` : `↓${-d}`}
                        </motion.span>
                      )}
                    </span>
                    <Total value={p.total_points} reduce={reduce} className="num r rk-total" />
                  </motion.li>
                );
              })}
            </ol>
            {rows.length === 0 && <p className="t-meta rk-nomatch">{t('board.noMatch')}</p>}
          </div>
        )}

        <p className="t-meta rk-foot">{t('board.footer')}{anySpent ? ` ${t('board.footerSpent')}` : ''}</p>

        <motion.div
          className="qz-toast rk-toast"
          role="status"
          initial={false}
          animate={reduce ? { opacity: toast ? 1 : 0 } : { opacity: toast ? 1 : 0, y: toast ? 0 : 40 }}
          transition={{ duration: reduce ? 0.2 : 0.34 }}
          aria-hidden={!toast}
        >
          <span className="qz-toast-ico"><TrendingUp aria-hidden="true" strokeWidth={2.6} /></span>
          {toast ? t('roundEnd.passed', { names: toast.map((id) => nameOf(id)).join(', ') }) : ''}
        </motion.div>
      </div>

      <aside className="rk-aside" aria-label={t('board.feedTitle')}>
        {myCard}
        <section className="rk-feed">
          <h2 className="t-eyebrow rk-feed-h">{t('board.feedTitle')} <span className="chip rk-new">{t('board.feedNew')}</span></h2>
          <p className="t-meta">{t('board.feedSub')}</p>
          {feed.length === 0 ? (
            <p className="t-meta rk-feed-empty"><Activity aria-hidden="true" strokeWidth={2} />{t('board.feedEmpty')}</p>
          ) : (
            <ol className="rk-feed-list">
              {feed.slice(0, 12).map((e, i) => (
                <motion.li
                  key={e.id}
                  className={clsx('rk-item', i === 0 && 'fresh')}
                  layout={reduce ? false : 'position'}
                  initial={reduce ? false : { opacity: 0, y: -26 }}
                  animate={{ opacity: i < 8 ? 1 : 0.45, y: 0 }}
                  transition={{ duration: reduce ? 0.2 : 0.38, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <PlayerAvatar name={nameOf(e.playerId)} avatarId={players.find((p) => p.id === e.playerId)?.avatar_id} size="sm" />
                  <span className="rk-item-t"><FeedLine e={e} nameOf={nameOf} /></span>
                  <FeedTime at={e.at} now={now} />
                </motion.li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
