import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Eye, EyeOff, Lock } from 'lucide-react';
import {
  checkStageName,
  validateRealName,
  REAL_NAME_LIMITS,
  STAGE_NAME_LIMITS,
  type NameErrorCode,
} from '../../lib/nameFilter';
import { randomAvatarId, randomFrom, usePickerAvatars } from '../stage/avatars';
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
  /**
   * Join from the host's lobby QR: the room password came in the link's
   * fragment. The room code is locked and the password field is replaced by
   * a "filled in from the QR" line with a Change link.
   */
  qrPassword?: string;
  /** The last join failed on the password: reveal the field to fix it. */
  passwordRejected?: boolean;
}

export default function NameEntry({
  mode,
  onSubmit,
  onBack,
  isLoading = false,
  error,
  initialRoomCode = '',
  onRetrySecret,
  qrPassword,
  passwordRejected = false,
}: NameEntryProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [realName, setRealName] = useState('');
  const [avatarId, setAvatarId] = useState(() => randomAvatarId());
  // Once the live library loads, a preselected avatar it no longer offers is re-rolled.
  const pickerAvatars = usePickerAvatars();
  useEffect(() => {
    if (!pickerAvatars.some((a) => a.id === avatarId)) setAvatarId(randomFrom(pickerAvatars));
  }, [pickerAvatars, avatarId]);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const fromQr = mode === 'join' && !!qrPassword && !!initialRoomCode;
  const [password, setPassword] = useState(fromQr ? qrPassword : '');
  const [showPassword, setShowPassword] = useState(false);
  // QR join hides the password until the player asks to change it, or the
  // room rejects it (e.g. the host changed it).
  const [editPassword, setEditPassword] = useState(false);
  const passwordShown = !fromQr || editPassword;
  const passwordRef = useRef<HTMLInputElement>(null);
  const focusPassword = useRef(false);
  useEffect(() => {
    if (fromQr && passwordRejected) setEditPassword(true);
  }, [fromQr, passwordRejected]);
  useEffect(() => {
    if (editPassword && focusPassword.current) {
      focusPassword.current = false;
      passwordRef.current?.focus();
    }
  }, [editPassword]);
  const [touched, setTouched] = useState({ name: false, realName: false });

  const nameError = checkStageName(name);
  const realNameError = validateRealName(realName);
  const canSubmit =
    nameError === null &&
    realNameError === null &&
    // A QR password is the host's own: the server checks it, whatever its length.
    (fromQr ? password.trim().length > 0 : password.trim().length >= 6) &&
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
        {fromQr && (
          <p className="onb-room" data-testid="qr-room">
            <Lock size={16} aria-hidden />
            <span>{t('nameEntry.qrRoom')}</span>
            <span className="num onb-room-code">{initialRoomCode.toUpperCase()}</span>
          </p>
        )}
        {mode === 'join' && !fromQr && (
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

        {/* Password (QR join: filled in, shown only on Change or a rejection) */}
        {!passwordShown && (
          <p className="onb-qr-pw" role="status">
            <Check size={16} strokeWidth={2.6} aria-hidden />
            <span>{t('nameEntry.qrPasswordFilled')}</span>
            <button
              type="button"
              className="onb-qr-change"
              onClick={() => {
                focusPassword.current = true;
                setEditPassword(true);
              }}
              disabled={retrying}
            >
              {t('nameEntry.qrPasswordChange')}
            </button>
          </p>
        )}
        {passwordShown && (
        <div className="field">
          <label htmlFor="room-password" className="field-label">
            {mode === 'create' ? t('nameEntry.passwordCreateLabel') : t('nameEntry.passwordJoinLabel')}
          </label>
          <div className="field-pw">
            <input
              ref={passwordRef}
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
        )}

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
