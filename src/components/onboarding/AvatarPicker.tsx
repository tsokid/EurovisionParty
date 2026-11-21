import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Shuffle } from 'lucide-react';
import { AVATARS, AvatarArt, getAvatar, randomAvatarId } from '../stage/avatars';

interface AvatarPickerProps {
  value: string;
  onChange: (id: string) => void;
}

/**
 * Avatar choice from the Stage set: a two-row horizontal swipe strip on
 * mobile, a grid from 768px. The chosen one is previewed large with its
 * title; «Τυχαίο» shuffles to another one.
 */
export default function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('el') ? 'el' : 'en';
  const chosen = getAvatar(value) ?? AVATARS[0];
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the chosen avatar in view in the swipe strip (random preselection, shuffle).
  useEffect(() => {
    const strip = stripRef.current;
    const btn = strip?.querySelector<HTMLElement>(`[data-id="${chosen.id}"]`);
    if (!strip || !btn || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = Math.max(0, btn.offsetLeft - strip.clientWidth / 2 + btn.offsetWidth / 2);
  }, [chosen.id]);

  return (
    <div className="avp">
      <div className="avp-head">
        <div className="avp-preview">
          <AvatarArt spec={chosen} />
        </div>
        <div className="avp-meta">
          <span className="field-label" id="avatar-label">{t('nameEntry.avatarLabel')}</span>
          <span className="avp-title" aria-live="polite">{chosen.title[lang]}</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm avp-shuffle" onClick={() => onChange(randomAvatarId(chosen.id))}>
          <Shuffle size={16} aria-hidden />
          {t('nameEntry.shuffle')}
        </button>
      </div>
      <div className="avp-grid" ref={stripRef} role="radiogroup" aria-labelledby="avatar-label">
        {AVATARS.map((a) => {
          const on = a.id === chosen.id;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={a.title[lang]}
              data-id={a.id}
              className="avp-item"
              onClick={() => onChange(a.id)}
            >
              <AvatarArt spec={a} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
