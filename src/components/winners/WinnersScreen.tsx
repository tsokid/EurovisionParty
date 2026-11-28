// src/components/winners/WinnersScreen.tsx
//
// Final screen (boards final-after-{m,d}). Your final place and the points
// breakdown, the 5 titles of the night (today's compute_winners result),
// the final ranking and — on desktop — your prediction breakdown and the
// activity feed. «Η βραδιά σου» opens your personal reel; «Στην τηλεόραση»
// opens the TV / presentation layout. The champion tie-vote and
// sudden-death panels keep working, restyled.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Clapperboard, Tv, RotateCcw, Activity } from 'lucide-react';
import TieVotePanel from './TieVotePanel';
import SuddenDeathPanel from './SuddenDeathPanel';
import { TitleIcon } from './FinalSequence';
import { REPLAY_FINALE_EVENT } from './FinalCeremony';
import TvPresentation from './TvPresentation';
import PersonalReel, { reelNumbers, signedNum } from '../reel/PersonalReel';
import PredictionsResultsScreen from '../results/PredictionsResultsScreen';
import { FeedLine, FeedTime, useNow } from '../leaderboard/LeaderboardScreen';
import { groupByCategory, hasTie, type WinnerCategory } from '../../lib/winners';
import { TITLE_LIST_ORDER } from '../../lib/titles';
import { rankOrder } from '../../lib/rankMoves';
import { useGameStore } from '../../stores/gameStore';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useWinners } from '../../hooks/useWinners';
import { useChampionVote } from '../../hooks/useChampionVote';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { feedRefreshKey } from '../../lib/activityFeed';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Avatar, PlayerAvatar } from '../stage';
import type { Player } from '../../lib/types';

interface Props {
  roomId: string;
  isHost: boolean;
  playerNameById: Record<string, string>;
}

