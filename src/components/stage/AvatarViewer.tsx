import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Avatar, avatarInitials, avatarTone, type AvatarProps } from './Avatar';
import { AvatarVisual } from './avatars/AvatarVisual';
import { getAvatar } from './avatars/registry';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AvatarModalProps {
  open: boolean;
  onClose: () => void;
  /** Stage name. The viewer never takes, fetches or shows a real name. */
  name: string;
  avatarId?: string | null;
}

/**
 * The large avatar viewer: avatar up to 320px, the stage name and the
 * avatar's title. Accessible dialog: labelled, focus trapped inside,
 * Esc and the backdrop close it, focus returns to the opener.
 */
export function AvatarModal({ open, onClose, name, avatarId }: AvatarModalProps) {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const lang = i18n.language?.startsWith('el') ? 'el' : 'en';
  const entry = getAvatar(avatarId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Focus the close button on open; give focus back to the opener on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { opener?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (typeof document === 'undefined') return null;
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };
  const pop = reduce
    ? fade
    : {
        initial: { opacity: 0, scale: 0.9, y: 12 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: 'easeIn' as const } },
        transition: { type: 'spring' as const, stiffness: 380, damping: 28 },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="avv" className="avv-layer" onClick={(e) => e.stopPropagation()} {...fade}>
          <div className="avv-backdrop" onClick={onClose} data-testid="avatar-viewer-backdrop" />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('avatarViewer.dialog', { name })}
            aria-describedby={titleId}
            className="avv-dialog"
            onKeyDown={trap}
            {...pop}
          >
            <button ref={closeRef} type="button" className="iconbtn avv-close" onClick={onClose} aria-label={t('avatarViewer.close')}>
              <X aria-hidden="true" strokeWidth={2.2} />
            </button>
            <div className="avv-art">
              {entry ? (
                <AvatarVisual entry={entry} variant="full" />
              ) : (
                <span className="avv-initials" style={{ background: avatarTone(avatarId || name) }} aria-hidden="true">
                  {avatarInitials(name)}
                </span>
              )}
            </div>
            <p className="avv-name">{name}</p>
            <p className="t-meta avv-title" id={titleId}>
              {entry ? entry.title[lang] : t('avatarViewer.noArt')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface PlayerAvatarProps extends Omit<AvatarProps, 'decorative'> {
  /**
   * Default true: the avatar is a button that opens the viewer. Pass false
   * where a click would conflict (inside an answer button or another
   * button); it then renders the plain decorative avatar.
   */
  interactive?: boolean;
  /** Extra class on the button wrapper. */
  buttonClassName?: string;
}

/**
 * A player's avatar thumbnail that opens the avatar viewer. Use it wherever
 * a player is shown (lobby, game bar menu, quiz and duel screens,
 * leaderboard). Only the stage name goes in; never a real name.
 */
export function PlayerAvatar({ name, avatarId, size, className, interactive = true, buttonClassName }: PlayerAvatarProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!interactive) return <Avatar name={name} avatarId={avatarId} size={size} className={className} />;
  return (
    <>
      <button
        type="button"
        className={clsx('avv-btn', buttonClassName)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('avatarViewer.open', { name })}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Avatar name={name} avatarId={avatarId} size={size} className={className} />
      </button>
      <AvatarModal open={open} onClose={close} name={name} avatarId={avatarId} />
    </>
  );
}
