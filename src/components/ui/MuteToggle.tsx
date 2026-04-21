import { useTranslation } from 'react-i18next';
import { useAudioStore } from '../../stores/audioStore';

/**
 * Compact icon button (36×36) that toggles the global mute flag.
 * Matches the size + treatment of LanguageSwitcher and the Header's
 * theme/bell buttons so it drops into any toolbar.
 */
export default function MuteToggle() {
  const { t } = useTranslation();
  const { muted, toggleMute } = useAudioStore();

  return (
    <button
      onClick={toggleMute}
      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full active:scale-95 transition-transform"
      aria-label={
        muted
          ? t('audio.unmute', { defaultValue: 'Unmute sounds' })
          : t('audio.mute', { defaultValue: 'Mute sounds' })
      }
      title={
        muted
          ? t('audio.unmute', { defaultValue: 'Unmute sounds' })
          : t('audio.mute', { defaultValue: 'Mute sounds' })
      }
    >
      <span className="text-lg leading-none">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