export default function WinnersScreen({ roomId, isHost, playerNameById }: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const { player: me, room } = useGameStore();
  const { players } = useLeaderboard(room?.id);
  const { rows: winners, loading, refresh } = useWinners(roomId, isHost);
  const championVote = useChampionVote(roomId);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const ranked = rankOrder(players);
  const feed = useActivityFeed(roomId, me?.id, feedRefreshKey(players, me?.id));
  const now = useNow();
  const [reelFor, setReelFor] = useState<Player | null>(null);
  const [tv, setTv] = useState(false);

  if (loading && winners.length === 0) {
    return <div className="pk-loading" role="status" aria-label={t('common.loading')}><span className="lb-spinner" aria-hidden="true" /></div>;
  }

  const groups = groupByCategory(winners);
  const champions = groups.champion;
  const isTied = hasTie(champions);
  const champNames = champions.map((r) => playerNameById[r.player_id] ?? '?');
  const champHidden = isTied && championVote !== 'accept';
  const nameOf = (id: string | null | undefined) => (id && playerNameById[id]) || players.find((p) => p.id === id)?.name || '—';

  const myIdx = me ? ranked.findIndex((p) => p.id === me.id) : -1;
  const mine = myIdx >= 0 ? ranked[myIdx] : null;
  const nums = mine ? reelNumbers(mine) : null;
  const next = myIdx > 0 ? ranked[myIdx - 1] : myIdx === 0 ? ranked[1] : null;

  const stagger = (i: number) => (reduce ? { initial: false as const } : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: i * 0.05 } });

  const titleCard = (cat: WinnerCategory, i: number) => {
    const rows = groups[cat];
    const hidden = cat === 'champion' && champHidden;
    const holders = rows.map((r) => players.find((p) => p.id === r.player_id)).filter((p): p is Player => !!p);
    const metric = rows[0] ? Number(rows[0].metric_value) : 0;
    return (
      <motion.li key={cat} className={clsx('fn-title', `c-${cat}`, rows.some((r) => r.player_id === me?.id) && 'mine')} {...stagger(i)}>
        <span className="fn-ti"><TitleIcon cat={cat} /></span>
        <span className="fn-tt">
          <span className="fn-tname">{t(`winners.cat.${cat}.name`)}</span>
          <span className="t-meta">
            {rows.length === 0 ? t('titles.none') : hidden ? t('finale.tieVote') : `${t(`titles.reason.${cat}`)} · ${t(`titles.metric.${cat}`, { count: metric })}`}
          </span>
        </span>
        {rows.length > 0 && (
          <span className={clsx('fn-twho', hidden && 'hidden')}>
            <span className="fn-tnames">
              {hidden ? '?' : holders.map((p) => (p.id === me?.id ? t('titles.you') : p.name)).join(' & ')}
            </span>
            {!hidden && holders[0] && <PlayerAvatar name={holders[0].name} avatarId={holders[0].avatar_id} size="md" />}
          </span>
        )}
      </motion.li>
    );
  };

  return (
    <div className="fn">
      {isTied && (
        <section className="card-hero fn-tie" aria-labelledby="fn-tie-h">
          <h2 id="fn-tie-h" className="t-h2">{t('winners.matchStillOn')}</h2>
          <p className="t-small">{t('winners.tiebreakSubtitle', { names: champNames.join(' & ') })}</p>
          {championVote === 'sudden_death' ? (
            <SuddenDeathPanel
              roomId={roomId}
              isHost={isHost}
              tiedPlayerIds={champions.map((r) => r.player_id)}
              tiedPlayerNames={Object.fromEntries(champions.map((r) => [r.player_id, playerNameById[r.player_id] ?? '?']))}
              onResolved={refresh}
            />
          ) : (
            <TieVotePanel roomId={roomId} isHost={isHost} category="champion" tiedPlayerNames={champNames} onResolved={refresh} />
          )}
        </section>
      )}

      <div className="fn-cols">
        <div className="fn-main">
          {mine && nums && (
            <section className="card-hero fn-hero" aria-labelledby="fn-hero-h">
              <Avatar name={mine.name} avatarId={mine.avatar_id} size="xl" className="fn-hero-av" />
              <div className="fn-hero-who">
                <span className="t-eyebrow fn-hero-k">{t('final.eyebrow', { year: room?.year ?? '' })}</span>
                <h1 id="fn-hero-h" className="fn-hero-h">
                  {t('final.placeOf', { place: myIdx + 1, count: ranked.length })}
                  <span className="fn-only-d"> · {t('final.points', { points: nums.total })}</span>
                </h1>
                {next && (
                  <span className="t-meta">
                    {myIdx === 0
                      ? t('final.nextBehind', { name: next.name, points: next.total_points })
                      : t('final.nextAhead', { name: next.name, points: next.total_points })}
                  </span>
                )}
              </div>
              <div className="fn-hero-pts fn-only-m"><span className="num">{nums.total}</span><span className="t-meta">{t('board.points')}</span></div>
              <div className="fn-stats">
                <div className="stat"><div className="v num">{nums.trivia}</div><div className="k">{t('reel.trivia')}</div></div>
                <div className="stat"><div className="v num">{signedNum(nums.duels)}</div><div className="k">{t('reel.duels')}</div></div>
                <div className="stat"><div className="v num">{nums.predictions}</div><div className="k">{t('reel.predictions')}</div></div>
              </div>
              {nums.spent > 0 && <p className="t-meta fn-spent">{t('reel.spentNote', { points: nums.spent })}</p>}
              <div className="fn-actions">
                <button type="button" className="btn btn-primary" onClick={() => setReelFor(mine)}>
                  <Clapperboard aria-hidden="true" strokeWidth={2} />{t('final.yourNight')}
                </button>
                {desktop && (
                  <button type="button" className="btn btn-secondary" onClick={() => setTv(true)}>
                    <Tv aria-hidden="true" strokeWidth={2} />{t('final.tv')}
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => window.dispatchEvent(new Event(REPLAY_FINALE_EVENT))}>
                  <RotateCcw aria-hidden="true" strokeWidth={2} />{t('final.replay')}
                </button>
              </div>
            </section>
          )}

          <section aria-labelledby="fn-titles-h">
            <h2 id="fn-titles-h" className="t-h3 fn-h">{t('final.titlesH')}</h2>
            <ol className="fn-titles">{TITLE_LIST_ORDER.map(titleCard)}</ol>
          </section>

          {desktop && <div className="fn-pred"><PredictionsResultsScreen embedded /></div>}
        </div>

        <aside className="fn-aside">
          <section className="fn-rank" aria-labelledby="fn-rank-h">
            <h2 id="fn-rank-h" className="t-eyebrow">{t('final.rankH')}</h2>
            <ol className="fn-rank-list">
              {ranked.map((p, i) => (
                <motion.li key={p.id} className={clsx('fn-rrow', p.id === me?.id && 'me')} {...stagger(i)}>
                  <span className={clsx('num fn-rpos', i < 3 && `p${i + 1}`)}>{i + 1}</span>
                  <PlayerAvatar name={p.name} avatarId={p.avatar_id} size="md" />
                  <span className="fn-rwho">
                    <span className="fn-rname">{p.name}{p.id === me?.id && <span className="t-meta"> · {t('lobby.you')}</span>}</span>
                    <span className="t-meta">{t('board.sub', { quiz: p.quiz_points, duel: signedNum(p.duel_points), pred: p.pred_points })}{p.points_spent > 0 && ` · ${t('board.spent', { points: p.points_spent })}`}</span>
                  </span>
                  <span className="num fn-rpts">{p.total_points}</span>
                </motion.li>
              ))}
            </ol>
          </section>
          {desktop && (
            <section className="rk-feed" aria-labelledby="fn-feed-h">
              <h2 id="fn-feed-h" className="t-eyebrow rk-feed-h">{t('board.feedTitle')} <span className="chip rk-new">{t('board.feedNew')}</span></h2>
              {feed.length === 0 ? (
                <p className="t-meta rk-feed-empty"><Activity aria-hidden="true" strokeWidth={2} />{t('board.feedEmpty')}</p>
              ) : (
                <ol className="rk-feed-list">
                  {feed.slice(0, 8).map((e) => (
                    <li key={e.id} className="rk-item">
                      <PlayerAvatar name={nameOf(e.playerId)} avatarId={players.find((p) => p.id === e.playerId)?.avatar_id} size="sm" />
                      <span className="rk-item-t"><FeedLine e={e} nameOf={nameOf} /></span>
                      <FeedTime at={e.at} now={now} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </aside>
      </div>

      {reelFor && room && (
        <PersonalReel player={reelFor} players={ranked} winners={winners} roomId={roomId} roomCode={room.code} year={room.year} onClose={() => setReelFor(null)} />
      )}
      {tv && room && (
        <TvPresentation players={ranked} winners={winners} roomId={roomId} roomCode={room.code} year={room.year} championVote={championVote} meId={me?.id} onExit={() => setTv(false)} />
      )}
    </div>
  );
}
