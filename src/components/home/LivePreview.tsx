import { useTranslation } from 'react-i18next';
import { AvatarPop, getAvatar } from '../stage/avatars';

// Decorative illustration of a room during the night (home-after-d board):
// static markup with stage names and the owner's avatar art, hidden from
// assistive tech and shown on desktop only. No titles on this provisional
// leaderboard: they are awarded only when the game ends (owner decision).
// Names are stage names only (no real first names), so the copy stays
// gender-neutral.
const ROWS = [
  { pos: 1, posColor: 'var(--color-stage-gold)', avatar: 'img-04', name: 'Disco Μπαμπέσα', me: true, pts: 128 },
  { pos: 2, posColor: 'var(--color-stage-silver)', avatar: 'img-01', name: 'Douze Points', pts: 117 },
  { pos: 3, posColor: 'var(--color-stage-bronze)', avatar: 'img-13', name: 'Wind Machine', pts: 96 },
  { pos: 4, posColor: 'var(--color-stage-text-3)', avatar: 'img-21', name: 'Nul Points', pts: 81 },
];

export default function LivePreview() {
  const { t } = useTranslation();
  return (
    <div className="card home-preview" aria-hidden>
      <div className="gamebar home-preview-bar">
        <span className="phase text-stage-live"><span className="dot" />{t('home.preview.phase')}</span>
        <span className="spacer" />
        <span className="chip home-preview-chip">{t('home.preview.example')}</span>
        <span className="t-meta">{t('home.preview.room')}</span>
        <span className="num text-[24px]">PARTY</span>
      </div>
      <div className="home-preview-body">
        <div className="t-eyebrow mx-3 mb-2">{t('home.preview.board')}</div>
        {ROWS.map((r) => {
          const entry = getAvatar(r.avatar);
          return (
            <div key={r.pos} className={r.me ? 'player me home-preview-row' : 'player home-preview-row'}>
              <span className="num w-7 text-[26px]" style={{ color: r.posColor }}>{r.pos}</span>
              {entry && <AvatarPop entry={entry} sizes="77px" className="home-preview-av" />}
              <span className="flex-1 min-w-0 font-semibold truncate">
                {r.name}
                {r.me && <span className="t-meta"> · {t('home.preview.you')}</span>}
              </span>
              <span className="num w-14 text-right text-[28px]">{r.pts}</span>
            </div>
          );
        })}
        <div className="home-preview-event">
          <span className="t-small flex-1">
            <b className="text-stage-text">Douze Points</b> · {t('home.preview.event', { name: 'Nul Points' })}
          </span>
          <span className="chip chip-pink h-[26px]">+12</span>
        </div>
      </div>
    </div>
  );
}
