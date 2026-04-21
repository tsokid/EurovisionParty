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
    <div className="min-h-svh bg-euro-gradient flex items-center justify-center px-4 py-6">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card variant="strong" className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center text-xl font-bold tracking-[0.3em] text-euro-gold placeholder:text-white/30 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal focus:outline-none focus:border-euro-purple-light focus:ring-1 focus:ring-euro-purple-light/50 transition-colors min-h-[48px]"
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
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 placeholder:text-sm focus:outline-none focus:border-euro-purple-light focus:ring-1 focus:ring-euro-purple-light/50 transition-colors min-h-[48px]"
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
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-12 text-white placeholder:text-white/30 placeholder:text-sm focus:outline-none focus:border-euro-purple-light focus:ring-1 focus:ring-euro-purple-light/50 transition-colors min-h-[48px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/90 transition-colors flex items-center justify-center w-8 h-8"
                  tabIndex={-1}
                  aria-label={showPassword ? t('nameEntry.hidePassword') : t('nameEntry.showPassword')}
                >
                  {showPassword ? (
                    // Eye-off (password visible → click to hide)
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    // Eye (password hidden → click to reveal)
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-white/60 mt-1">
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
                className="w-full text-center text-sm font-medium text-white/70 hover:text-white/90 py-2 transition-colors"
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
