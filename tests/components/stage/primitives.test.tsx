import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../../../src/lib/seo/LocaleContext';
import fs from 'node:fs';
import path from 'node:path';
import {
  Avatar, avatarInitials, Button, Chip, Entries, EntryRow, Flag, FLAG_CODES, flagClass, flagSrc, PointsChip, formatPoints, Card, Stat,
} from '../../../src/components/stage';
import { COUNTRIES_2026 } from '../../../src/lib/countries2026';

const ROOT = path.resolve(__dirname, '../../..');

describe('<EntryRow>', () => {
  const row = (extra: Partial<Parameters<typeof EntryRow>[0]> = {}) =>
    render(
      <Entries>
        <EntryRow position={1} iso="BG" country="Βουλγαρία" artist="DARA" song="Bangaranga" points={516} {...extra} />
      </Entries>,
    ).container;

  it('renders position, country, artist · song and points', () => {
    const c = row();
    const li = c.querySelector('ol.entries > li.entry')!;
    expect(li.querySelector('.pos')!.textContent).toBe('1');
    expect(li.querySelector('.country')!.textContent).toBe('Βουλγαρία');
    expect(li.querySelector('.song')!.textContent).toBe('DARA · Bangaranga');
    expect(li.querySelector('.pts')!.textContent).toBe('516');
    expect(li.querySelector('img.flag')!.getAttribute('src')).toBe('/flags/w40-bg.png');
  });

  it('highlight adds the .hl class and aria-current', () => {
    const plain = row().querySelector('li')!;
    expect(plain.classList.contains('hl')).toBe(false);
    expect(plain.hasAttribute('aria-current')).toBe(false);
    const hl = row({ highlight: true }).querySelector('li')!;
    expect(hl.classList.contains('hl')).toBe(true);
    expect(hl.getAttribute('aria-current')).toBe('true');
  });

  it('podium colours only positions 1–3, and only when asked', () => {
    expect(row().querySelector('li')!.classList.contains('p1')).toBe(false);
    expect(row({ podium: true }).querySelector('li')!.classList.contains('p1')).toBe(true);
    expect(row({ podium: true, position: 4 }).querySelector('li')!.className).toBe('entry');
  });

  it('omits points and the song line when absent; keeps the full text in title for truncation', () => {
    const c = row({ points: undefined, artist: null, song: null });
    expect(c.querySelector('.pts')).toBeNull();
    expect(c.querySelector('.song')).toBeNull();
    const long = 'Bosnia and Herzegovina, a very long country label';
    expect(row({ country: long }).querySelector('.country')!.getAttribute('title')).toBe(long);
  });

  it('wide lists carry the .wide class', () => {
    const c = render(<Entries wide><EntryRow position={2} iso="IL" country="Ισραήλ" /></Entries>).container;
    expect(c.querySelector('.entries')!.classList.contains('wide')).toBe(true);
  });
});

describe('avatarInitials / <Avatar>', () => {
  it('Greek names: two words → first letters, accents dropped', () => {
    expect(avatarInitials('Ελένη Παπαδοπούλου')).toBe('ΕΠ');
    expect(avatarInitials('άννα μαρία')).toBe('ΑΜ');
  });
  it('Latin names: two words → first letters', () => {
    expect(avatarInitials('Tom Hanks')).toBe('TH');
    expect(avatarInitials('  émile   zola ')).toBe('EZ');
  });
  it('single word → first two letters (Greek and Latin)', () => {
    expect(avatarInitials('Μαρία')).toBe('ΜΑ');
    expect(avatarInitials('Ελένη')).toBe('ΕΛ');
    expect(avatarInitials('tom')).toBe('TO');
    expect(avatarInitials('X')).toBe('X');
  });
  it('skips emoji and digits; empty → ?', () => {
    expect(avatarInitials('🎤 Disco 2000')).toBe('DI');
    expect(avatarInitials('')).toBe('?');
    expect(avatarInitials('123')).toBe('?');
  });
  it('is decorative (aria-hidden) by default, labelled otherwise', () => {
    const { container } = render(<><Avatar name="Μαρία" /><Avatar name="Τάσος" decorative={false} size="lg" /></>);
    const [a, b] = container.querySelectorAll('.avatar');
    expect(a.getAttribute('aria-hidden')).toBe('true');
    expect(a.textContent).toBe('ΜΑ');
    expect(b.getAttribute('role')).toBe('img');
    expect(b.getAttribute('aria-label')).toBe('Τάσος');
    expect(b.classList.contains('avatar-lg')).toBe(true);
  });
  it('avatarId gives a stable tint independent of the name', () => {
    const { container } = render(<><Avatar name="A" avatarId="star-3" /><Avatar name="B" avatarId="star-3" /></>);
    const [a, b] = container.querySelectorAll<HTMLElement>('.avatar');
    expect(a.style.background).toBe(b.style.background);
    expect(a.dataset.avatarId).toBe('star-3');
  });
});

describe('<Button>', () => {
  it('renders <a> with href', () => {
    const { container } = render(<Button href="/el/faq" variant="secondary" size="lg">FAQ</Button>);
    const a = container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/el/faq');
    expect(a.className).toBe('btn btn-secondary btn-lg');
    expect(container.querySelector('button')).toBeNull();
  });
  it('renders <button type="button"> otherwise', () => {
    const { container } = render(<Button block>Φτιάξε δωμάτιο</Button>);
    const b = container.querySelector('button')!;
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toBe('btn btn-primary btn-block');
    expect(container.querySelector('a')).toBeNull();
  });
  it('renders a LocaleLink with `to` (locale prefix added, no <button>)', () => {
    const { container } = render(
      <MemoryRouter>
        <LocaleProvider locale="el">
          <Button to="/faq" variant="ghost" size="sm">FAQ</Button>
        </LocaleProvider>
      </MemoryRouter>,
    );
    const a = container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/el/faq');
    expect(a.className).toBe('btn btn-ghost btn-sm');
    expect(container.querySelector('button')).toBeNull();
  });
  it('keeps an explicit submit type', () => {
    const { container } = render(<Button type="submit" variant="ghost" size="sm">Μπες</Button>);
    expect(container.querySelector('button')!.getAttribute('type')).toBe('submit');
  });
});

