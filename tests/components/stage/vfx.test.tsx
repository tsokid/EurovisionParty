// Task 8: stage VFX engine and component.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { VfxEngine, particleCap } from '../../../src/components/stage/vfx/engine';
import { runPreset, VFX_PRESETS } from '../../../src/components/stage/vfx/presets';

const reduced = vi.hoisted(() => ({ value: true }));
const loads = vi.hoisted(() => ({ n: 0 }));
vi.mock('framer-motion', async (orig) => {
  const mod = await orig<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => reduced.value };
});
vi.mock('../../../src/components/stage/vfx/runtime', async (orig) => {
  loads.n += 1;
  return orig();
});

import { StageVfx, type StageVfxHandle } from '../../../src/components/stage/vfx';

const rig = (opts: { reduced?: boolean; max?: number } = {}) => {
  const back = new VfxEngine(null, { max: opts.max ?? 2000, reduced: opts.reduced, headless: true }, { w: 390, h: 680 });
  const front = new VfxEngine(null, { max: opts.max ?? 2000, reduced: opts.reduced, headless: true }, { w: 390, h: 680 });
  return { back, front, box: () => null };
};
const run = (r: ReturnType<typeof rig>, ms: number) => {
  const t0 = performance.now();
  for (let t = 0; t <= ms; t += 16) { r.back.step(t0 + t); r.front.step(t0 + t); }
};

afterEach(() => { reduced.value = true; });

describe('particle budget (owner rule)', () => {
  it('900 on phones, 2000 on desktop, fewer on ≤ 4 cores', () => {
    expect(particleCap({ phone: true, cores: 8 })).toBe(900);
    expect(particleCap({ phone: false, cores: 8 })).toBe(2000);
    expect(particleCap({ phone: true, cores: 4 })).toBeLessThan(900);
  });

  it('a full winner rig never exceeds the cap', () => {
    const r = rig({ max: 300 });
    runPreset(r, 'winner');
    let peak = 0;
    const t0 = performance.now();
    for (let t = 0; t <= 3000; t += 16) {
      r.back.step(t0 + t); r.front.step(t0 + t);
      peak = Math.max(peak, r.back.parts.length, r.front.parts.length);
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(300);
  });

  it('every preset runs headless and burns out', () => {
    for (const p of VFX_PRESETS) {
      const r = rig();
      runPreset(r, p, { place: 2 });
      run(r, 12000);
      expect(r.back.fx.length + r.front.fx.length + r.back.parts.length + r.front.parts.length).toBe(0);
    }
  });
});

describe('reduced motion produces no particles', () => {
  it('engine: a reduced engine spawns nothing for any preset', () => {
    for (const p of [...VFX_PRESETS, 'reelIntro', 'reelClash', 'finaleSpot'] as const) {
      const r = rig({ reduced: true });
      runPreset(r, p);
      run(r, 1500);
      expect(r.back.parts.length + r.front.parts.length).toBe(0);
      expect(r.back.fx.length + r.front.fx.length).toBe(0);
    }
  });

  it('component: no canvas, no engine chunk, a soft static glow only', () => {
    reduced.value = true;
    const before = loads.n;
    const ref = createRef<StageVfxHandle>();
    const { container } = render(<div style={{ position: 'relative' }}><StageVfx ref={ref} /></div>);
    expect(container.querySelector('canvas')).toBeNull();
    act(() => ref.current!.fire('winner'));
    expect(screen.getByTestId('vfx-static-glow')).toBeTruthy();
    expect(container.querySelector('canvas')).toBeNull();
    expect(loads.n).toBe(before);
    act(() => ref.current!.clear());
    expect(screen.queryByTestId('vfx-static-glow')).toBeNull();
  });

  it('component with motion renders the two screen-blended layers', () => {
    reduced.value = false;
    const { container } = render(<div><StageVfx /></div>);
    expect(container.querySelectorAll('canvas.svfx')).toHaveLength(2);
    expect(screen.queryByTestId('vfx-static-glow')).toBeNull();
  });
});

describe('pause while the tab is hidden', () => {
  it('setPaused stops the loop and resumes it', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
    const caf = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const cv = document.createElement('canvas');
    const e = new VfxEngine(cv, { max: 100, noGL: true }, { w: 100, h: 100 });
    e.burst(50, 50);
    expect(raf).toHaveBeenCalledTimes(1);
    e.setPaused(true);
    expect(caf).toHaveBeenCalled();
    raf.mockClear();
    e.burst(10, 10);
    expect(raf).not.toHaveBeenCalled();
    e.setPaused(false);
    expect(raf).toHaveBeenCalledTimes(1);
    raf.mockRestore(); caf.mockRestore();
  });
});
