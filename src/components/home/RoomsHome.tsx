import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserRooms, getBadge, isOldRoom, type RoomEntry, type RoomBadge } from '../../hooks/useUserRooms';

interface Props {
  rooms: RoomEntry[];
  onCreate: () => void;
  onJoinWithCode: () => void;
}

/**
 * Home hero for players who already have rooms (owner chose option A):
 * the rooms replace the tagline and the big CTAs. Live rooms
 * first, then away; ended or idle rooms (isOldRoom) fold under «Παλιά δωμάτια». One row per
 * room so ten rooms still fit; leave and delete sit in the row's ⋯ menu.
 * Client-only: the prerendered HTML (and Google) see the normal hero.
 */
export default function RoomsHome({ rooms, onCreate, onJoinWithCode }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { leave, remove } = useUserRooms();
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);

  const current = rooms.filter((r) => !isOldRoom(r));
  const live = current.filter((r) => getBadge(r) === 'LIVE');
  const away = current.filter((r) => getBadge(r) === 'AWAY');
  const ended = rooms.filter((r) => isOldRoom(r));

  const run = async (entry: RoomEntry, action: (e: RoomEntry) => Promise<void>) => {
    setMenuFor(null);
    setBusy(entry.playerId);
    try { await action(entry); } finally { setBusy(null); }
  };
  const onDelete = (entry: RoomEntry) => {
    if (!window.confirm(t('yourRooms.deleteConfirm'))) return;
    void run(entry, remove);
  };

  const row = (entry: RoomEntry, first = false, old = false) => (
    <RoomRow
      key={entry.playerId}
      entry={entry}
      first={first}
      old={old}
      busy={busy === entry.playerId}
      menuOpen={menuFor === entry.playerId}
      onMenu={(open) => setMenuFor(open ? entry.playerId : null)}
      onEnter={() => navigate(`/room/${entry.roomCode}`)}
      onLeave={() => void run(entry, leave)}
      onDelete={() => onDelete(entry)}
    />
  );

  return (
    <div className="rh">
      {live.length > 0 && (
        <Group badge="LIVE" count={live.length}>
          {live.map((r, i) => row(r, i === 0))}
        </Group>
      )}
      {away.length > 0 && (
        <Group badge="AWAY" count={away.length}>
          {away.map((r, i) => row(r, live.length === 0 && i === 0))}
        </Group>
      )}
      {ended.length > 0 && (
        <div className="rh-group">
          <button
            type="button"
            className="rh-old"
            aria-expanded={showOld}
            aria-controls="rh-old-list"
            onClick={() => setShowOld((v) => !v)}
          >
            {t('yourRooms.oldRooms')}
            <span className="rh-old-n">{ended.length} <span aria-hidden="true">{showOld ? '▴' : '▾'}</span></span>
          </button>
          <div id="rh-old-list" className="rh-list" hidden={!showOld}>
            {ended.map((r) => row(r, false, true))}
          </div>
        </div>
      )}
      <div className="rh-new">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCreate}>
          + {t('yourRooms.newRoom')}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onJoinWithCode}>
          {t('yourRooms.joinWithCode')}
        </button>
      </div>
    </div>
  );
}

function Group({ badge, count, children }: { badge: RoomBadge; count: number; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="rh-group" aria-label={`${t(`yourRooms.${badge.toLowerCase()}`)} · ${count}`}>
      <div className="rh-group-h">
        <span className={`rh-badge ${badge.toLowerCase()}`}>{t(`yourRooms.${badge.toLowerCase()}`)}</span>
        <span className="rh-count">{count}</span>
      </div>
      <div className="rh-list">{children}</div>
    </section>
  );
}

interface RowProps {
  entry: RoomEntry;
  first: boolean;
  /** Shown in «Παλιά δωμάτια»: muted, still enterable unless ended. */
  old: boolean;
  busy: boolean;
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  onEnter: () => void;
  onLeave: () => void;
  onDelete: () => void;
}

function RoomRow({ entry, first, old, busy, menuOpen, onMenu, onEnter, onLeave, onDelete }: RowProps) {
  const { t } = useTranslation();
  const badge = getBadge(entry);
  const canLeave = entry.status === 'active' || entry.status === 'away';
  const hasMenu = canLeave || entry.isHost;
  const wrapRef = useRef<HTMLDivElement>(null);

  // The ⋯ menu closes on Esc or a press outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onMenu(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMenu(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, onMenu]);

  const host = entry.isHost ? t('yourRooms.hostYou') : t('yourRooms.hostLine', { name: entry.hostName });

  return (
    <div className={`rh-row ${old ? 'old' : badge.toLowerCase()}${first ? ' first' : ''}`} data-testid="rh-row">
      <div className="rh-who">
        <div className="rh-top">
          <span className="rh-code num">{entry.roomCode}</span>
          {entry.isHost && <span className="rh-host">{t('yourRooms.host')}</span>}
        </div>
        <div className="rh-sub">
          {host} · <span className="tabular-nums">{entry.totalPoints}</span> {t('common.pts')}
        </div>
      </div>
      {badge === 'LIVE' && (
        <button type="button" className={`btn ${old ? 'btn-secondary' : 'btn-primary'} btn-sm rh-go`} disabled={busy} onClick={onEnter}>
          {t('yourRooms.enter')} <span aria-hidden="true">→</span>
        </button>
      )}
      {badge === 'AWAY' && (
        <button type="button" className="btn btn-secondary btn-sm rh-go" disabled={busy} onClick={onEnter}>
          {t('yourRooms.rejoin')}
        </button>
      )}
      {hasMenu ? (
        <div className="rh-menu-wrap" ref={wrapRef}>
          <button
            type="button"
            className="rh-more"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('yourRooms.more', { code: entry.roomCode })}
            disabled={busy}
            onClick={() => onMenu(!menuOpen)}
          >
            {busy ? '…' : '⋯'}
          </button>
          {menuOpen && (
            <div className="rh-menu" role="menu">
              {canLeave && (
                <button type="button" role="menuitem" className="rh-mi warn" onClick={onLeave}>
                  {t('yourRooms.leave')}
                </button>
              )}
              {entry.isHost && (
                <button type="button" role="menuitem" className="rh-mi bad" onClick={onDelete}>
                  {t('yourRooms.deleteRoom')}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <span className="rh-more-spacer" aria-hidden="true" />
      )}
    </div>
  );
}
