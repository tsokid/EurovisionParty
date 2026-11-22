// Shape of one avatar in the Stage set. Two kinds share one id space:
// - code-built SVG: a recipe of layered parts that AvatarArt.tsx draws inline;
// - image: owner artwork imported by scripts/avatars/import-avatars.ts into
//   public/avatars/ (96px thumb + 512px full WebP).

export type HairStyle =
  | 'beehive' | 'tower' | 'afro' | 'curls' | 'long' | 'waves' | 'bob'
  | 'buns' | 'ponytail' | 'flame' | 'pompadour' | 'mohawk' | 'bald';

export type HeadStyle =
  | 'crown' | 'tiara' | 'plume' | 'star' | 'horns' | 'halo' | 'flowers'
  | 'tophat' | 'discoball' | 'cowboy' | 'moon' | 'bow' | 'antenna' | 'none';

export type EyeStyle = 'lashes' | 'wink' | 'glitter' | 'cateye' | 'heart' | 'star' | 'round' | 'visor' | 'mask';

export type MouthStyle = 'lips' | 'smile' | 'sing' | 'smirk';

export type CollarStyle = 'sequins' | 'pads' | 'boa' | 'ruff' | 'cape' | 'pearls' | 'lapels' | 'stars';

export type AvatarExtra = 'mole' | 'starpaint' | 'tear' | 'gem' | 'earrings' | 'drops';

export interface AvatarSpec {
  kind?: 'svg';
  /** Stable id stored in players.avatar_id: 'av-01' … */
  id: string;
  /** Playful titles. Greek ones are gender-neutral: no articles or gendered adjectives about the player. */
  title: { el: string; en: string };
  /** Radial background: centre, edge. */
  bg: [string, string];
  skin: string;
  hair: { style: HairStyle; color: string };
  /** Arched brows; off when glasses or a mask cover that area. Default true. */
  brows?: boolean;
  /** For lash styles `color` is the eyeshadow; for glasses/visor/mask it is the lens or mask. */
  eyes: { style: EyeStyle; color: string };
  lips: { style: MouthStyle; color: string };
  head?: { style: HeadStyle; color: string; accent?: string };
  collar: { style: CollarStyle; color: string; accent?: string };
  extras?: AvatarExtra[];
  /** Twinkles in the background. */
  sparkles?: boolean;
}

/** Owner artwork (see scripts/avatars/import-avatars.ts). */
export interface ImageAvatarSpec {
  kind: 'image';
  /** Stable id stored in players.avatar_id. Reusing an SVG id ('av-05') replaces that art. */
  id: string;
  /** From the file name; Greek allowed, gender-neutral like the SVG titles. */
  title: { el: string; en: string };
  /** 96×96 WebP, for every in-game avatar (≤ 48 CSS px at DPR 2). */
  thumb: string;
  /** 512×512 WebP, for the avatar viewer (up to 320 CSS px). */
  full: string;
  /** Registered (rows that use it still render) but not offered in the picker. */
  hidden?: boolean;
}

/** Any avatar in the registry. */
export type AvatarEntry = AvatarSpec | ImageAvatarSpec;

export function isImageAvatar(a: AvatarEntry | null | undefined): a is ImageAvatarSpec {
  return !!a && a.kind === 'image';
}
