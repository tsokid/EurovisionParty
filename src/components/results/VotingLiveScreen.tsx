// src/components/results/VotingLiveScreen.tsx
// Player-facing Predictions tab during the voting_live phase (boards
// voting-after-{m,d}). Predictions are locked; this shows the voting-live
// state and the player's own locked Top 5 + Worst 5. There is no live jury
// or televote feed in the app, so no provisional scores are shown.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Radio } from 'lucide-react';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { useParticipants } from '../../hooks/useParticipants';
import { supabase } from '../../lib/supabase';
import { PicksLists, useSealMoment } from '../predictions/PicksSummary';

interface LockedPrediction {
  top5: string[];
  worst5: string[];
}

export default function VotingLiveScreen() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();
  const { participants, byId, loading: loadingParticipants } = useParticipants(room?.year);
  const [pred, setPred] = useState<LockedPrediction | null>(null);
  const [loadingPred, setLoadingPred] = useState(true);

  useEffect(() => {
    if (!room || !player) { setLoadingPred(false); return; }
    let cancelled = false;
    supabase
      .from('predictions')
      .select('top5, worst5')
      .eq('room_id', room.id)
      .eq('player_id', player.id)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled) return;
          setPred((data as LockedPrediction | null) ?? null);
          setLoadingPred(false);
        },
        () => { if (!cancelled) setLoadingPred(false); },
      );
    return () => { cancelled = true; };
  }, [room?.id, player?.id]);

  const hasPicks = !!pred && ((pred.top5?.length ?? 0) > 0 || (pred.worst5?.length ?? 0) > 0);
  const play = useSealMoment(hasPicks && room ? room.id : null);
  const loading = loadingPred || loadingParticipants;

  return (
    <div className="pk pk-done">
      <section className="card-hero vt-hero">
        <div className="vt-hero-top">
          <span className="vt-ico" aria-hidden="true"><Radio strokeWidth={2.4} /></span>
          <div>
            <span className="chip chip-live"><span className="dot" aria-hidden="true" />{t('voting.livePill')}</span>
            <h1 className="vt-title">{t('voting.heading')}</h1>
          </div>
        </div>
        <p className="t-small">{t('voting.body')}</p>
      </section>

      {loading ? (
        <div className="pk-loading" role="status" aria-label={t('pick.loading')}>
          <span className="lb-spinner" aria-hidden="true" />
        </div>
      ) : hasPicks ? (
        <section className={clsx('vt-sec', play && 'play')} aria-labelledby="vt-picks-h">
          <div className="vt-sec-h">
            <svg className="vt-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <g className="vt-lock-shackle"><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g>
              <rect x="5" y="11" width="14" height="10" rx="2" />
            </svg>
            <h2 id="vt-picks-h" className="t-eyebrow">{t('pick.yours')}</h2>
            <span className="pk-stamp" aria-hidden="true">{t('pick.stamp')}</span>
          </div>
          <PicksLists top5={pred!.top5 ?? []} worst5={pred!.worst5 ?? []} n={participants.length} byId={byId} locked />
          <p className="t-meta">{t('pick.scoring')}</p>
        </section>
      ) : (
        <section className="card pk-closed">
          <p className="t-small">{t('pick.noneSubmitted')}</p>
        </section>
      )}

      <section className="card vt-note">
        <Lock aria-hidden="true" strokeWidth={2} />
        <p className="t-small">{t('voting.tabsNote')}</p>
      </section>
    </div>
  );
}
