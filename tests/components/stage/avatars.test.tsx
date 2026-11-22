import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AVATARS, ALL_AVATARS, SVG_AVATARS, IMAGE_AVATARS, AVATAR_IDS, AvatarArt, getAvatar, randomAvatarId } from '../../../src/components/stage/avatars';
import { Avatar } from '../../../src/components/stage';

// Greek articles / pronouns that would encode a player's gender.
const GENDERED = /(^|\s)(ο|η|τον|την|του|της|αυτός|αυτή|αυτόν|αυτήν)(\s|$)/i;

describe('avatar registry', () => {
  it('has at least 24 SVG avatars with unique av-NN ids and unique ids overall', () => {
    expect(SVG_AVATARS.length).toBeGreaterThanOrEqual(24);
    for (const a of SVG_AVATARS) expect(a.id).toMatch(/^av-\d{2}$/);
    expect(new Set(ALL_AVATARS.map((a) => a.id)).size).toBe(ALL_AVATARS.length);
    expect(new Set(AVATAR_IDS).size).toBe(AVATARS.length);
  });

  it('offers the owner artwork first (img-NN, 96 + 512 WebP), SVGs stay registered as fallback', () => {
    const visible = IMAGE_AVATARS.filter((a) => !a.hidden);
    if (visible.length) expect(AVATARS).toEqual(visible);
    else expect(AVATARS).toEqual(SVG_AVATARS);
    for (const a of IMAGE_AVATARS) {
      expect(a.id).toMatch(/^img-[a-z0-9-]+$/);
      expect(a.thumb.startsWith(`/avatars/${a.id}-96.webp`)).toBe(true);
      expect(a.full.startsWith(`/avatars/${a.id}-512.webp`)).toBe(true);
    }
    for (const a of SVG_AVATARS) expect(getAvatar(a.id)).toBeDefined();
  });

  it('every avatar has distinct Greek and English titles, gender-neutral in Greek', () => {
    expect(new Set(ALL_AVATARS.map((a) => a.title.el)).size).toBe(ALL_AVATARS.length);
    expect(new Set(ALL_AVATARS.map((a) => a.title.en)).size).toBe(ALL_AVATARS.length);
    for (const a of ALL_AVATARS) {
      expect(a.title.el.trim()).not.toBe('');
      expect(a.title.en.trim()).not.toBe('');
      expect(a.title.el, a.id).not.toMatch(GENDERED);
    }
  });

  it('no two avatars share the same recipe', () => {
    const keys = SVG_AVATARS.map((a) => JSON.stringify({ ...a, id: '', title: '' }));
    expect(new Set(keys).size).toBe(SVG_AVATARS.length);
  });

  it.each(SVG_AVATARS.map((a) => [a.id, a] as const))('%s renders an inline SVG with no external images', (_id, spec) => {
    const { container } = render(<AvatarArt spec={spec} size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('data-avatar-art')).toBe(spec.id);
    expect(svg!.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(container.querySelectorAll('path, circle, ellipse, rect').length).toBeGreaterThan(10);
    expect(container.querySelector('image, img')).toBeNull();
  });

  it('two instances on a page get distinct clip ids', () => {
    const { container } = render(<><AvatarArt spec={SVG_AVATARS[0]} /><AvatarArt spec={SVG_AVATARS[0]} /></>);
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('randomAvatarId returns a registry id other than the excluded one', () => {
    for (let i = 0; i < 50; i++) {
      const id = randomAvatarId(AVATAR_IDS[0]);
      expect(getAvatar(id)).toBeDefined();
      expect(id).not.toBe(AVATAR_IDS[0]);
    }
    expect(randomAvatarId(null, () => 0)).toBe(AVATAR_IDS[0]);
    expect(randomAvatarId(null, () => 0.9999)).toBe(AVATAR_IDS[AVATAR_IDS.length - 1]);
  });
});

describe('<Avatar> with the registry', () => {
  it('renders the art for a registry id, initials otherwise', () => {
    const { container } = render(
      <>
        <Avatar name="Πούλια" avatarId="av-05" size="xl" />
        <Avatar name="Πούλια" avatarId="nope" />
        <Avatar name="Πούλια" />
      </>,
    );
    const [art, unknown, none] = container.querySelectorAll<HTMLElement>('.avatar');
    expect(art.querySelector('svg[data-avatar-art="av-05"]')).not.toBeNull();
    expect(art.classList.contains('avatar-xl')).toBe(true);
    expect(art.textContent).toBe('');
    expect(unknown.querySelector('svg')).toBeNull();
    expect(unknown.textContent).toBe('ΠΟ');
    expect(none.textContent).toBe('ΠΟ');
  });

  it('is labelled with the stage name when not decorative', () => {
    const { getByRole } = render(<Avatar name="Ντίσκο" avatarId="av-02" decorative={false} />);
    expect(getByRole('img', { name: 'Ντίσκο' })).toBeInTheDocument();
  });
});
