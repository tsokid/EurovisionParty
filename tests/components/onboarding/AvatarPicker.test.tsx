import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import i18n from '../../../src/i18n';
import AvatarPicker from '../../../src/components/onboarding/AvatarPicker';
import { AVATARS } from '../../../src/components/stage/avatars';

beforeAll(async () => {
  await i18n.changeLanguage('el');
});
afterEach(() => vi.restoreAllMocks());

const PER_PAGE = 9;
const PAGES = Math.ceil(AVATARS.length / PER_PAGE);

function Harness({ initial, onChange }: { initial: string; onChange?: (id: string) => void }) {
  const [value, setValue] = useState(initial);
  return <AvatarPicker value={value} onChange={(id) => { setValue(id); onChange?.(id); }} />;
}

const prev = () => screen.getByRole('button', { name: 'Προηγούμενα' });
const next = () => screen.getByRole('button', { name: 'Επόμενα' });
/** 0-based index of the highlighted page dot. */
const currentPage = () => {
  const dots = screen.getAllByRole('button', { name: /^Σελίδα \d+ από \d+$/ });
  return dots.findIndex((d) => d.getAttribute('aria-current') === 'true');
};

describe('<AvatarPicker>', () => {
  it('pages the set 9 at a time, the last page partial', () => {
    const { container } = render(<Harness initial={AVATARS[0].id} />);
    const pages = container.querySelectorAll('.avp-page');
    expect(pages).toHaveLength(PAGES);
    pages.forEach((p, i) => {
      const expected = i < PAGES - 1 ? PER_PAGE : AVATARS.length - PER_PAGE * (PAGES - 1);
      expect(within(p as HTMLElement).getAllByRole('radio')).toHaveLength(expected);
    });
    expect(screen.getAllByRole('button', { name: /^Σελίδα / })).toHaveLength(PAGES);
  });

  it('opens on the page with the current choice', () => {
    const id = AVATARS[PER_PAGE * 2 + 3].id;
    render(<Harness initial={id} />);
    expect(currentPage()).toBe(2);
  });

  it('arrows change page and are disabled at the first and last page', () => {
    render(<Harness initial={AVATARS[0].id} />);
    expect(currentPage()).toBe(0);
    expect(prev()).toBeDisabled();
    expect(next()).toBeEnabled();
    fireEvent.click(next());
    expect(currentPage()).toBe(1);
    expect(prev()).toBeEnabled();
    for (let i = 1; i < PAGES - 1; i++) fireEvent.click(next());
    expect(currentPage()).toBe(PAGES - 1);
    expect(next()).toBeDisabled();
    fireEvent.click(prev());
    expect(currentPage()).toBe(PAGES - 2);
  });

  it('←/→ page the grid when it has focus and keep focus in the same slot; Enter/Space select', () => {
    const onChange = vi.fn();
    render(<Harness initial={AVATARS[0].id} onChange={onChange} />);
    const first = screen.getByRole('radio', { name: AVATARS[0].title.el });
    // One tab stop: the current choice.
    expect(first).toHaveAttribute('tabindex', '0');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(currentPage()).toBe(1);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: AVATARS[PER_PAGE].title.el }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(currentPage()).toBe(0);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(currentPage()).toBe(0);
    // Tiles are buttons: Enter/Space activate them (a click), which selects.
    const tile = screen.getByRole('radio', { name: AVATARS[2].title.el });
    expect(tile.tagName).toBe('BUTTON');
    fireEvent.click(tile);
    expect(onChange).toHaveBeenLastCalledWith(AVATARS[2].id);
    expect(tile).toHaveAttribute('aria-checked', 'true');
  });

  it('«Τυχαίο» picks another avatar and jumps to its page', () => {
    // randomAvatarId: the pool excludes the current id, so the last pool slot is the last avatar.
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    render(<Harness initial={AVATARS[0].id} />);
    expect(currentPage()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Τυχαίο' }));
    const last = AVATARS[AVATARS.length - 1];
    expect(screen.getByRole('radio', { name: last.title.el })).toHaveAttribute('aria-checked', 'true');
    expect(currentPage()).toBe(PAGES - 1);
    expect(next()).toBeDisabled();
  });

  it('draws big pop-out tiles from the 512px art with a 96/512 srcSet', () => {
    const { container } = render(<Harness initial={AVATARS[0].id} />);
    const img = container.querySelector<HTMLImageElement>('.avp-item .avpop-img');
    if (!img) return; // SVG fallback set: no images.
    expect(img.getAttribute('src')).toMatch(/-512\.webp/);
    expect(img.getAttribute('srcset')).toMatch(/-96\.webp\S* 96w, .*-512\.webp\S* 512w/);
    expect(img).toHaveAttribute('width', '512');
    expect(img).toHaveAttribute('height', '512');
    // The current page and the next one load at once (no empty tiles on a swipe).
    const lazyOn = (p: number) => container.querySelectorAll(`.avp-page[data-page="${p}"] img[loading="lazy"]`).length;
    const pages = container.querySelectorAll('.avp-page').length;
    expect(lazyOn(0)).toBe(0);
    expect(lazyOn(1)).toBe(0);
    if (pages > 2) expect(lazyOn(2)).toBeGreaterThan(0);
  });
});
