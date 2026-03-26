import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
                {mode === 'create' ? t('nameEntry.createTitle') : t('nameEntry.joinTitle')}
              </h2>
              <p className="text-sm text-white/50 mt-1">
                {t('nameEntry.subtitle')}
              </p>
            </div>

            {/* Room code input (join only) */}
            {mode === 'join' && (
              <div>
                <label
                  htmlFor="room-code"
                  className="block text-sm font-medium text-white/70 mb-1.5"
                >
                  {t('nameEntry.roomCodeLabel')}
                </label>
                <input
                  id="room-code"
                  type="text"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  placeholder={t('nameEntry.roomCodePlaceholder')}
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
                {t('nameEntry.nameLabel')}
              </label>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 20))}
                placeholder={t('nameEntry.namePlaceholder')}
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
                <p className="text-xs text-white/30">{t('nameEntry.nameCount', { current: name.length })}</p>
              </div>
            </div>

            {/* Password input */}
            <div>
              <label
                htmlFor="room-password"
                className="block text-sm font-medium text-white/70 mb-1.5"
              >
                {mode === 'create' ? t('nameEntry.passwordCreateLabel') : t('nameEntry.passwordJoinLabel')}
              </label>
              <div className="relative">
                <input
                  id="room-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 30))}
                  placeholder={
                    mode === 'create'
                      ? t('nameEntry.passwordCreatePlaceholder')
                      : t('nameEntry.passwordJoinPlaceholder')
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
                  aria-label={showPassword ? t('nameEntry.hidePassword') : t('nameEntry.showPassword')}
                >
                  {showPassword ? t('nameEntry.hidePassword') : t('nameEntry.showPassword')}
                </button>
              </div>
              <p className="text-xs text-white/30 mt-1">
                {mode === 'create'
                  ? t('nameEntry.passwordCreateHint')
                  : t('nameEntry.passwordJoinHint')}
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
              {t('nameEntry.submitBtn')}
            </Button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full text-center text-sm text-white/40 hover:text-white/60 py-2 transition-colors"
              >
                {t('nameEntry.backBtn')}
              </button>
            )}
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
