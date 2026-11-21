// Contact sheet of the Stage avatar set (?screen=avatars): every avatar at
// 96px with its titles, then the whole set at 32px and inside <Avatar>.
import { AVATARS, AvatarArt } from '../src/components/stage/avatars';
import { Avatar } from '../src/components/stage';

export default function AvatarSheet() {
  return (
    <div className="stage-root" style={{ color: 'var(--color-stage-text)', fontFamily: 'var(--font-stage)', padding: 24 }}>
      <h1 className="t-h2" style={{ marginBottom: 16 }}>Avatars · {AVATARS.length}</h1>
      <div id="sheet-96" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
        {AVATARS.map((a) => (
          <figure key={a.id} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
            <AvatarArt spec={a} size={96} />
            <figcaption className="t-meta" style={{ lineHeight: 1.3 }}>
              <strong style={{ color: 'var(--color-stage-text)' }}>{a.title.el}</strong>
              <br />
              {a.title.en} · {a.id}
            </figcaption>
          </figure>
        ))}
      </div>
      <h2 className="t-h3" style={{ margin: '28px 0 12px' }}>32px</h2>
      <div id="sheet-32" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {AVATARS.map((a) => <AvatarArt key={a.id} spec={a} size={32} />)}
      </div>
      <h2 className="t-h3" style={{ margin: '28px 0 12px' }}>&lt;Avatar&gt; sm · md · lg · xl + initials fallback</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {(['sm', 'md', 'lg', 'xl'] as const).map((s) => <Avatar key={s} name="Πούλια" avatarId="av-01" size={s} />)}
        <Avatar name="Πούλια" avatarId="unknown-id" />
        <Avatar name="Ντίσκο Μπάλα" />
      </div>
    </div>
  );
}