describe('<Flag>', () => {
  it('unknown code → grey box only (a span, no image, no f-xx class)', () => {
    const { container } = render(<><Flag iso="XX" /><Flag iso={null} /><Flag iso="" /></>);
    const flags = container.querySelectorAll('.flag');
    expect(flags).toHaveLength(3);
    for (const el of flags) {
      expect(el.tagName).toBe('SPAN');
      expect([...el.classList].some((c) => c.startsWith('f-'))).toBe(false);
      expect(el.getAttribute('aria-hidden')).toBe('true');
    }
    expect(flagSrc('ZZ')).toBeNull();
  });
  it('known code → self-hosted image (case-insensitive), w80 for 2x, sized, loaded at once, decorative', () => {
    const { container } = render(<Flag iso="gr" />);
    const img = container.querySelector('img')!;
    expect(img.className).toBe('flag');
    expect(img.getAttribute('src')).toBe('/flags/w40-gr.png');
    expect(img.getAttribute('srcset')).toBe('/flags/w40-gr.png 1x, /flags/w80-gr.png 2x');
    expect(img.getAttribute('width')).toBe('28');
    expect(img.getAttribute('height')).toBe('20');
    // Not lazy: lazy flags appeared late or not at all while scrolling (23 Nov 2026).
    expect(img.getAttribute('loading')).toBeNull();
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });
  it('label gives the image its alt text; sizes set the box', () => {
    const { container } = render(<><Flag iso="SE" size="lg" label="Σουηδία" /><Flag iso="SE" size="sm" /></>);
    const [lg, sm] = container.querySelectorAll('img');
    expect(lg.className).toBe('flag flag-lg');
    expect(lg.getAttribute('alt')).toBe('Σουηδία');
    expect(lg.hasAttribute('aria-hidden')).toBe(false);
    expect([lg.getAttribute('width'), lg.getAttribute('height')]).toEqual(['40', '28']);
    expect([sm.getAttribute('width'), sm.getAttribute('height')]).toEqual(['18', '12']);
  });
  it('historic CS / YU (no flagcdn image) → CSS approximation span', () => {
    const { container } = render(<><Flag iso="YU" /><Flag iso="cs" label="Σερβία και Μαυροβούνιο" /></>);
    const [yu, cs] = container.querySelectorAll('.flag');
    expect(yu.tagName).toBe('SPAN');
    expect(yu.className).toBe('flag f-yu');
    expect(cs.getAttribute('role')).toBe('img');
    expect(cs.getAttribute('aria-label')).toBe('Σερβία και Μαυροβούνιο');
    expect(flagSrc('YU')).toBeNull();
    expect(flagClass('GR')).toBeNull();
  });
  it('every ISO code the app uses is known, and each CSS-only code has a CSS rule', () => {
    const codes = new Set<string>(COUNTRIES_2026.map((c) => c.id.toUpperCase()));
    for (const f of fs.readdirSync(path.join(ROOT, 'content/countries'))) {
      if (/^[A-Z]{2}\.json$/.test(f)) codes.add(f.slice(0, 2));
    }
    for (const f of fs.readdirSync(path.join(ROOT, 'content/contests'))) {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/contests', f), 'utf8')) as { entries?: { iso?: string }[] };
      for (const e of data.entries ?? []) if (e.iso) codes.add(e.iso.toUpperCase());
    }
    const missing = [...codes].filter((c) => !FLAG_CODES.has(c));
    expect(missing).toEqual([]);
    const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
    for (const c of ['cs', 'yu']) expect(css).toMatch(new RegExp(`\\.f-${c}\\b`));
  });
});

describe('<PointsChip>, <Chip>, <Card>, <Stat>', () => {
  it('formats +N · reason with tone by sign', () => {
    const { container } = render(<><PointsChip points={8} reason="4s" /><PointsChip points={-12} reason="κλοπή" /><PointsChip points={0} /></>);
    const [gain, loss, zero] = container.querySelectorAll('.chip');
    expect(gain.textContent).toBe('+8· 4s');
    expect(gain.classList.contains('chip-ok')).toBe(true);
    expect(loss.textContent).toBe('−12· κλοπή');
    expect(loss.classList.contains('chip-bad')).toBe(true);
    expect(zero.className).toBe('chip');
    expect(formatPoints(3)).toBe('+3');
  });
  it('chip variants and live dot', () => {
    const { container } = render(<Chip variant="live" dot>Live</Chip>);
    const chip = container.querySelector('.chip')!;
    expect(chip.className).toBe('chip chip-live');
    expect(chip.querySelector('.dot')!.getAttribute('aria-hidden')).toBe('true');
  });
  it('card variants', () => {
    const { container } = render(<><Card pad>a</Card><Card variant="hero">b</Card><Card variant="link" href="/x">c</Card></>);
    expect(container.querySelector('div.card.card-pad')).not.toBeNull();
    expect(container.querySelector('div.card-hero')).not.toBeNull();
    expect(container.querySelector('a.card-link')!.getAttribute('href')).toBe('/x');
  });
  it('stat renders value and label', () => {
    const { container } = render(<Stat value="35" label="Χώρες" />);
    expect(container.querySelector('.stat .v.num')!.textContent).toBe('35');
    expect(container.querySelector('.stat .k')!.textContent).toBe('Χώρες');
  });
});
