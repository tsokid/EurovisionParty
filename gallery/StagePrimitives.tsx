// gallery/StagePrimitives.tsx — `?screen=stage-primitives`: every Stage
// primitive in every variant. Media queries follow the viewport, so the
// screen shows the same sheet in two iframes, 390px and 1440px wide
// (`&frame=1` renders the bare sheet).

import { useEffect, useRef, type ReactNode } from 'react';
import {
  Avatar, Button, Card, Chip, Entries, EntryRow, Flag, FLAG_CODES, PointsChip, Stat, Stats,
} from '../src/components/stage';
import { COUNTRIES_2026 } from '../src/lib/countries2026';

const ROWS = [
  { iso: 'BG', country: 'Βουλγαρία', artist: 'DARA', song: 'Bangaranga', points: 516 },
  { iso: 'IL', country: 'Ισραήλ', artist: 'Noam Bettan', song: 'Michelle', points: 343 },
  { iso: 'RO', country: 'Ρουμανία', artist: 'Alexandra Căpitănescu', song: 'Choke Me', points: 296 },
  { iso: 'AU', country: 'Αυστραλία', artist: 'Delta Goodrem', song: 'Eclipse', points: 287 },
  { iso: 'BA', country: 'Βοσνία-Ερζεγοβίνη', artist: 'Linda Lampenius & Pete Parkkonen feat. Orchestra', song: 'A very long song title that never ends', points: 12 },
  { iso: 'XX', country: 'Άγνωστη χώρα (γκρι σημαία)', artist: 'Unknown', song: 'Fallback', points: 0 },
];

const TABS = [
  { label: 'Προβλέψεις', d: 'M4 6h16M4 12h10M4 18h7' },
  { label: 'Κουίζ', d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01' },
  { label: 'Μονομαχίες', d: 'M5 19 19 5M14 5h5v5M5 5l5 5M14 14l5 5' },
  { label: 'Βαθμολογία', d: 'M7 21V11M12 21V4M17 21v-6' },
];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="t-eyebrow">{title}</span>
      {children}
    </section>
  );
}

const rowStyle = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' } as const;

