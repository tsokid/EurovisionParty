import { useState } from 'react';
import { motion } from 'framer-motion';
import { validateName } from '../../lib/nameFilter';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface NameEntryProps {
  /** 'create' hides the room code input; 'join' shows it */
  mode: 'create' | 'join';
  onSubmit: (data: { name: string; emoji: string; roomCode?: string; password: string }) => void;
  onBack?: () => void;
  isLoading?: boolean;
  error?: string | null;
  /** Pre-fill room code (e.g. from direct link) */
  initialRoomCode?: string;
}

export default function NameEntry({
  mode,
  onSubmit,
  onBack,
  isLoading = false,
  error,
  initialRoomCode = '',
}: NameEntryProps) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const trimmedName = name.trim();
  const nameError = validateName(trimmedName);
  const nameValid = nameError === null;
  const canSubmit =
    nameValid &&
    password.trim().length >= 6 &&
    (mode === 'create' || roomCode.trim().length >= 4);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isLoading) return;
    onSubmit({
      name: name.trim(),
      emoji: '🎤',
      password: password.trim(),
      ...(mode === 'join' ? { roomCode: roomCode.trim().toUpperCase() } : {}),
    });
  };

  return (
    <div className="min-h-svh bg-euro-gradient flex items-center justify-center px-4 py-8">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card variant="strong" className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Title */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-euro-white glow-text">
                {mode === 'create' ? 'Create Your Room' : 'Join a Room'}
              </h2>
              <p className="text-sm text-white/50 mt-1">
                Pick a name to get started
              </p>
            </div>

            {/* Room code input (join only) */}
            {mode === 'join' && (
              <div>
                <label
                  htmlFor="room-code"
                  className="block text-sm font-medium text-white/70 mb-1.5"
                >
                  Room Code
                </label>
                <input
                  id="room-code"
                  type="text"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  placeholder="e.g. ABCD"
                  maxLength={6}
                  autoComplete="off"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center text-xl font-bold tracking-[0.3em] text-euro-gold placeholder:text-white/20 placeholder:tracking-normal placeholder:text-base placeholder:font-normal focus:outline-none focus:border-euro-purple-light focus:ring-1 focus:ring-euro-purple-light/50 transition-colors min-h-[48px]"
                />
              </div>
            )}

            {/* Name input */}
            <div>
              <label
                htmlFor="player-name"
                className="block text-sm font-medium text-white/70 mb-1.5"
              >
                Your Name
              </label>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 20))}
                placeholder="Enter your name"
                maxLength={20}
                autoComplete="off"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-euro-purple-light focus:ring-1 focus:ring-euro-purple-light/50 transition-colors min-h-[48px]"
              />
              <div className="flex justify-between mt-1">
                {nameError && trimmedName.length >= 2 ? (
                  <p className="text-xs text-euro-red">{nameError}</p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-white/30">{name.length}/20</p>
              </div>
            </div>

            {/* Password input */}
            <div>
              <label
                htmlFor="room-password"
                className="block text-sm font-medium text-white/70 mb-1.5"
              >
                {mode === 'create' ? 'Set Room Password' : 'Room Password'}
              </label>
              <div className="relative">
                <input
                  id="room-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 30))}
                  placeholder={
                    mode === 'create'
                      ? 'Choose a password (6+ chars)'
                      : 'Enter room password'
                  }
                  maxLength={30}
                  autoComplete="off"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-euro-purple-light focus:ring-1 focus:ring-euro-purple-light/50 transition-colors min-h-[48px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors text-sm leading-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-white/30 mt-1">
                {mode === 'create'
                  ? 'Share this password with your friends to join'
                  : 'Ask the room creator for the password'}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-euro-red text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={!canSubmit}
            >
              🎶 Let's Party!
            </Button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full text-center text-sm text-white/40 hover:text-white/60 py-2 transition-colors"
              >
                ← Back
              </button>
            )}
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
