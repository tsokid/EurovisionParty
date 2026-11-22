// TV / presentation layout (approved): the final results cast to the
// living-room TV. Large type, no game chrome. From here the host can play
// the winners sequence and any player's reel, also in TV size.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Play, X, Clapperboard } from 'lucide-react';
import FinalSequence, { TitleIcon } from './FinalSequence';
import PersonalReel from '../reel/PersonalReel';
import { Avatar } from '../stage';
import { groupByCategory, hasTie } from '../../lib/winners';
import { TITLE_LIST_ORDER } from '../../lib/titles';
import type { WinnerRow } from '../../lib/winners';
import type { ChampionVoteStatus } from '../../hooks/useChampionVote';
import type { Player } from '../../lib/types';

export interface TvPresentationProps {
  players: readonly Player[];
  winners: readonly WinnerRow[];
  roomId: string;
  roomCode: string;
  year: number;
  championVote: ChampionVoteStatus;
  meId?: string | null;
  onExit: () => void;
}

export default function TvPresentation({ players, winners, roomId, roomCode, year, championVote, meId, onExit }: TvPresentationProps) {
  const { t } = useTranslation();
  const [seq, setSeq] = useState(false);
  const [reel, setReel] = useState<Player | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const groups = groupByCategory([...winners]);
  const champHidden = hasTie(groups.champion) && championVote !== 'accept';
  const byId = new Map(players.map((p) => [p.id, p]));
  const podium = [players[1], players[0], players[2]].filter(Boolean) as Player[];

  // Full screen when the browser allows it (the button press is the gesture).
  useEffect(() => {
    const el = rootRef.current;
    if (el?.requestFullscreen && !document.fullscreenElement) void el.requestFullscreen().catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !seq && !reel) exit(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, reel]);

  const exit = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    onExit();
  };

  return createPortal(
    <div ref={rootRef} className="tvx" role="dialog" aria-modal="true" aria-label={t('tv.aria')}>
      <header className="tvx-top">
        <div className="tvx-room"><span className="t-eyebrow">{t('tv.room')}</span><span className="num">{roomCode}</span></div>
        <h1 className="tvx-h">{t('tv.title', { year })}</h1>
        <span className="tvx-sp" />
        <button type="button" className="btn btn-primary" onClick={() => setSeq(true)}><Play aria-hidden="true" strokeWidth={2} />{t('tv.ceremony')}</button>
        <button type="button" className="iconbtn tvx-x" onClick={exit} aria-label={t('tv.exit')}><X aria-hidden="true" strokeWidth={2} /></button>
      </header>

      <div className="tvx-body">
        <section className="tvx-podium" aria-label={t('finale.podium')}>
          {podium.map((p) => {
            const place = players.indexOf(p) + 1;
            return (
              <div key={p.id} className={clsx('tvx-pod', `p${place}`)}>
                <Avatar name={p.name} avatarId={p.avatar_id} size="xl" />
                <span className="tvx-pod-name">{p.name}</span>
                <div className="tvx-pod-block"><span className="num">{p.total_points}</span><span>{t('finale.place', { n: place })}</span></div>
              </div>
            );
          })}
        </section>

        <section className="tvx-titles" aria-label={t('final.titlesH')}>
          {TITLE_LIST_ORDER.map((cat) => {
            const rows = groups[cat];
            const hidden = cat === 'champion' && champHidden;
            const holders = rows.map((r) => byId.get(r.player_id)).filter((p): p is Player => !!p);
            return (
              <div key={cat} className={clsx('tvx-title', `c-${cat}`)}>
                <span className="fn-ti"><TitleIcon cat={cat} /></span>
                <span className="tvx-tname">{t(`winners.cat.${cat}.name`)}</span>
                <span className="tvx-twho">{rows.length === 0 ? '—' : hidden ? '?' : holders.map((p) => p.name).join(' & ')}</span>
                <span className="t-meta">{rows.length === 0 ? t('titles.none') : hidden ? t('finale.tieVote') : `${t(`titles.reason.${cat}`)} · ${t(`titles.metric.${cat}`, { count: Number(rows[0].metric_value) })}`}</span>
              </div>
            );
          })}
        </section>

        <ol className="tvx-rank" start={1}>
          {players.map((p, i) => (
            <li key={p.id} className="tvx-row">
              <span className="num tvx-n">{i + 1}</span>
              <Avatar name={p.name} avatarId={p.avatar_id} size="md" />
              <span className="tvx-name">{p.name}</span>
              <span className="num tvx-pts">{p.total_points}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReel(p)} aria-label={t('tv.reelFor', { name: p.name })}>
                <Clapperboard aria-hidden="true" strokeWidth={2} />{t('tv.reel')}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {seq && <FinalSequence players={players} winners={winners} meId={meId} championVote={championVote} tv onClose={() => setSeq(false)} />}
      {reel && <PersonalReel player={reel} players={players} winners={winners} roomId={roomId} roomCode={roomCode} year={year} tv onClose={() => setReel(null)} />}
    </div>,
    document.body,
  );
}