function Sheet() {
  const nameOf = (iso: string) => COUNTRIES_2026.find((c) => c.id === iso)?.name_el ?? iso;
  return (
    <div style={{ minHeight: '100svh', background: 'var(--color-stage-bg)', color: 'var(--color-stage-text)', fontFamily: 'var(--font-stage)', padding: '32px 0 48px' }}>
      <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="t-eyebrow">Stage · primitives</span>
          <h1 className="t-h1">Σειρά συμμετοχής, κουμπιά, <span className="grad">ετικέτες</span>.</h1>
          <p className="t-lead">Κάθε primitive σε κάθε παραλλαγή, με τα tokens του ds.css.</p>
          <nav className="crumb" aria-label="Breadcrumb"><span>Αρχική</span><span aria-hidden="true">/</span><b>Primitives</b></nav>
        </header>

        <Block title="Τυπογραφία">
          <div className="t-display">Μπουργκάς</div>
          <div className="t-h1">Eurovision 2027</div>
          <div className="t-h2">Οι συμμετοχές</div>
          <div className="t-h3">Πώς παίζεται</div>
          <p className="t-lead">Προβλέψεις, trivia και μονομαχίες για τη βραδιά.</p>
          <p className="t-body">Κείμενο σελίδας με άνετο διάστιχο 1.6.</p>
          <span className="t-small">Small 14 · κείμενο βοήθειας</span>
          <span className="t-meta">Meta 13 · ημερομηνίες, πηγές</span>
          <div style={rowStyle}><span className="num" style={{ fontSize: 64, color: 'var(--color-stage-gold)' }}>01 · 516</span><span className="num" style={{ fontSize: 40, color: 'var(--color-stage-text-3)' }}>ΠΟΝΤΟΙ</span></div>
        </Block>

        <Block title="Button · primary / secondary / ghost × sm / md / lg">
          {(['primary', 'secondary', 'ghost'] as const).map((v) => (
            <div key={v} style={rowStyle}>
              <Button variant={v} size="sm">{v} sm</Button>
              <Button variant={v}>{v} md</Button>
              <Button variant={v} size="lg" href="#">{v} lg (a)</Button>
              <Button variant={v} disabled>disabled</Button>
            </div>
          ))}
          <Button size="lg" block>Φτιάξε δωμάτιο (block)</Button>
        </Block>

        <Block title="Chip · default / gold / live / pink · PointsChip">
          <div style={rowStyle}>
            <Chip>Β΄ ημιτελικός</Chip>
            <Chip variant="gold">1η θέση · 516</Chip>
            <Chip variant="live" dot>Ψηφοφορία ανοιχτή</Chip>
            <Chip variant="pink">Νέο</Chip>
            <Chip><Flag iso="BG" size="sm" />Eurovision 2027 · Μπουργκάς</Chip>
          </div>
          <div style={rowStyle}>
            <PointsChip points={8} reason="4s" />
            <PointsChip points={4} reason="12−9s" />
            <PointsChip points={24} reason="διπλασιασμός" />
            <PointsChip points={-12} reason="κλοπή" />
            <PointsChip points={0} reason="λάθος" />
          </div>
        </Block>

        <Block title="Card · default (pad) / hero / link">
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <Card pad><h3 className="t-h3">Card</h3><p className="t-small" style={{ margin: '8px 0 0' }}>Επιφάνεια με γραμμή και σκιά.</p></Card>
            <Card variant="hero" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="t-eyebrow" style={{ color: 'var(--color-stage-text-2)' }}>Μεγάλος τελικός</span>
                <span style={{ fontWeight: 600 }}>Σάββατο 15 Μαΐου 2027</span>
                <span className="t-meta">Ημιτελικοί 11 και 13 Μαΐου</span>
              </div>
              <div style={{ textAlign: 'center' }}><div className="num" style={{ fontSize: 52, color: 'var(--color-stage-gold)' }}>175</div><div className="t-meta">μέρες</div></div>
            </Card>
            <Card variant="link" href="#">
              <span className="ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21V11M12 21V4M17 21v-6" /></svg></span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Νικητές Eurovision</div><div className="t-small">Όλοι οι νικητές από το 1956.</div></div>
            </Card>
          </div>
        </Block>

        <Block title="Entries · wide (στήλες από 1024px), podium, highlight, μεγάλα ονόματα">
          <Entries wide aria-label="Αποτελέσματα">
            {ROWS.map((r, i) => <EntryRow key={r.iso} position={i + 1} podium highlight={i === 3} {...r} />)}
          </Entries>
          <span className="t-meta">Χωρίς wide, χωρίς πόντους (σειρά εμφάνισης):</span>
          <Entries aria-label="Σειρά εμφάνισης">
            {ROWS.slice(0, 3).map((r, i) => <EntryRow key={r.iso} position={i + 1} iso={r.iso} country={r.country} artist={r.artist} song={r.song} />)}
          </Entries>
        </Block>

        <Block title="Stat / Stats">
          <Stats>
            <Stat value="35" label="Χώρες" />
            <Stat value="11·05" label="Α΄ ημιτελικός" />
            <Stat value="13·05" label="Β΄ ημιτελικός" />
            <Stat value="15·05" label="Μεγάλος τελικός" accent="gold" />
          </Stats>
        </Block>

        <Block title="Avatar · sm / md / lg · παίκτες · πρόοδος">
          <div style={rowStyle}>
            {(['sm', 'md', 'lg'] as const).map((s) => <Avatar key={s} name="Ελένη Λάμπρου" size={s} decorative={false} />)}
            <Avatar name="Τάσος" />
            <Avatar name="maria" />
            <Avatar name="Tom Hanks" />
            <Avatar name="🎤 2000" />
            <Avatar name="Κάποιο όνομα" avatarId="star-3" />
          </div>
          <div className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[{ n: 'Ελένη', p: 128, me: true, c: 'var(--color-stage-gold)' }, { n: 'Τάσος', p: 117, c: 'var(--color-stage-silver)' }, { n: 'Μαρία', p: 96, c: 'var(--color-stage-bronze)' }].map((pl, i) => (
              <div key={pl.n} className={pl.me ? 'player me' : 'player'}>
                <span className="num" style={{ fontSize: 24, width: 28, color: pl.c }}>{i + 1}</span>
                <Avatar name={pl.n} />
                <span style={{ flex: 1, fontWeight: 600 }}>{pl.n}{pl.me && <span className="t-meta"> · εσύ</span>}</span>
                <span className="num" style={{ fontSize: 26 }}>{pl.p}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="t-small">Κουίζ · γύρος 2 από 3</span><span className="t-meta">7/10</span></div>
            <div className="progress"><i style={{ width: '70%' }} /></div>
          </div>
        </Block>

        <Block title="Game shell · gamebar, tabbar (κινητό) / rail (desktop)">
          <div style={{ border: '1px solid var(--color-stage-line)', borderRadius: 20, overflow: 'hidden' }}>
            <div className="gamebar"><span className="phase" style={{ color: 'var(--color-stage-live)' }}><span className="dot" />Προβλέψεις ανοιχτές</span><span style={{ flex: 1 }} /><span className="num" style={{ fontSize: 22 }}>DESIGN</span></div>
            <div style={{ display: 'flex', minHeight: 120 }}>
              <nav className="rail" aria-label="Παιχνίδι (rail)" style={{ width: 240 }}>
                {TABS.map((t, i) => <a key={t.label} href="#" className={i === 0 ? 'on' : undefined}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={t.d} /></svg>{t.label}</a>)}
              </nav>
              <div style={{ flex: 1, padding: 16 }} className="t-meta">Περιεχόμενο οθόνης</div>
            </div>
            <nav className="tabbar" style={{ position: 'static' }} aria-label="Παιχνίδι">
              {TABS.map((t, i) => <a key={t.label} href="#" className={i === 0 ? 'on' : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={t.d} /></svg>{t.label}</a>)}
            </nav>
          </div>
        </Block>

        <Block title="Layout · split (κύρια + aside 360px από 1024px)">
          <div className="split">
            <Card pad><span className="t-small">Κύρια στήλη</span></Card>
            <Card pad><span className="t-small">Aside</span></Card>
          </div>
        </Block>

        <Block title={`Flag · ${FLAG_CODES.size} κωδικοί + γκρι fallback · sm / md / lg`}>
          <div style={rowStyle}><Flag iso="GR" size="sm" /><Flag iso="GR" /><Flag iso="GR" size="lg" /><Flag iso="??" size="lg" label="Άγνωστη" /></div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {[...FLAG_CODES].map((iso) => (
              <div key={iso} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Flag iso={iso} />
                <span className="t-meta">{iso} · {nameOf(iso)}</span>
              </div>
            ))}
          </div>
        </Block>
      </div>
    </div>
  );
}

function Frame({ width }: { width: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    const fit = () => {
      const doc = el.contentDocument;
      if (!doc?.body) return;
      el.style.height = `${doc.documentElement.scrollHeight}px`;
      ro?.disconnect();
      ro = new ResizeObserver(() => { el.style.height = `${doc.documentElement.scrollHeight}px`; });
      ro.observe(doc.body);
    };
    el.addEventListener('load', fit);
    return () => { el.removeEventListener('load', fit); ro?.disconnect(); };
  }, []);
  const src = `${location.pathname}?screen=stage-primitives&frame=1`;
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
      <figcaption className="t-meta" style={{ color: '#A497BC' }}>{width}px</figcaption>
      <iframe ref={ref} title={`Stage primitives at ${width}px`} src={src} style={{ width, height: 1200, border: '1px solid rgba(255,255,255,.16)', borderRadius: 12, background: '#0B0416' }} />
    </figure>
  );
}

export default function StagePrimitives({ frame }: { frame: boolean }) {
  if (frame) return <Sheet />;
  return (
    <div style={{ minHeight: '100svh', background: '#06020F', padding: 24, display: 'flex', gap: 32, alignItems: 'flex-start', overflowX: 'auto' }}>
      <Frame width={390} />
      <Frame width={1440} />
    </div>
  );
}
