import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Info, Share2 } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { useInvite } from '../../hooks/useInvite';
import { QrCode } from '../stage';
import PlayerCard from './PlayerCard';

interface LobbyScreenProps {
  onAdvancePhase: () => Promise<void>;
}

/** Re-render every `ms` so relative join times stay fresh. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Lobby (boards lobby-after-{m,d}): room code + QR of the join link,
 * invite/copy, player tiles, and the host's Start control (unchanged:
 * needs 2+ players; guests see the waiting line).
 */
export default function LobbyScreen({ onAdvancePhase }: LobbyScreenProps) {
  const { t, i18n } = useTranslation();
  const { room, player, players } = useGameStore();
  const { code, qrUrl, shareInvite, copyCode, codeCopied } = useInvite();
  const [advancing, setAdvancing] = useState(false);
  const now = useNow(30_000);

  // Join order (host first in practice), so a new player lands at the end.
  const ordered = useMemo(
    () => [...players].sort((a, b) => Date.parse(a.joined_at ?? '') - Date.parse(b.joined_at ?? '') || 0),
    [players],
  );
  const max = room?.max_players ?? 20;
  const isHost = !!player?.is_host;
  const needed = Math.max(0, 2 - players.length);

  const rtf = useMemo(() => {
    try {
      return new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto', style: 'narrow' });
    } catch {
      return null;
    }
  }, [i18n.language]);
  const joinedAgo = (iso: string | null | undefined) => {
    if (!rtf || !iso) return undefined;
    const mins = Math.round((new Date(iso).getTime() - now) / 60_000);
    if (!Number.isFinite(mins)) return undefined;
    return Math.abs(mins) < 60 ? rtf.format(Math.min(0, mins), 'minute') : rtf.format(Math.round(mins / 60), 'hour');
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await onAdvancePhase();
    } finally {
      setAdvancing(false);
    }
  };

  const startControl = isHost ? (
    <button
      type="button"
      className="btn btn-primary btn-lg lb-start"
      onClick={handleAdvance}
      disabled={players.length < 2 || advancing}
      aria-busy={advancing || undefined}
    >
      {advancing && <span className="lb-spinner" aria-hidden="true" />}
      {t('lobby.startParty')}
    </button>
  ) : (
    <p className="lb-waiting" role="status">{t('lobby.waitingHost')}</p>
  );
  const needMore = isHost && needed > 0 && (
    <span className="t-meta lb-need">{t('lobby.needMore', { needed })}</span>
  );

  return (
    <div className="lb">
      <div className="lb-cols">
        <div className="lb-main">
          <h1 className="t-h1 lb-title">{t('lobby.title')}</h1>

          {/* Code + QR */}
          <section className="card-hero lb-invite" aria-labelledby="lb-code-label">
            <div className="lb-qr">
              {qrUrl && <QrCode value={qrUrl} label={t('lobby.qrLabel', { code })} />}
            </div>
            <div className="lb-code-block">
              <span className="t-eyebrow" id="lb-code-label">{t('lobby.codeLabel')}</span>
              <div className="num lb-code">{code || '------'}</div>
              <p className="t-meta lb-hint lb-hint-m">{t('lobby.joinHint')}</p>
              <p className="t-small lb-hint lb-hint-d">{t('lobby.joinHintWide')}</p>
            </div>
            <div className="lb-actions">
              <button type="button" className="btn btn-secondary" onClick={copyCode} aria-live="polite">
                {codeCopied ? <Check aria-hidden="true" strokeWidth={2.4} /> : <Copy aria-hidden="true" strokeWidth={2} />}
                <span className="lb-only-m">{codeCopied ? t('lobby.copyCodeDone') : t('lobby.copyCodeShort')}</span>
                <span className="lb-only-d">{codeCopied ? t('lobby.copyCodeDone') : t('lobby.copyCode')}</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={shareInvite}>
                <Share2 aria-hidden="true" strokeWidth={2.2} />
                {t('lobby.invite')}
              </button>
            </div>
          </section>

          {/* Players */}
          <section className="lb-players" aria-labelledby="lb-players-h">
            <div className="lb-players-head">
              <h2 className="t-h3 lb-players-h" id="lb-players-h">
                {t('lobby.players')} <span className="num">{players.length}</span>
              </h2>
              <span className="t-meta lb-only-m">{t('lobby.maxPlayers', { max })}</span>
              <span className="t-meta lb-only-d">{t('lobby.maxPlayersWide', { max })}</span>
            </div>
            {players.length === 0 ? (
              <p className="t-meta">{t('common.loading')}</p>
            ) : (
              <div className="lb-grid">
                <AnimatePresence mode="popLayout" initial={false}>
                  {ordered.map((p) => (
                    <PlayerCard key={p.id} player={p} isCurrentPlayer={p.id === player?.id} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* What starting does + Start (desktop card) */}
          <section className="card lb-start-card">
            <Info className="lb-info-ico lb-only-m" aria-hidden="true" strokeWidth={2} />
            <div className="lb-start-text">
              <div className="lb-start-title lb-only-d">{t('lobby.startTitle')}</div>
              <p className="t-small">{t('lobby.startInfo')}</p>
            </div>
            <div className="lb-start-cta lb-only-d">
              {needMore}
              {startControl}
            </div>
          </section>
        </div>

        {/* Desktop aside: who is in the room, in join order */}
        <aside className="lb-aside" aria-labelledby="lb-inroom-h">
          <h2 className="t-eyebrow" id="lb-inroom-h">{t('lobby.inRoom', { count: players.length })}</h2>
          <div className="card lb-list">
            <AnimatePresence mode="popLayout" initial={false}>
              {ordered.map((p) => (
                <PlayerCard key={p.id} player={p} variant="row" isCurrentPlayer={p.id === player?.id} meta={joinedAgo(p.joined_at)} />
              ))}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      {/* Mobile sticky Start / waiting bar */}
      {room && (
        <div className="lb-bar">
          {needMore}
          {startControl}
        </div>
      )}
    </div>
  );
}
