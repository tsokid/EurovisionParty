import { useTranslation } from 'react-i18next';
import { Check, Copy, DoorOpen, Share2 } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { useInvite } from '../../hooks/useInvite';
import BottomNav from './BottomNav';

interface GameRailProps {
  phase?: string;
  onExitPress?: () => void;
}

/** Desktop (≥ 1024px) side rail: logo, room card, game sections, exit. */
export default function GameRail({ phase, onExitPress }: GameRailProps) {
  const { t } = useTranslation();
  const room = useGameStore((s) => s.room);
  const count = useGameStore((s) => s.players.length);
  const { code, shareInvite, copyCode, codeCopied } = useInvite();

  return (
    <aside className="gs-rail" aria-label={t('game.roomAria')}>
      {/* Same text wordmark as the site header (owner option A); not a link, so it can't pull a player out of the game. */}
      <span className="gs-logo wordmark" role="img" aria-label="eurovision.games">
        <span aria-hidden="true">euro<span className="wordmark-grad">vision</span><span className="wordmark-tld">.games</span></span>
      </span>

      <div className="gs-room">
        <span className="t-eyebrow">{t('lobby.codeLabel')}</span>
        <span className="num gs-room-code">{code || '------'}</span>
        <span className="t-meta">{t('game.playersCount', { count, max: room?.max_players ?? 20 })}</span>
        <div className="gs-room-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={shareInvite}>
            <Share2 aria-hidden="true" strokeWidth={2.2} />
            {t('lobby.invite')}
          </button>
          <button
            className="iconbtn gs-room-copy"
            type="button"
            onClick={copyCode}
            aria-label={codeCopied ? t('lobby.copyCodeDone') : t('lobby.copyCode')}
          >
            {codeCopied ? <Check aria-hidden="true" strokeWidth={2.4} /> : <Copy aria-hidden="true" strokeWidth={2} />}
          </button>
        </div>
      </div>

      <div>
        <div className="t-eyebrow gs-rail-label">{t('nav.sections')}</div>
        <BottomNav variant="rail" phase={phase} />
      </div>

      <span className="spacer" />

      {onExitPress && (
        <button type="button" className="gs-rail-exit" onClick={onExitPress}>
          <DoorOpen aria-hidden="true" strokeWidth={2.2} />
          {t('header.exit')}
        </button>
      )}
    </aside>
  );
}
