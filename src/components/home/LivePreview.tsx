import { useTranslation } from 'react-i18next';

// Decorative illustration of a room during the night (home-after-d board):
// static markup with stage names, hidden from assistive tech and shown on
// desktop only. No titles on this provisional leaderboard: they are awarded
// only when the game ends (owner decision).
const ROWS = [
  { pos: 1, posColor: 'var(--color-stage-gold)', initials: 'ΕΛ', tone: '#A35BFF', name: 'Ελένη', me: true, pts: 128 },
  { pos: 2, posColor: 'var(--color-stage-silver)', initials: 'DP', tone: '#F0469C', name: 'Douze Points', pts: 117 },
  { pos: 3, posColor: 'var(--color-stage-bronze)', initials: 'WM', tone: '#2B9C8F', name: 'Wind Machine', pts: 96 },
  { pos: 4, posColor: 'var(--color-stage-text-3)', initials: 'ΓΙ', tone: '#C26A1E', name: 'Γιάννης', pts: 81 },
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
        {ROWS.map((r) => (
          <div key={r.pos} className={r.me ? 'player me' : 'player'}>
            <span className="num w-7 text-[26px]" style={{ color: r.posColor }}>{r.pos}</span>
            <span className="avatar" style={{ background: r.tone }}>{r.initials}</span>
            <span className="flex-1 min-w-0 font-semibold truncate">
              {r.name}
              {r.me && <span className="t-meta"> · {t('home.preview.you')}</span>}
            </span>
            <span className="num w-14 text-right text-[28px]">{r.pts}</span>
          </div>
        ))}
        <div className="home-preview-event">
          <span className="t-small flex-1">
            <b className="text-stage-text">Douze Points</b> · {t('home.preview.event', { name: 'Wind Machine' })}
          </span>
          <span className="chip chip-pink h-[26px]">+12</span>
        </div>
      </div>
    </div>
  );
}
