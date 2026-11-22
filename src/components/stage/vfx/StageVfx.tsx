import { useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import type { PresetOpts, VfxPreset } from './presets';
import type { VfxEngine } from './engine';

type Runtime = typeof import('./runtime');

let runtimePromise: Promise<Runtime> | null = null;
/** The engine chunk, fetched once and only by game screens that mount <StageVfx>. */
export function loadVfxRuntime(): Promise<Runtime> {
  if (!runtimePromise) runtimePromise = import('./runtime');
  return runtimePromise;
}

export interface StageVfxHandle {
  /** Fire a preset. Under reduced motion this shows a soft static glow instead. */
  fire: (preset: VfxPreset, opts?: PresetOpts) => void;
  /** Stop and clear everything (Skip, replay, scene cut). */
  clear: () => void;
}

export interface StageVfxProps {
  ref?: Ref<StageVfxHandle>;
  /** 'both' renders a back layer (beams, haze, gerbs, behind the content)
   *  and a front layer (flash bulb, flare, glitter, bursts). */
  layers?: 'front' | 'both';
  className?: string;
  /** z-index of the front layer (the back layer is always 0). */
  frontZ?: number;
}

function isPhone(w: number, h: number): boolean {
  if (typeof window === 'undefined') return true;
  const narrow = window.innerWidth < 768;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return narrow || coarse || w * h < 400000;
}

/**
 * Realistic Eurovision stage VFX (owner decision: no confetti). Two
 * absolutely positioned canvases composited with `mix-blend-mode: screen`.
 * The WebGL/Canvas2D engine is a lazily loaded chunk; the loop pauses
 * while the tab is hidden; reduced motion never loads it and shows a soft
 * static glow only.
 */
export function StageVfx({ ref, layers = 'both', className, frontZ = 8 }: StageVfxProps) {
  const reduce = useReducedMotion() ?? false;
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const engines = useRef<{ back: VfxEngine; front: VfxEngine } | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const queue = useRef<[VfxPreset, PresetOpts | undefined][]>([]);
  const [glow, setGlow] = useState<{ x: number; y: number; key: number } | null>(null);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostRef = useRef<HTMLSpanElement>(null);

  const size = () => {
    const c = frontRef.current;
    return c ? { w: Math.max(1, Math.round(c.clientWidth)), h: Math.max(1, Math.round(c.clientHeight)) } : { w: 1, h: 1 };
  };

  const ensure = useCallback((): { back: VfxEngine; front: VfxEngine } | null => {
    if (engines.current) return engines.current;
    const rt = runtime.current;
    const fc = frontRef.current;
    if (!rt || !fc) return null;
    const { w, h } = size();
    fc.width = w; fc.height = h;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
    // One budget for the whole rig, split between the layers.
    const cap = rt.particleCap({ phone: isPhone(w, h), cores });
    const front = new rt.VfxEngine(fc, { max: layers === 'both' ? Math.round(cap * 0.5) : cap });
    let back = front;
    const bc = backRef.current;
    if (layers === 'both' && bc) {
      bc.width = w; bc.height = h;
      back = new rt.VfxEngine(bc, { max: cap - front.max });
    }
    engines.current = { back, front };
    if (typeof document !== 'undefined' && document.hidden) { back.setPaused(true); front.setPaused(true); }
    return engines.current;
  }, [layers]);

  const run = useCallback((preset: VfxPreset, opts?: PresetOpts) => {
    const e = ensure();
    const rt = runtime.current;
    if (!e || !rt) return false;
    rt.runPreset({ back: e.back, front: e.front, box: () => frontRef.current?.getBoundingClientRect() ?? null }, preset, opts);
    return true;
  }, [ensure]);

  // Load the engine chunk once this game screen mounts (never under reduced motion).
  useEffect(() => {
    if (reduce) return;
    let alive = true;
    void loadVfxRuntime().then((rt) => {
      if (!alive) return;
      runtime.current = rt;
      const q = queue.current.splice(0);
      for (const [p, o] of q) run(p, o);
    }).catch(() => { /* no VFX — the moment still plays */ });
    return () => { alive = false; };
  }, [reduce, run]);

  // Pause while hidden.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      const e = engines.current; if (!e) return;
      e.back.setPaused(document.hidden); e.front.setPaused(document.hidden);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Keep canvas px = CSS px.
  useEffect(() => {
    const fc = frontRef.current;
    if (!fc || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const e = engines.current; if (!e) return;
      const { w, h } = size();
      if (e.front.W === w && e.front.H === h) return;
      for (const [c, en] of [[frontRef.current, e.front], [backRef.current, e.back]] as const) {
        if (c && en.cv === c) { c.width = w; c.height = h; en.resize(w, h); }
      }
    });
    ro.observe(fc);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    const e = engines.current;
    if (e) { e.front.destroy(); if (e.back !== e.front) e.back.destroy(); }
    engines.current = null;
    if (glowTimer.current) clearTimeout(glowTimer.current);
  }, []);

  useImperativeHandle(ref, () => ({
    fire(preset, opts) {
      if (reduce) {
        // Reduced motion: a soft static glow where the moment happens, nothing moves.
        const host = hostRef.current?.parentElement?.getBoundingClientRect();
        const t = opts?.target?.getBoundingClientRect();
        const x = host && t && host.width ? ((t.left + t.width / 2 - host.left) / host.width) * 100 : 50;
        const y = host && t && host.height ? ((t.top + t.height / 2 - host.top) / host.height) * 100 : 45;
        if (preset === 'reelHit' || preset === 'titleHit' || preset === 'reelBoom' || preset === 'reelClash') return;
        setGlow({ x, y, key: Date.now() });
        if (glowTimer.current) clearTimeout(glowTimer.current);
        glowTimer.current = setTimeout(() => setGlow(null), 2600);
        return;
      }
      if (!run(preset, opts)) queue.current.push([preset, opts]);
    },
    clear() {
      queue.current = [];
      setGlow(null);
      const e = engines.current;
      if (e) { e.front.clear(); if (e.back !== e.front) e.back.clear(); }
    },
  }), [reduce, run]);

  const glowStyle: CSSProperties | undefined = glow ? { left: `${glow.x}%`, top: `${glow.y}%` } : undefined;
  return (
    <>
      <span ref={hostRef} hidden />
      {layers === 'both' && !reduce && <canvas ref={backRef} className={clsx('svfx', className)} style={{ zIndex: 0 }} aria-hidden="true" data-vfx-layer="back" />}
      {!reduce && <canvas ref={frontRef} className={clsx('svfx', className)} style={{ zIndex: frontZ }} aria-hidden="true" data-vfx-layer="front" />}
      {reduce && glow && <span key={glow.key} className="svfx-glow" style={glowStyle} aria-hidden="true" data-testid="vfx-static-glow" />}
    </>
  );
}
