// Stage VFX engine — a TypeScript port of the approved motion prototypes
// (docs/design/stage/motion-*.dc.html, block VFX:BEGIN…VFX:END).
//
// Procedural, no assets: cold-spark gerbs, volumetric beams through haze,
// a flash bulb, an anamorphic streak, glitter glints and bloom. WebGL draws
// every primitive as one additive quad batch with one shader; Canvas2D
// ('lighter' compositing) is the fallback. The canvas is opaque black and is
// composited with CSS `mix-blend-mode: screen`, so black = no light.
//
// Loaded only through a dynamic import (StageVfx.tsx), so public pages never
// ship it. This file must not import React or anything app-specific.

export type Rgb = [number, number, number];

const VS = 'attribute vec2 aP;attribute vec2 aL;attribute vec4 aC;attribute vec4 aE;uniform vec2 uR;varying vec2 vL;varying vec4 vC;varying vec4 vE;varying vec2 vP;void main(){vL=aL;vC=aC;vE=aE;vP=aP;vec2 c=aP/uR*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);}';
const FS = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
  'uniform float uT;varying vec2 vL;varying vec4 vC;varying vec4 vE;varying vec2 vP;',
  'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
  'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1.0,0.0)),f.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),f.x),f.y);}',
  'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*n(p);p=p*2.07+vec2(5.3,1.7);a*=0.5;}return v;}',
  'void main(){float k=vE.x,I=0.0;',
  // 0 glow sprite: hot core + soft halo
  'if(k<0.5){float r2=dot(vL,vL);if(r2>=1.0)discard;I=vE.y*exp(-r2*30.0)+vE.z*exp(-r2*4.5)*(1.0-r2);}',
  // 1 motion-blurred streak: tail (u=-1) -> head (u=+1)
  'else if(k<1.5){float u=vL.x,v=vL.y;float ac=exp(-v*v*6.0)*(1.0-v*v);float al=smoothstep(-1.0,0.75,u)*(1.0-smoothstep(0.82,1.0,u)*0.7);I=ac*al*(1.0+exp(-v*v*36.0)*0.9);}',
  // 2 volumetric beam through drifting haze
  'else if(k<2.5){float t=vL.x;float w=mix(vE.y,vE.z,t);float a=vL.y/w;float hz=fbm(vP*0.0075+vec2(uT*0.03,-uT*0.055));I=exp(-a*a*2.4)*(0.3+0.7*exp(-t*1.5))*smoothstep(0.0,0.03,t)*smoothstep(1.0,0.5,t)*(0.22+1.9*hz*hz);I+=exp(-a*a*20.0)*0.45*exp(-t*2.6);}',
  // 3 flat full-frame flash
  'else if(k<3.5){I=1.0;}',
  // 4 ambient haze
  'else if(k<4.5){float hz=fbm(vP*0.0032+vec2(uT*0.018,uT*0.01));I=hz*hz*(0.35+0.65*vL.y);}',
  // 5 anamorphic streak, symmetric
  'else{float u=vL.x,v=vL.y;I=exp(-v*v*5.0)*(1.0-v*v)*(exp(-abs(u)*2.6)*0.7+exp(-abs(u)*14.0));}',
  'gl_FragColor=vec4(vC.rgb*vC.a*I,1.0);}',
].join('\n');

function hash(i: number) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/** Owner rule: at most 900 particles on phones and 2000 on desktop; fewer on ≤ 4-core devices. */
export function particleCap(opts: { phone: boolean; cores?: number }): number {
  const base = opts.phone ? 900 : 2000;
  return Math.round(base * ((opts.cores ?? 4) <= 4 ? 0.6 : 1));
}

interface Spark { k: 0; x: number; y: number; vx: number; vy: number; age: number; life: number; g: number; drag: number; sz: number; br: number; sd: number }
interface Glint { k: 1; x: number; y: number; vx: number; vy: number; age: number; life: number; ph: number; rate: number; sw: number; sz: number; col: Rgb; sd: number }
type Particle = Spark | Glint;

