import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import PlayerCard from './PlayerCard';
import Button from '../ui/Button';

interface LobbyScreenProps {
  onAdvancePhase: () => Promise<void>;
}

export default function LobbyScreen({ onAdvancePhase }: LobbyScreenProps) {
  const { room, player, players, roomPassword } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const copyCode = async () => {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  const getInviteText = () => {
    const link = `${window.location.origin}/room/${room?.code}`;
    const passwordLine = roomPassword ? `\nPassword: ${roomPassword}` : '';
    return `Join my Eurovision party! 🎤✨\n\nRoom code: ${room?.code}${passwordLine}\n\n${link}`;
  };

  const shareInvite = async () => {
    if (!room?.code) return;
    const text = getInviteText();
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        // Desktop fallback: mailto with subject + body
        const subject = encodeURIComponent('🎤 Eurovision Party Invite!');
        const body = encodeURIComponent(text);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      }
    } catch {
      // User cancelled
    }
  };

  const copyInvite = async () => {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(getInviteText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await onAdvancePhase();
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Room code hero */}
      <div className="text-center pt-8 pb-6 px-4">
        <p className="text-sm text-white/50 mb-2 font-medium">
          Tap to copy, or share with friends!
        </p>
        <button
          onClick={copyCode}
          className="flex items-center justify-center gap-3 active:scale-95 transition-transform cursor-pointer"
          aria-label="Tap to copy room code"
        >
          <motion.h2
            className="text-5xl sm:text-6xl font-extrabold tracking-[0.25em] glow-text-gold text-euro-gold"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {room?.code ?? '------'}
          </motion.h2>
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="text-euro-green text-xl"
              >
                ✓ Copied!
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="text-xl opacity-50"
              >
                📋
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Share buttons */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={shareInvite}
            className="inline-flex items-center gap-2 rounded-full bg-euro-purple/30 px-5 py-2 text-sm font-medium text-euro-purple-light active:scale-95 transition-transform"
          >
            📤 Share Invite
          </button>
          <button
            onClick={copyInvite}
            className="inline-flex items-center gap-2 rounded-full bg-euro-purple/30 px-5 py-2 text-sm font-medium text-euro-purple-light active:scale-95 transition-transform"
          >
            {copied ? '✅ Copied!' : '📋 Copy Invite'}
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="flex-1 px-4 pb-4">
        <h3 className="text-sm font-medium text-white/50 mb-3">
          Players ({players.length})
        </h3>

        {players.length === 0 ? (
          <div className="text-center text-white/30 py-8">Loading...</div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {players.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isCurrentPlayer={p.id === player?.id}
                  showScore={room?.phase !== 'lobby'}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Waiting message */}
        {players.length < 2 && (
          <motion.p
            className="text-center text-white/30 text-sm mt-6"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            Waiting for players to join...
          </motion.p>
        )}
      </div>

      {/* Game controls */}
      {room && (
        <motion.div
          className="glass-strong sticky bottom-0 z-30 p-4 rounded-t-2xl"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/60">
              👥 <strong className="text-euro-white">{players.length}</strong>{' '}
              {players.length === 1 ? 'player' : 'players'} joined
            </span>
            {players.length < 2 && (
              <span className="text-xs text-euro-red/80">
                Need {2 - players.length} more
              </span>
            )}
          </div>
          {player?.is_host ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleAdvance}
              loading={advancing}
              disabled={players.length < 2}
            >
              🚀 Start the Party!
            </Button>
          ) : (
            <motion.p
              className="text-center text-white/40 text-sm py-3"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              ⏳ Waiting for the host to start...
            </motion.p>
          )}
        </motion.div>
      )}
    </div>
  );
}
