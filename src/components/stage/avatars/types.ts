// Shape of one avatar in the Stage set: a recipe of layered parts that
// AvatarArt.tsx draws as inline SVG.

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
