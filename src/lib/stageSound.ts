// Sound cues for the reel, where the approved prototype marks «♪».
// Synthesised with WebAudio (no audio files to download). They play only
// when the player opted in (audioStore.cues) and the game is not muted.

import { useAudioStore } from '../stores/audioStore';

export type Cue = 'riser' | 'boom' | 'whoosh' | 'clash' | 'hit' | 'drone' | 'bigBoom' | 'sting' | 'outro' | 'drumroll';

let ctx: AudioContext | null = null;

export function cuesEnabled(): boolean {
  const s = useAudioStore.getState();
  return s.cues && !s.muted;
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) { try { ctx = new C(); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

function noise(c: AudioContext, secs: number): AudioBufferSourceNode {
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * secs)), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

function env(c: AudioContext, t0: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(c.destination);
  return g;
}

function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, peak: number, attack = 0.005) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  o.connect(env(c, t0, peak, attack, dur));
  o.start(t0); o.stop(t0 + attack + dur + 0.05);
}

function hiss(c: AudioContext, t0: number, dur: number, peak: number, filter: BiquadFilterType, f0: number, f1 = f0, attack = 0.005) {
  const n = noise(c, attack + dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + attack + dur);
  n.connect(f); f.connect(env(c, t0, peak, attack, dur));
  n.start(t0);
}

export function playCue(cue: Cue): void {
  if (!cuesEnabled()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.01;
  try {
    switch (cue) {
      case 'boom': tone(c, 'sine', 140, 38, t, 0.55, 0.7); hiss(c, t, 0.25, 0.25, 'lowpass', 900, 120); break;
      case 'bigBoom': tone(c, 'sine', 160, 30, t, 1.1, 0.9); hiss(c, t, 0.6, 0.35, 'lowpass', 2400, 90); tone(c, 'triangle', 80, 40, t, 0.9, 0.3); break;
      case 'whoosh': hiss(c, t, 0.45, 0.3, 'bandpass', 380, 3200, 0.18); break;
      case 'clash': hiss(c, t, 0.3, 0.4, 'highpass', 2500, 5000); tone(c, 'square', 320, 180, t, 0.18, 0.12); break;
      case 'hit': hiss(c, t, 0.14, 0.3, 'bandpass', 1600, 900); tone(c, 'sine', 190, 60, t, 0.22, 0.45); break;
      case 'riser': tone(c, 'sawtooth', 180, 900, t, 1.2, 0.08, 0.9); hiss(c, t, 1.1, 0.12, 'bandpass', 500, 4000, 0.9); break;
      case 'drone': tone(c, 'sawtooth', 55, 52, t, 3, 0.06, 1.2); tone(c, 'sawtooth', 55.6, 53, t, 3, 0.06, 1.2); break;
      case 'sting': [523, 659, 784].forEach((f) => tone(c, 'triangle', f, f, t, 0.5, 0.12)); break;
      case 'outro': [523, 659, 784, 1046].forEach((f, i) => tone(c, 'triangle', f, f, t + i * 0.13, 0.35, 0.12)); break;
      case 'drumroll': for (let i = 0; i < 36; i++) hiss(c, t + i * 0.055, 0.05, 0.05 + 0.2 * (i / 36), 'bandpass', 1800, 1200); break;
    }
  } catch { /* audio is a nicety */ }
}
