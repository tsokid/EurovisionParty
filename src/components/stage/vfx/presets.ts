// Stage VFX presets — the rigs from the approved motion prototypes, with the
// prototype's fixed coordinates replaced by real DOM targets.
//
//   winner    reel "peak" at full power (6/4 gerbs, 4 sweeping movers, flash
//             bulb, anamorphic streak, glitter) on the champion
//   reelPeak  the reel's final-rank hit; full rig for #1, a lighter one below
//   roundEnd  quiz round end: a key spot finds your row, then a cold-spark crackle
//   duelWin   duel result: key spot on the winner, two small gerbs + a burst
//   overtake  a subtle cold-spark crackle at the overtaking row's chip
// and the reel/finale beats (reelIntro … titleHit) used by the sequences.

import type { Rgb, VfxEngine } from './engine';

export const VFX_PRESETS = ['winner', 'reelPeak', 'roundEnd', 'duelWin', 'overtake'] as const;
export type VfxPreset =
  | (typeof VFX_PRESETS)[number]
  | 'reelIntro' | 'reelBoom0' | 'reelBoom' | 'reelClash' | 'reelHit' | 'reelRig' | 'reelBuild' | 'reelSummary'
  | 'finaleSpot' | 'titleHit';

export interface PresetOpts {
  /** Element the effect aims at (centre of its box). */
  target?: Element | null;
  /** Second target where a rig has two (roundEnd: the row's right edge is derived). */
  place?: number;
}

export interface Rig {
  back: VfxEngine;
  front: VfxEngine;
  /** The canvas element (both layers share the box). */
  box: () => DOMRect | null;
}

const WARM: Rgb = [1, 0.93, 0.84];
const LILAC: Rgb = [0.74, 0.62, 1];
const PINK: Rgb = [1, 0.45, 0.74];

interface Pt { x: number; y: number; w: number; h: number }

function locate(rig: Rig, el: Element | null | undefined, fx: number, fy: number): Pt {
  const c = rig.box();
  if (!el || !c || !c.width) return { x: fx, y: fy, w: 0, h: 0 };
  const r = el.getBoundingClientRect();
  const sx = rig.back.W / c.width, sy = rig.back.H / c.height;
  return { x: (r.left + r.width / 2 - c.left) * sx, y: (r.top + r.height / 2 - c.top) * sy, w: r.width * sx, h: r.height * sy };
}

