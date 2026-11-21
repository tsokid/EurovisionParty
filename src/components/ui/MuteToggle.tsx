import { useTranslation } from 'react-i18next';
import { useAudioStore } from '../../stores/audioStore';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      {muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}

/**
 * Compact icon button that toggles the global mute flag.
 * `default`: 36×36 emoji button for the game toolbars (Header, Lobby).
 * `stage`: the Stage `.iconbtn` (44×44, line icon) for the public site header.
 */
export default function MuteToggle({ variant = 'default' }: { variant?: 'default' | 'stage' } = {}) {
  const { t } = useTranslation();
  const { muted, toggleMute } = useAudioStore();
  const label = muted
    ? t('audio.unmute', { defaultValue: 'Unmute sounds' })
    : t('audio.mute', { defaultValue: 'Mute sounds' });

  if (variant === 'stage') {
    return (
      <button type="button" onClick={toggleMute} className="iconbtn" aria-label={label} title={label}>
        <SpeakerIcon muted={muted} />
      </button>
    );
  }

  return (
    <button
      onClick={toggleMute}
      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full active:scale-95 transition-transform"
      aria-label={label}
      title={label}
    >
      <span className="text-lg leading-none">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
