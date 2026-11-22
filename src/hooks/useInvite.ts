import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { withQrPassword } from '../lib/qrJoin';

/**
 * The room join link, exactly as the invite text has always built it:
 * `${origin}/room/${code}`. RoomPage sends non-members on to the join form
 * with the code filled in, so this is also what the lobby QR encodes.
 */
export function roomJoinUrl(code: string, origin: string = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}/room/${code}`;
}

/**
 * The lobby QR link: the join link plus `#k=<password>` in the fragment, so a
 * scan opens the join form with the password filled in. Never used for the
 * invite text or copy-link flows (messages get forwarded).
 */
export function roomQrUrl(code: string, password: string | null | undefined, origin?: string): string {
  return withQrPassword(roomJoinUrl(code, origin), password);
}

/** Invite / copy helpers shared by the lobby, the desktop rail and the game menu. */
export function useInvite() {
  const { t } = useTranslation();
  const room = useGameStore((s) => s.room);
  const roomPassword = useGameStore((s) => s.roomPassword);
  const isHost = useGameStore((s) => !!s.player?.is_host);
  const code = room?.code ?? '';
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const flash = useCallback((set: (v: boolean) => void) => {
    set(true);
    timers.current.push(setTimeout(() => set(false), 2000));
  }, []);

  const inviteText = useCallback(() => {
    const passwordLine = roomPassword ? t('lobby.invitePasswordLine', { password: roomPassword }) : '';
    return t('lobby.inviteText', { code, passwordLine, link: roomJoinUrl(code) });
  }, [t, code, roomPassword]);

  const shareInvite = useCallback(async () => {
    if (!code) return;
    const text = inviteText();
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        // Desktop fallback: mailto with subject + body
        const subject = encodeURIComponent(t('lobby.inviteSubject'));
        window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(text)}`, '_blank');
      }
    } catch { /* user cancelled */ }
  }, [code, inviteText, t]);

  const copyInvite = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteText());
      flash(setInviteCopied);
    } catch { /* clipboard denied */ }
  }, [code, inviteText, flash]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      flash(setCodeCopied);
    } catch { /* clipboard denied */ }
  }, [code, flash]);

  // Only the host's QR carries the password, and only when this device knows
  // it (set on create, restored from the saved session on reload).
  const qrUrl = code ? roomQrUrl(code, isHost ? roomPassword : null) : '';

  return { code, joinUrl: code ? roomJoinUrl(code) : '', qrUrl, shareInvite, copyInvite, copyCode, codeCopied, inviteCopied };
}
