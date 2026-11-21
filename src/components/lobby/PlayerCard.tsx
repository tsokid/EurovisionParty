import { forwardRef } from 'react';
import clsx from 'clsx';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';
import type { Player } from '../../lib/types';
import { Avatar } from '../stage';

interface PlayerCardProps {
  player: Player;
  isCurrentPlayer?: boolean;
  /** tile: lobby grid; row: compact list (desktop "in the room" aside). */
  variant?: 'tile' | 'row';
  /** Right-aligned meta for rows (e.g. when the player joined). */
  meta?: string;
}

/**
 * A lobby player: avatar + stage name. Never the real name (that stays in
 * player_secrets until the final), and no gendered copy around the name.
 * New players pop in with a spring (motion map #6); fade only under
 * reduced motion.
 */
const PlayerCard = forwardRef<HTMLDivElement, PlayerCardProps>(function PlayerCard(
  { player, isCurrentPlayer = false, variant = 'tile', meta },
  ref,
) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15, ease: 'easeIn' as const } },
        transition: { type: 'spring' as const, stiffness: 420, damping: 22 },
      };

  const host = player.is_host && (
    <span className="lb-host">
      <Crown aria-hidden="true" strokeWidth={2.4} />
      {t('lobby.host')}
    </span>
  );

  if (variant === 'row') {
    return (
      <motion.div ref={ref} layout={!reduce} className={clsx('player', isCurrentPlayer && 'me')} data-player-id={player.id} {...motionProps}>
        <Avatar name={player.name} avatarId={player.avatar_id} />
        <span className="lb-row-name">
          {player.name}
          {isCurrentPlayer && <span className="t-meta"> · {t('lobby.you')}</span>}
        </span>
        {host}
        {meta && !player.is_host && <time className="t-meta lb-row-time">{meta}</time>}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      layout={!reduce}
      className={clsx('lb-tile', isCurrentPlayer && 'me')}
      data-player-id={player.id}
      {...motionProps}
    >
      <Avatar name={player.name} avatarId={player.avatar_id} size="lg" />
      <span className="lb-tile-name" title={player.name}>{player.name}</span>
      {isCurrentPlayer && <span className="t-meta lb-tile-you">{t('lobby.you')}</span>}
      {host}
    </motion.div>
  );
});

export default PlayerCard;