export interface BeamOpts { ox: number; oy: number; tx: number; ty: number; w0: number; w1: number; a: number; col?: Rgb; sweep?: number; sweepMs?: number; wob?: number; pool?: number; reach?: number; fadeIn?: number; dur?: number; fadeOut?: number; delay?: number }
export interface GerbOpts { h?: number; dur?: number; rate?: number; spread?: number; size?: number; bright?: number; delay?: number }
export interface BurstOpts { n?: number; speed?: number; up?: number; life?: number; size?: number; bright?: number; glow?: number; delay?: number }
export interface LightOpts { r: number; col?: Rgb; a: number; core?: number; halo?: number; pulse?: number; fadeIn?: number; dur?: number; fadeOut?: number; delay?: number }
export interface FlashOpts { a?: number; tau?: number; col?: Rgb; x?: number; y?: number; delay?: number }
export interface FlareOpts { a?: number; dur?: number; len?: number; delay?: number }
export interface HazeOpts { a: number; col?: Rgb; fadeIn?: number; dur?: number; fadeOut?: number; delay?: number }
export interface GlitterOpts { n?: number; dur?: number; x0?: number; x1?: number | null; delay?: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fx = Record<string, any> & { type: string; t0: number; done?: boolean };

export interface VfxEngineOptions {
  /** Max live particles (see particleCap). */
  max: number;
  /** Reduced motion: the engine spawns nothing at all. */
  reduced?: boolean;
  /** Test hook: no renderer, effects and particles still simulate. */
  headless?: boolean;
  /** Force the Canvas2D fallback. */
  noGL?: boolean;
}

export class VfxEngine {
  readonly cv: HTMLCanvasElement | null;
  W: number;
  H: number;
  /** Layout scale: the prototypes are tuned for a 680px-tall stage. */
  S: number;
  readonly max: number;
  readonly reduced: boolean;
  parts: Particle[] = [];
  fx: Fx[] = [];
  private gl: WebGLRenderingContext | null = null;
  private c2: CanvasRenderingContext2D | null = null;
  private vb: Float32Array | null = null;
  private cap = 0;
  private nv = 0;
  private nq = 0;
  private uR: WebGLUniformLocation | null = null;
  private uT: WebGLUniformLocation | null = null;
  private raf = 0;
  private last = 0;
  private seed = 1;
  private dead = false;
  private paused = false;
  private readonly headless: boolean;

  constructor(cv: HTMLCanvasElement | null, opts: VfxEngineOptions, size?: { w: number; h: number }) {
    this.cv = cv;
    this.W = size?.w ?? cv?.width ?? 0;
    this.H = size?.h ?? cv?.height ?? 0;
    this.S = this.H / 680 || 1;
    this.max = opts.max;
    this.reduced = !!opts.reduced;
    this.headless = !!opts.headless || !cv;
    if (!this.headless && cv && !this.reduced) {
      if (!opts.noGL) { try { this.initGL(cv); } catch { this.gl = null; } }
      if (!this.gl) { try { this.c2 = cv.getContext('2d'); } catch { this.c2 = null; } }
    }
  }

  get renderer(): 'webgl' | '2d' | 'none' { return this.gl ? 'webgl' : this.c2 ? '2d' : 'none'; }

  /** Canvas resized (CSS px): keep drawing in canvas px. */
  resize(w: number, h: number) {
    this.W = w; this.H = h; this.S = h / 680 || 1;
    if (this.gl) { this.gl.viewport(0, 0, w, h); this.gl.uniform2f(this.uR, w, h); }
  }

