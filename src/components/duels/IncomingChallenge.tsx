import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Swords, X } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { buzz } from '../../lib/haptics';
import { PlayerAvatar } from '../stage';

/** How long the sheet stays before it slides away by itself. */
export const INCOMING_SHEET_MS = 8000;

interface IncomingChallengeCardProps {
  /** Challenger's stage name. */
  name: string;
  avatarId?: string | null;
  rematch?: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * Motion map #11: the incoming-challenge card slides up from the bottom
 * (fade only under reduced motion). Name-as-label copy: «Πρόκληση από: Name».
 */
export function IncomingChallengeCard({ name, avatarId, rematch, onOpen, onDismiss }: IncomingChallengeCardProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.aside
      className="du-in"
      role="alertdialog"
      aria-label={t('duelCard.challengeFrom', { name })}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 120 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 120, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 360, damping: 28 }}
    >
      <PlayerAvatar name={name} avatarId={avatarId} size="lg" />
      <div className="du-in-txt">
        <span className="chip chip-pink"><span className="dot" />{rematch ? t('duelCard.rematch') : t('duelCard.incoming')}</span>
        <p className="du-in-title">{t('duelCard.challengeFrom', { name })}</p>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={onOpen}>
        <Swords aria-hidden="true" strokeWidth={2.4} />
        {t('duelCard.open')}
      </button>
      <button type="button" className="iconbtn du-in-x" onClick={onDismiss} aria-label={t('duelCard.later')}>
        <X aria-hidden="true" strokeWidth={2.2} />
      </button>
    </motion.aside>
  );
}

/**
 * Shows the card when a new `duel_challenge` notification reaches the store
 * (realtime, server state), on any tab except Duels, where the challenge
 * card itself slides into the list. Notifications created before this
 * mounted (initial fetch, rejoin) never pop. A short buzz where supported.
 */
export default function IncomingChallenge() {
  const { notifications, players, activeTab, setActiveTab } = useGameStore();
  const seen = useRef<Set<string> | null>(null);
  // Rows fetched on load (rejoin, refresh) are history: only challenges
  // created after this screen mounted may pop.
  const mountedAt = useRef(Date.now());
  const [shown, setShown] = useState<{ id: string; challengerId?: string; name: string; rematch: boolean } | null>(null);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const fresh = notifications.filter((n) => !seen.current!.has(n.id));
    fresh.forEach((n) => seen.current!.add(n.id));
    const challenge = fresh.find((n) => n.type === 'duel_challenge' && !n.is_read
      && Date.parse(n.created_at) >= mountedAt.current - 5000);
    if (!challenge || activeTab === 'duels') return;
    const raw = String(challenge.payload?.challengerName ?? '');
    setShown({
      id: challenge.id,
      challengerId: typeof challenge.payload?.challengerId === 'string' ? challenge.payload.challengerId : undefined,
      name: raw.replace(/\s*\(Rematch\)$/, ''),
      rematch: /\(Rematch\)$/.test(raw),
    });
    buzz([40, 60, 40]);
  }, [notifications, activeTab]);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(null), INCOMING_SHEET_MS);
    return () => clearTimeout(id);
  }, [shown]);

  useEffect(() => { if (activeTab === 'duels') setShown(null); }, [activeTab]);

  const challenger = shown?.challengerId ? players.find((p) => p.id === shown.challengerId) : undefined;
  return (
    <AnimatePresence>
      {shown && (
        <IncomingChallengeCard
          key={shown.id}
          name={challenger?.name ?? shown.name}
          avatarId={challenger?.avatar_id}
          rematch={shown.rematch}
          onOpen={() => { setShown(null); setActiveTab('duels'); }}
          onDismiss={() => setShown(null)}
        />
      )}
    </AnimatePresence>
  );
}
