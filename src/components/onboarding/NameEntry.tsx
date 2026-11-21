import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import {
  checkStageName,
  validateRealName,
  REAL_NAME_LIMITS,
  STAGE_NAME_LIMITS,
  type NameErrorCode,
} from '../../lib/nameFilter';
import { randomAvatarId } from '../stage/avatars';
import AvatarPicker from './AvatarPicker';

export interface NameEntryData {
  /** Stage name (players.name): shown everywhere, unique per room, used to rejoin. */
  name: string;
  /** Real name (player_secrets): secret until the end of the game. */
  realName: string;
  /** players.avatar_id from the Stage avatar set. */
  avatarId: string;
  /** Legacy players.avatar_emoji, still written for older clients. */
  emoji: string;
  roomCode?: string;
  password: string;
}

interface NameEntryProps {
  /** 'create' hides the room code input; 'join' shows it */
  mode: 'create' | 'join';
  onSubmit: (data: NameEntryData) => void;
  onBack?: () => void;
  isLoading?: boolean;
  error?: string | null;
  /** Pre-fill room code (e.g. from direct link) */
  initialRoomCode?: string;
  /**
   * The player row exists but the real name was not saved: the form shows
   * the error and a retry button that saves only the real name.
   */
  onRetrySecret?: () => void;
}

export default function NameEntry({
  mode,
  onSubmit,
  onBack,
  isLoading = false,
  error,
  initialRoomCode = '',
  onRetrySecret,
}: NameEntryProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [realName, setRealName] = useState('');
  const [avatarId, setAvatarId] = useState(() => randomAvatarId());
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ name: false, realName: false });

  const nameError = checkStageName(name);
  const realNameError = validateRealName(realName);
  const canSubmit =
    nameError === null &&
    realNameError === null &&
    password.trim().length >= 6 &&
    (mode === 'create' || roomCode.trim().length >= 4);
  const retrying = !!onRetrySecret;

  const message = (code: NameErrorCode | null, limits: { min: number; max: number }, field: 'name' | 'realName') => {
    if (!code) return null;
    // "Too short" waits for the field to be left; length and content errors show at once.
    if (code === 'tooShort' && !touched[field]) return null;
    if (code === 'tooShort' && field === 'realName') return t('nameEntry.errors.realNameRequired');
    return t(`nameEntry.errors.${code}`, limits);
  };
  const nameMsg = message(nameError, STAGE_NAME_LIMITS, 'name');
  const realNameMsg = message(realNameError, REAL_NAME_LIMITS, 'realName');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (retrying) {
      onRetrySecret();
      return;
    }
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      realName: realName.trim(),
      avatarId,
      emoji: '🎤',
      password: password.trim(),
      ...(mode === 'join' ? { roomCode: roomCode.trim().toUpperCase() } : {}),
    });
  };

  return (
    <div className="onb">
      <form onSubmit={handleSubmit} className="onb-card card" noValidate>
        <header className="onb-head">
          <p className="t-eyebrow">{mode === 'create' ? t('nameEntry.createKicker') : t('nameEntry.joinKicker')}</p>
          <h2 className="t-h2">{mode === 'create' ? t('nameEntry.createTitle') : t('nameEntry.joinTitle')}</h2>
          <p className="t-small">{t('nameEntry.subtitle')}</p>
        </header>

        <div className="onb-body">
        <div className="onb-avatar">
          <AvatarPicker value={avatarId} onChange={setAvatarId} />
        </div>
        <div className="onb-fields">
        {/* Room code (join only) */}
        {mode === 'join' && (
          <div className="field">
            <label htmlFor="room-code" className="field-label">{t('nameEntry.roomCodeLabel')}</label>
            <input
              id="room-code"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder={t('nameEntry.roomCodePlaceholder')}
              maxLength={6}
              autoComplete="off"
              className="field-input field-code"
              disabled={retrying}
            />
          </div>
        )}

        {/* Stage name */}
        <div className="field">
          <label htmlFor="player-name" className="field-label">{t('nameEntry.stageNameLabel')}</label>
          <input
            id="player-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, STAGE_NAME_LIMITS.max))}
            onBlur={() => setTouched((s) => ({ ...s, name: true }))}
            placeholder={t('nameEntry.stageNamePlaceholder')}
            maxLength={STAGE_NAME_LIMITS.max}
            autoComplete="off"
            className="field-input"
            aria-invalid={!!nameMsg}
            aria-describedby="player-name-hint"
            disabled={retrying}
          />
          <div className="field-row" id="player-name-hint">
            {nameMsg ? <span className="field-err">{nameMsg}</span> : <span className="field-hint">{t('nameEntry.stageNameHint')}</span>}
            <span className="field-hint num-count">{t('nameEntry.nameCount', { current: name.length })}</span>
          </div>
        </div>

        {/* Real name (secret) */}
        <div className="field">
          <label htmlFor="real-name" className="field-label">{t('nameEntry.realNameLabel')}</label>
          <input
            id="real-name"
            type="text"
            value={realName}
            onChange={(e) => setRealName(e.target.value.slice(0, REAL_NAME_LIMITS.max))}
            onBlur={() => setTouched((s) => ({ ...s, realName: true }))}
            placeholder={t('nameEntry.realNamePlaceholder')}
            maxLength={REAL_NAME_LIMITS.max}
            autoComplete="off"
            className="field-input"
            aria-invalid={!!realNameMsg}
            aria-describedby="real-name-hint"
            disabled={retrying}
          />
          <p className="secret-hint" id="real-name-hint">
            <Lock size={14} aria-hidden />
            <span>{t('nameEntry.realNameHint')}</span>
          </p>
          {realNameMsg && <span className="field-err">{realNameMsg}</span>}
        </div>

        {/* Password */}
        <div className="field">
          <label htmlFor="room-password" className="field-label">
            {mode === 'create' ? t('nameEntry.passwordCreateLabel') : t('nameEntry.passwordJoinLabel')}
          </label>
          <div className="field-pw">
            <input
              id="room-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 30))}
              placeholder={mode === 'create' ? t('nameEntry.passwordCreatePlaceholder') : t('nameEntry.passwordJoinPlaceholder')}
              maxLength={30}
              autoComplete="off"
              className="field-input"
              disabled={retrying}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="field-eye"
              tabIndex={-1}
              aria-label={showPassword ? t('nameEntry.hidePassword') : t('nameEntry.showPassword')}
            >
              {showPassword ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
            </button>
          </div>
          <span className="field-hint">
            {mode === 'create' ? t('nameEntry.passwordCreateHint') : t('nameEntry.passwordJoinHint')}
          </span>
        </div>

        {error && <p className="onb-error" role="alert">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={isLoading || (!retrying && !canSubmit)}
          aria-busy={isLoading || undefined}
        >
          {isLoading && <span className="onb-spinner" aria-hidden />}
          {retrying ? t('nameEntry.retrySecret') : t('nameEntry.submitBtn')}
        </button>

        {onBack && !retrying && (
          <button type="button" onClick={onBack} className="btn btn-ghost btn-block onb-back">
            <ArrowLeft size={16} aria-hidden />
            {t('nameEntry.backBtn')}
          </button>
        )}
        </div>
        </div>
      </form>
    </div>
  );
}