export function runPreset(rig: Rig, kind: VfxPreset, o: PresetOpts = {}) {
  const B = rig.back, F = rig.front, W = B.W, H = B.H;
  if (!W || !H) return;
  const desk = W >= 900;
  const s = desk ? 1.35 : 1;
  const spot = (tx: number, ty: number, p: { key: number; a: number; fin?: number; dur: number; sw?: number }) => {
    B.beam({ ox: tx, oy: -40 * s, tx, ty, w0: 5 * s, w1: p.key * s, a: p.a, col: WARM, fadeIn: p.fin || 300, dur: p.dur, fadeOut: 500, pool: 0.45, reach: 1.5 });
    B.beam({ ox: -30 * s, oy: -50 * s, tx: tx - 10 * s, ty: ty + 30 * s, sweep: -34, sweepMs: p.sw || 1400, w0: 4 * s, w1: 64 * s, a: p.a * 0.75, col: LILAC, fadeIn: 200, dur: p.dur, fadeOut: 500, wob: 1.5 });
    B.beam({ ox: W + 30 * s, oy: -50 * s, tx: tx + 10 * s, ty: ty + 30 * s, sweep: 34, sweepMs: p.sw || 1400, w0: 4 * s, w1: 64 * s, a: p.a * 0.75, col: PINK, fadeIn: 200, dur: p.dur, fadeOut: 500, wob: 1.5 });
  };
  const pair = (h: number, dur: number, rate: number) => {
    B.gerb(W * 0.09, H + 2, { h, dur, rate });
    B.gerb(W * 0.91, H + 2, { h, dur, rate, delay: 40 });
  };
  const peak = (c: Pt, place: number) => {
    const win = place === 1, q = win ? 1 : 0.55;
    const tint: Rgb = place === 1 ? [1, 0.78, 0.36] : place === 2 ? [0.86, 0.88, 1] : [1, 0.66, 0.44];
    F.flash({ a: 0.8 * q, tau: 110, x: c.x, y: c.y });
    F.flare(c.x, c.y, { a: 1.1 * q, dur: 900, len: W * 0.95 });
    const xs = win ? (desk ? [0.05, 0.2, 0.35, 0.65, 0.8, 0.95] : [0.07, 0.33, 0.67, 0.93]) : [0.09, 0.91];
    xs.forEach((x, i) => B.gerb(W * x, H + 2, { h: H * (0.64 + 0.08 * ((i + 1) % 2)), dur: win ? 2300 : 1300, rate: desk ? 170 : 120, delay: Math.abs(x - 0.5) * 260 }));
    const bx = desk ? [0.04, 0.3, 0.7, 0.96] : [0.02, 0.3, 0.7, 0.98];
    const bc = [LILAC, WARM, WARM, PINK];
    for (let i = 0; i < (win ? 4 : 2); i++) {
      const k = win ? i : i * 3;
      B.beam({ ox: W * bx[k], oy: -50 * s, tx: c.x + (bx[k] - 0.5) * 40 * s, ty: c.y + 20 * s, sweep: (bx[k] < 0.5 ? -1 : 1) * 38, sweepMs: 950, w0: 4.5 * s, w1: (desk ? 110 : 80) * s, a: 0.85 * q, col: bc[k], fadeIn: 120, dur: 3500, fadeOut: 900, wob: 1.2, pool: 0.25 });
    }
    B.haze({ a: 0.26, fadeIn: 250, dur: 3600, fadeOut: 900 });
    B.light(c.x, c.y + 30 * s, { r: (desk ? 420 : 250) * s, col: tint, a: 0.3 * q, fadeIn: 150, dur: 3500, fadeOut: 900, pulse: 0.1 });
    F.light(c.x, c.y, { r: (desk ? 260 : 150) * s, col: tint, a: 0.1 * q, fadeIn: 100, dur: 1800, fadeOut: 700 });
    F.glitter({ n: win ? (desk ? 120 : 55) : (desk ? 50 : 24), dur: 8000 });
  };

  switch (kind) {
    case 'winner':
      peak(locate(rig, o.target, W / 2, H * 0.46), 1);
      break;
    case 'reelPeak':
      peak(locate(rig, o.target, W / 2, H * 0.46), o.place ?? 1);
      break;
    case 'reelIntro': {
      const h = locate(rig, o.target, W / 2, H * 0.45);
      B.haze({ a: 0.2, fadeIn: 900, dur: 2300, fadeOut: 400 });
      spot(h.x, h.y - 30 * s, { key: desk ? 150 : 118, a: 0.95, fin: 700, dur: 2300 });
      B.light(h.x, h.y - 20 * s, { r: (desk ? 300 : 190) * s, col: [0.8, 0.6, 1], a: 0.35, fadeIn: 800, dur: 2300, fadeOut: 400 });
      break;
    }
    case 'reelBoom0': {
      const h = locate(rig, o.target, W / 2, H * 0.45);
      F.flash({ a: 0.5, tau: 110 });
      F.flare(h.x, h.y - 60 * s, { a: 0.85, dur: 850 });
      if (desk) [0.06, 0.22, 0.78, 0.94].forEach((x, i) => B.gerb(W * x, H + 2, { h: H * 0.64, dur: 1250, rate: 190, delay: i * 50 }));
      else pair(H * 0.6, 1250, 170);
      break;
    }
    case 'reelBoom':
      F.flash({ a: 0.28, tau: 90 });
      pair(H * 0.46, 650, desk ? 200 : 150);
      break;
    case 'reelClash':
      F.flash({ a: 0.3, tau: 90 });
      F.burst(W / 2, H * 0.44, { n: desk ? 90 : 60, speed: desk ? 700 : 520, life: 0.8 });
      break;
    case 'reelHit':
    case 'titleHit':
      F.flash({ a: 0.14, tau: 80 });
      break;
    case 'reelRig':
      spot(W / 2, H * 0.44, { key: desk ? 160 : 110, a: 0.7, dur: 2500 });
      break;
    case 'reelBuild':
      B.haze({ a: 0.22, fadeIn: 1500, dur: 3400, fadeOut: 150 });
      B.beam({ ox: W / 2, oy: -40 * s, tx: W / 2, ty: H * 0.5, w0: 5 * s, w1: (desk ? 170 : 120) * s, a: 0.75, col: WARM, fadeIn: 3000, dur: 3400, fadeOut: 150, pool: 0.4, reach: 1.5 });
      break;
    case 'reelSummary': {
      const a = locate(rig, o.target, W / 2, H * 0.25);
      B.light(a.x, a.y, { r: (desk ? 260 : 150) * s, col: [1, 0.78, 0.4], a: 0.35, fadeIn: 500, dur: 2600, fadeOut: 500 });
      break;
    }
    case 'finaleSpot': {
      // The stage dims and a key spot sweeps in across the room onto the title area.
      const c = locate(rig, o.target, W / 2, H * 0.42);
      B.haze({ a: 0.22, fadeIn: 800, dur: 9000, fadeOut: 900 });
      B.beam({ ox: W * 0.15, oy: -50 * s, tx: c.x, ty: c.y, sweep: -48, sweepMs: 1600, w0: 5 * s, w1: (desk ? 150 : 110) * s, a: 0.8, col: WARM, fadeIn: 300, dur: 9000, fadeOut: 900, pool: 0.35, reach: 1.5, wob: 1.2 });
      break;
    }
    case 'roundEnd': {
      const r = locate(rig, o.target, W * 0.3, H * 0.5);
      const left = r.w ? r.x - r.w / 2 + 30 : W * 0.12;
      const right = r.w ? r.x + r.w / 2 - 70 : W * 0.78;
      B.beam({ ox: W * 0.85, oy: -30, tx: r.x - (r.w ? r.w * 0.2 : 0), ty: r.y, sweep: 22, sweepMs: 600, w0: 4, w1: 70, a: 0.8, col: WARM, fadeIn: 200, dur: 2600, fadeOut: 900, pool: 0.45, reach: 1.9 });
      F.burst(left, r.y, { n: 26, speed: 340, up: 0.55, life: 0.7, size: 0.9, glow: 0.5, delay: 650 });
      F.burst(right, r.y - 12, { n: 16, speed: 280, up: 0.6, life: 0.6, size: 0.8, glow: 0.3, delay: 710 });
      F.light(left + 20, r.y, { r: 120, col: [1, 0.8, 0.45], a: 0.22, fadeIn: 60, dur: 1300, fadeOut: 800, delay: 650 });
      break;
    }
    case 'duelWin': {
      const a = locate(rig, o.target, W * 0.23, H * 0.1);
      const floor = a.h ? a.y + a.h / 2 + 140 : H * 0.37;
      B.beam({ ox: a.x + 62, oy: -60, tx: a.x, ty: a.y, sweep: 26, sweepMs: 650, w0: 4, w1: 62, a: 0.7, col: WARM, fadeIn: 150, dur: 3000, fadeOut: 1000, pool: 0.1, reach: 2.6 });
      F.gerb(a.x - 50, floor, { h: 150, dur: 700, rate: 110, spread: 7, size: 0.85 });
      F.gerb(a.x + 50, floor, { h: 150, dur: 700, rate: 110, spread: 7, size: 0.85, delay: 50 });
      F.burst(a.x, floor - 18, { n: 22, speed: 300, up: 0.7, life: 0.6, size: 0.8, glow: 0.35, delay: 60 });
      F.light(a.x, a.y + 6, { r: 110, col: [1, 0.74, 0.34], a: 0.13, fadeIn: 120, dur: 2200, fadeOut: 900 });
      break;
    }
    case 'overtake': {
      const c = locate(rig, o.target, W / 2, H / 2);
      F.burst(c.x, c.y, { n: 16, speed: 300, up: 0.45, life: 0.55, size: 0.9, bright: 0.85, glow: 0.5 });
      break;
    }
  }
}