  private initGL(cv: HTMLCanvasElement) {
    const gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' }) as WebGLRenderingContext | null;
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    this.cap = this.max * 3 + 300;
    this.vb = new Float32Array(this.cap * 6 * 12);
    let off = 0;
    for (const [name, n] of [['aP', 2], ['aL', 2], ['aC', 4], ['aE', 4]] as const) {
      const l = gl.getAttribLocation(pr, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, n, gl.FLOAT, false, 48, off * 4);
      off += n;
    }
    this.uR = gl.getUniformLocation(pr, 'uR'); this.uT = gl.getUniformLocation(pr, 'uT');
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, this.W, this.H); gl.uniform2f(this.uR, this.W, this.H);
    this.gl = gl;
  }

  // ── primitives (GL: push a quad; 2D: draw now) ──────────────────────
  private quad(cx: number, cy: number, ax: number, ay: number, bx: number, by: number, u0: number, u1: number, v0: number, v1: number, r: number, g: number, b: number, a: number, k: number, e1 = 0, e2 = 0) {
    if (!this.vb || this.nq >= this.cap) return;
    this.nq++;
    const V = this.vb;
    let o = this.nv * 12;
    const P = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, -1, u0, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    for (const q of P) {
      V[o++] = cx + ax * q[0] + bx * q[1]; V[o++] = cy + ay * q[0] + by * q[1]; V[o++] = q[2]; V[o++] = q[3];
      V[o++] = r; V[o++] = g; V[o++] = b; V[o++] = a; V[o++] = k; V[o++] = e1; V[o++] = e2; V[o++] = 0;
    }
    this.nv += 6;
  }
  private rgba(c: Rgb, a: number) {
    return `rgba(${Math.round(Math.min(1, c[0]) * 255)},${Math.round(Math.min(1, c[1]) * 255)},${Math.round(Math.min(1, c[2]) * 255)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  private glow(x: number, y: number, r: number, c: Rgb, a: number, core: number, halo: number) {
    if (a <= 0.002 || r < 0.5) return;
    if (this.gl) return this.quad(x, y, r, 0, 0, r, -1, 1, -1, 1, c[0], c[1], c[2], a, 0, core, halo);
    const X = this.c2; if (!X) return;
    const gr = X.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, this.rgba(c, a * (core + halo))); gr.addColorStop(0.18, this.rgba(c, a * (core * 0.06 + halo * 0.75))); gr.addColorStop(1, this.rgba(c, 0));
    X.fillStyle = gr; X.beginPath(); X.arc(x, y, r, 0, 6.2832); X.fill();
  }
  private streak(x0: number, y0: number, x1: number, y1: number, w: number, c: Rgb, a: number) {
    if (a <= 0.002) return;
    const dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 0.01, ux = dx / L, uy = dy / L;
    if (this.gl) { const hl = L / 2 + w, hw = w * 1.6; return this.quad((x0 + x1) / 2, (y0 + y1) / 2, ux * hl, uy * hl, -uy * hw, ux * hw, -1, 1, -1, 1, c[0], c[1], c[2], a, 1); }
    const X = this.c2; if (!X) return;
    X.strokeStyle = this.rgba(c, a * 0.8); X.lineWidth = w; X.lineCap = 'round'; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke();
  }
  private cone(ox: number, oy: number, dx: number, dy: number, L: number, w0: number, w1: number, c: Rgb, a: number) {
    if (a <= 0.002) return;
    if (this.gl) { const wm = Math.max(w0, w1) * 1.35; return this.quad(ox + dx * L / 2, oy + dy * L / 2, dx * L / 2, dy * L / 2, -dy * wm, dx * wm, 0, 1, -wm, wm, c[0], c[1], c[2], a, 2, w0, w1); }
    const X = this.c2; if (!X) return;
    const px = -dy, py = dx, gr = X.createLinearGradient(ox, oy, ox + dx * L, oy + dy * L);
    gr.addColorStop(0, this.rgba(c, a * 0.55)); gr.addColorStop(0.6, this.rgba(c, a * 0.18)); gr.addColorStop(1, this.rgba(c, 0));
    X.fillStyle = gr;
    for (const f of [1, 0.55]) {
      X.beginPath(); X.moveTo(ox + px * w0 * f, oy + py * w0 * f); X.lineTo(ox + dx * L + px * w1 * f, oy + dy * L + py * w1 * f);
      X.lineTo(ox + dx * L - px * w1 * f, oy + dy * L - py * w1 * f); X.lineTo(ox - px * w0 * f, oy - py * w0 * f); X.fill();
    }
  }
  private full(c: Rgb, a: number, kind: number) {
    if (a <= 0.002) return;
    if (this.gl) return this.quad(this.W / 2, this.H / 2, this.W / 2, 0, 0, this.H / 2, 0, 1, 0, 1, c[0], c[1], c[2], a, kind);
    if (kind === 4 || !this.c2) return;
    this.c2.fillStyle = this.rgba(c, a); this.c2.fillRect(0, 0, this.W, this.H);
  }
  private ana(x: number, y: number, hl: number, hw: number, c: Rgb, a: number) {
    if (a <= 0.002) return;
    if (this.gl) return this.quad(x, y, hl, 0, 0, hw, -1, 1, -1, 1, c[0], c[1], c[2], a, 5);
    const X = this.c2; if (!X) return;
    const gr = X.createLinearGradient(x - hl, 0, x + hl, 0);
    gr.addColorStop(0, this.rgba(c, 0)); gr.addColorStop(0.5, this.rgba(c, a)); gr.addColorStop(1, this.rgba(c, 0));
    X.fillStyle = gr; X.fillRect(x - hl, y - hw * 0.35, hl * 2, hw * 0.7);
  }

  // ── effect API (canvas px, ms) ──────────────────────────────────────
  private now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  private add(f: Omit<Fx, 't0'> & { delay?: number }) {
    if (this.reduced || this.dead) return this;
    (f as Fx).t0 = this.now() + (f.delay || 0);
    this.fx.push(f as Fx);
    this.kick();
    return this;
  }
  gerb(x: number, y: number, o: GerbOpts = {}) { return this.add({ type: 'gerb', x, y, h: o.h || 300, dur: o.dur || 1200, rate: o.rate || 160, spread: o.spread || 5, size: o.size || 1, bright: o.bright || 1, delay: o.delay, acc: 0 }); }
  burst(x: number, y: number, o: BurstOpts = {}) { return this.add({ type: 'burst', x, y, n: o.n || 40, speed: o.speed || 420, up: o.up || 0, life: o.life || 0.8, size: o.size || 1, bright: o.bright || 1, glow: o.glow == null ? 1.1 : o.glow, delay: o.delay }); }
  glitter(o: GlitterOpts = {}) { return this.add({ type: 'glitter', n: o.n || 50, dur: o.dur || 6000, delay: o.delay, x0: o.x0 || 0, x1: o.x1 ?? null }); }
  beam(o: BeamOpts) { return this.add({ ...o, type: 'beam', ph: Math.random() * 6 }); }
  flash(o: FlashOpts = {}) { return this.add({ ...o, type: 'flash' }); }
  flare(x: number, y: number, o: FlareOpts = {}) { return this.add({ ...o, type: 'flare', x, y }); }
  light(x: number, y: number, o: LightOpts) { return this.add({ ...o, type: 'glow', x, y }); }
  haze(o: HazeOpts) { return this.add({ ...o, type: 'haze' }); }

  clear() {
    this.fx = []; this.parts = [];
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.blank();
  }
  destroy() {
    this.clear(); this.dead = true;
    // Free the GL context now; browsers cap live contexts per page.
    try { this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ }
    this.gl = null; this.c2 = null;
  }

  /** Tab hidden → stop the loop; visible → resume where effects stand. */
  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    if (p) { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } }
    else if (this.fx.length || this.parts.length) this.kick();
  }

  private blank() {
    if (this.gl) { this.gl.clearColor(0, 0, 0, 1); this.gl.clear(this.gl.COLOR_BUFFER_BIT); }
    else if (this.c2) { this.c2.globalCompositeOperation = 'source-over'; this.c2.fillStyle = '#000'; this.c2.fillRect(0, 0, this.W, this.H); }
  }
  private kick() {
    if (this.raf || this.dead || this.paused || this.headless || typeof requestAnimationFrame === 'undefined') return;
    this.last = this.now();
    const loop = () => { this.raf = 0; if (this.step()) this.raf = requestAnimationFrame(loop); else this.blank(); };
    this.raf = requestAnimationFrame(loop);
  }

  private env(f: Fx, t: number) {
    const l = t - f.t0; if (l < 0) return 0;
    let a = f.fadeIn ? Math.min(1, l / f.fadeIn) : 1;
    if (f.dur) { const rem = f.dur - l; if (rem <= 0) { f.done = true; return 0; } if (f.fadeOut) a *= Math.min(1, rem / f.fadeOut); }
    return a;
  }
  private spark(x: number, y: number, vx: number, vy: number, life: number, g: number, drag: number, size: number, bright: number) {
    if (this.parts.length >= this.max) return;
    this.parts.push({ k: 0, x, y, vx, vy, age: 0, life, g, drag, sz: size, br: bright, sd: this.seed++ });
  }
  private heat(a: number): Rgb {
    if (a < 0.12) return [1, 0.97, 0.92];
    if (a < 0.45) { const m = (a - 0.12) / 0.33; return [1, 0.97 - 0.17 * m, 0.92 - 0.5 * m]; }
    const q = (a - 0.45) / 0.55; return [1, 0.8 - 0.36 * q, 0.42 - 0.28 * q];
  }

  /** One frame. `nowMs` is injectable for tests. Returns true while anything is alive. */
  step(nowMs?: number): boolean {
    const now = nowMs ?? this.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - (this.last || now)) / 1000)); this.last = now;
    const t = now, T = (now / 1000) % 600, S = this.S, W = this.W, H = this.H;
    this.nv = 0; this.nq = 0;
    if (this.gl) { const gl = this.gl; gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(this.uT, T); }
    else if (this.c2) { const X = this.c2; X.globalCompositeOperation = 'source-over'; X.fillStyle = '#000'; X.fillRect(0, 0, W, H); X.globalCompositeOperation = 'lighter'; }

    // emitters
    for (const f of [...this.fx]) {
      const l = t - f.t0; if (l < 0) continue;
      if (f.type === 'gerb') {
        if (l > f.dur) { f.done = true; continue; }
        const Tr = 0.85, g = 2 * f.h / (Tr * Tr), v0 = Math.sqrt(2 * g * f.h), ramp = Math.min(1, l / 90) * Math.min(1, (f.dur - l) / 160);
        f.acc += f.rate * dt * ramp;
        while (f.acc >= 1) {
          f.acc -= 1;
          const sput = Math.random() < 0.14, ang = (Math.random() - 0.5) * 2 * (sput ? f.spread * 3.5 : f.spread) * Math.PI / 180, sp = v0 * (sput ? 0.45 + Math.random() * 0.35 : 0.84 + Math.random() * 0.22);
          this.spark(f.x + (Math.random() - 0.5) * 4 * S, f.y, Math.sin(ang) * sp, -Math.cos(ang) * sp, (0.95 + Math.random() * 0.75) * Tr * 1.45, g, 0.35, (0.8 + Math.random() * 0.5) * f.size, f.bright);
        }
        const fl = 0.75 + 0.25 * Math.random();
        this.glow(f.x, f.y - 2 * S, 16 * S * f.size, [1, 0.96, 0.88], 1.3 * fl * ramp, 1, 0.5);
        this.glow(f.x, f.y - 10 * S, 70 * S * f.size, [1, 0.62, 0.25], 0.28 * fl * ramp, 0, 1);
        this.glow(f.x, f.y - f.h * 0.45, f.h * 0.75, [1, 0.78, 0.45], 0.06 * ramp, 0, 1);
      } else if (f.type === 'burst') {
        for (let i = 0; i < f.n; i++) {
          const an = Math.random() * 6.2832, sp2 = f.speed * S * (0.3 + Math.random() * 0.7);
          this.spark(f.x, f.y, Math.cos(an) * sp2, Math.sin(an) * sp2 - f.up * f.speed * S * (0.4 + Math.random() * 0.6), f.life * (0.6 + Math.random() * 0.6), 700 * S, 2.4, (0.7 + Math.random() * 0.5) * f.size, f.bright);
        }
        this.fx.push({ type: 'glow', x: f.x, y: f.y, r: 80 * S * f.size, col: [1, 0.9, 0.7], a: f.glow * f.bright, t0: t, dur: 260, fadeOut: 240, core: 0.8, halo: 1 });
        f.done = true;
      } else if (f.type === 'glitter') {
        const x1 = f.x1 == null ? W : f.x1;
        for (let j = 0; j < f.n; j++) {
          const cr = Math.random();
          const col: Rgb = cr < 0.55 ? [1, 0.97, 0.9] : cr < 0.8 ? [1, 0.82, 0.45] : cr < 0.93 ? [1, 0.55, 0.8] : [0.75, 0.9, 1];
          if (this.parts.length >= this.max) break;
          this.parts.push({ k: 1, x: f.x0 + Math.random() * (x1 - f.x0), y: -10 - Math.random() * H * 0.9, vx: 0, vy: (28 + Math.random() * 46) * S, age: 0, life: f.dur / 1000, ph: Math.random() * 6.28, rate: 1.2 + Math.random() * 2.6, sw: 0.6 + Math.random() * 1.2, sz: 0.7 + Math.random() * 0.8, col, sd: this.seed++ });
        }
        f.done = true;
      }
    }
    // lights
    for (const f of this.fx) {
      if (f.done || f.type === 'gerb') continue;
      const e = this.env(f, t); if (e <= 0) continue;
      const l = t - f.t0;
      if (f.type === 'beam') {
        const p = Math.min(1, l / (f.sweepMs || 1)), ee = 1 - Math.pow(1 - p, 3);
        const base = Math.atan2(f.tx - f.ox, f.ty - f.oy), off = (f.sweep || 0) * (1 - ee) * Math.PI / 180 + (f.wob || 0) * Math.sin(T * 0.9 + f.ph) * Math.PI / 180;
        const A = base + off, dx = Math.sin(A), dy = Math.cos(A), D = Math.hypot(f.tx - f.ox, f.ty - f.oy), L = D * (f.reach || 1.45);
        const w1 = f.w1 * (f.reach || 1.45), c: Rgb = f.col || [0.8, 0.75, 1];
        this.cone(f.ox, f.oy, dx, dy, L, f.w0, w1, c, f.a * e);
        this.glow(f.ox, f.oy, f.w0 * 10, c, 0.5 * f.a * e, 0.6, 1);
        if (f.pool) this.glow(f.ox + dx * D, f.oy + dy * D, f.w1 * 1.3, c, f.pool * e * ee, 0, 1);
      } else if (f.type === 'flash') {
        const tau = f.tau || 120;
        const k = l < 35 ? l / 35 : Math.exp(-(l - 35) / tau); if (l > 35 + tau * 6) { f.done = true; continue; }
        this.full(f.col || [1, 0.96, 0.88], (f.a || 0.8) * k, 3);
        if (f.x != null) this.glow(f.x, f.y, Math.max(W, H) * 0.42, [1, 0.92, 0.78], (f.a || 0.8) * k * 0.75, 0.3, 1);
      } else if (f.type === 'flare') {
        const dur = f.dur || 900; if (l > dur) { f.done = true; continue; }
        const at = l < 50 ? l / 50 : Math.pow(1 - (l - 50) / (dur - 50), 1.6), a = (f.a || 1) * at, grow = 1 + 0.25 * (l / dur);
        const len = (f.len || W * 0.8) * grow;
        this.ana(f.x, f.y, len, 5 * S, [1, 0.97, 0.92], 1.4 * a);
        this.ana(f.x, f.y, len * 1.25, 16 * S, [0.55, 0.62, 1], 0.45 * a);
        this.glow(f.x, f.y, 95 * S, [1, 0.93, 0.8], 0.9 * a, 0.8, 0.8);
        this.glow(f.x, f.y, 22 * S, [1, 1, 1], 1.3 * a, 1, 0);
        const cx = W / 2, cy = H / 2;
        for (const [m, r, col] of [[0.45, 20, [0.7, 0.5, 1]], [0.95, 34, [1, 0.45, 0.75]], [1.5, 12, [1, 0.8, 0.4]], [-0.35, 9, [0.6, 0.8, 1]]] as [number, number, Rgb][]) {
          this.glow(cx + (cx - f.x) * m, cy + (cy - f.y) * m, r * S, col, 0.22 * a, 0.2, 1);
        }
      } else if (f.type === 'glow') {
        const pu = f.pulse ? 1 + f.pulse * Math.sin(T * 2.2) : 1;
        this.glow(f.x, f.y, f.r, f.col || [1, 0.78, 0.35], f.a * e * pu, f.core || 0, f.halo == null ? 1 : f.halo);
      } else if (f.type === 'haze') {
        this.full(f.col || [0.55, 0.42, 0.85], f.a * e, 4);
      }
    }
    this.fx = this.fx.filter((f) => !f.done);
    // particles
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.age += dt; if (p.age >= p.life) continue;
      if (p.k === 0) {
        const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy = p.vy * dr + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > H + 20) continue;
        const a = p.age / p.life, c = this.heat(a);
        let I = Math.min(1, p.age / 0.04) * Math.pow(1 - a, 1.25) * p.br;
        if (a > 0.3) { const hs = hash(p.sd * 13 + Math.floor(t / 42)); I *= hs < 0.28 ? 0.2 : 0.75 + 0.5 * hs; }
        const spd = Math.hypot(p.vx, p.vy), bl = Math.max(1.5 * S, Math.min(64 * S, spd * 0.03));
        const ux = p.vx / (spd || 1), uy = p.vy / (spd || 1), w = 1.15 * S * p.sz;
        this.streak(p.x - ux * bl, p.y - uy * bl, p.x, p.y, w, c, I * 1.25);
        if (a < 0.55) this.glow(p.x, p.y, 7 * S * p.sz, c, I * 0.55, 0.8, 0.35);
      } else {
        p.y += p.vy * dt; p.x += Math.sin(t / 1000 * p.sw + p.ph) * 9 * S * dt;
        if (p.y > H + 10) continue;
        const fade = Math.min(1, (p.life - p.age) / 0.8), tw = Math.pow(Math.max(0, Math.sin(t / 1000 * p.rate + p.ph)), 28) * fade;
        if (p.y > -5) {
          this.glow(p.x, p.y, 2.4 * S * p.sz, p.col, 0.35 * fade, 1, 0.2);
          if (tw > 0.03) {
            const g2 = 8 * S * p.sz * (0.6 + tw);
            this.glow(p.x, p.y, 5 * S * p.sz, p.col, 1.6 * tw, 1, 0.6);
            this.streak(p.x - g2, p.y, p.x + g2, p.y, 0.7 * S, p.col, 0.9 * tw);
            this.streak(p.x, p.y - g2 * 0.75, p.x, p.y + g2 * 0.75, 0.7 * S, p.col, 0.75 * tw);
          }
        }
      }
      keep.push(p);
    }
    this.parts = keep;
    if (this.gl && this.vb && this.nv) {
      const gl = this.gl;
      gl.bufferData(gl.ARRAY_BUFFER, this.vb.subarray(0, this.nv * 12), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, this.nv);
    }
    return this.fx.length > 0 || this.parts.length > 0;
  }
}
