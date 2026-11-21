import { describe, it, expect } from 'vitest';
import { encodeQr, qrPath, qrToRows, formatBits, versionBits, QrTooLongError, type QrMatrix } from '@/lib/qr';
import reference from '../fixtures/qr/reference.json';

// ── A small, independent QR reader used only by these tests ──────────
// It re-derives everything from the matrix: format info (BCH-checked),
// function-pattern map, unmasking, zig-zag read, de-interleaving, a
// Reed–Solomon syndrome check per block, and the byte-mode payload.

// ISO 18004 table 9, level M only, versions 1–10: [blocks, ecc per block].
const M_BLOCKS: Record<number, [number, number]> = {
  1: [1, 10], 2: [1, 16], 3: [1, 26], 4: [2, 18], 5: [2, 24],
  6: [4, 16], 7: [4, 18], 8: [4, 22], 9: [5, 22], 10: [5, 26],
};
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};
const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function bchFormatValid(raw: number): boolean {
  const v = raw ^ 0x5412;
  let rem = v;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  return rem === 0;
}

function readFormat(m: boolean[][]): number {
  const s = m.length;
  const b = (x: number, y: number) => (m[y][x] ? 1 : 0);
  // copy 1, bit 14 … bit 0
  const c1 = [
    b(0, 8), b(1, 8), b(2, 8), b(3, 8), b(4, 8), b(5, 8), b(7, 8), b(8, 8),
    b(8, 7), b(8, 5), b(8, 4), b(8, 3), b(8, 2), b(8, 1), b(8, 0),
  ];
  const c2: number[] = [];
  for (let i = 0; i < 7; i++) c2.push(b(8, s - 1 - i));
  for (let i = 0; i < 8; i++) c2.push(b(s - 8 + i, 8));
  const v1 = c1.reduce((a, x) => (a << 1) | x, 0);
  const v2 = c2.reduce((a, x) => (a << 1) | x, 0);
  expect(v1).toBe(v2);
  expect(bchFormatValid(v1)).toBe(true);
  return v1;
}

function functionMap(ver: number): boolean[][] {
  const s = ver * 4 + 17;
  const f = Array.from({ length: s }, () => new Array<boolean>(s).fill(false));
  const fill = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) f[y][x] = true;
  };
  fill(0, 0, 9, 9); fill(s - 8, 0, 8, 9); fill(0, s - 8, 9, 8); // finders + separators + format
  fill(6, 0, 1, s); fill(0, 6, s, 1); // timing
  const p = ALIGN[ver];
  for (const ax of p) for (const ay of p) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === p[p.length - 1]) || (ax === p[p.length - 1] && ay === 6)) continue;
    fill(ax - 2, ay - 2, 5, 5);
  }
  if (ver >= 7) { fill(s - 11, 0, 3, 6); fill(0, s - 11, 6, 3); }
  return f;
}

const EXP: number[] = [];
const LOG: number[] = new Array(256).fill(0);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
const mul = (a: number, b: number) => (a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0);

/** All syndromes S_i = c(α^i), i = 0 … ecc-1, must be 0 for a valid RS block. */
function syndromesZero(block: number[], ecc: number): boolean {
  for (let i = 0; i < ecc; i++) {
    let s = 0;
    for (const c of block) s = mul(s, EXP[i]) ^ c;
    if (s !== 0) return false;
  }
  return true;
}

function decode(qr: QrMatrix): { text: string; ecc: string; mask: number } {
  const m = qr.modules;
  const s = m.length;
  const ver = (s - 17) / 4;
  const fmt = readFormat(m) ^ 0x5412;
  const ecc = (['M', 'L', 'H', 'Q'] as const)[fmt >> 13];
  const mask = (fmt >> 10) & 7;
  expect(ecc).toBe('M');
  if (ver >= 7) {
    let v = 0;
    for (let i = 17; i >= 0; i--) v = (v << 1) | (m[Math.floor(i / 3)][s - 11 + (i % 3)] ? 1 : 0);
    expect(v >> 12).toBe(ver);
  }
  const f = functionMap(ver);
  const bits: number[] = [];
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((right + 1) & 2) === 0;
    for (let v = 0; v < s; v++) {
      const y = up ? s - 1 - v : v;
      for (const x of [right, right - 1]) {
        if (f[y][x]) continue;
        bits.push((m[y][x] !== MASKS[mask](x, y)) ? 1 : 0);
      }
    }
  }
  const total = Math.floor(bits.length / 8);
  const cw: number[] = [];
  for (let i = 0; i < total; i++) cw.push(bits.slice(i * 8, i * 8 + 8).reduce((a, b) => (a << 1) | b, 0));

  const [nb, eccLen] = M_BLOCKS[ver];
  const short = nb - (total % nb);
  const shortLen = Math.floor(total / nb);
  const blocks: number[][] = Array.from({ length: nb }, () => []);
  let k = 0;
  const dataMax = shortLen - eccLen + 1;
  for (let i = 0; i < dataMax; i++) for (let j = 0; j < nb; j++) {
    if (i === dataMax - 1 && j < short) continue;
    blocks[j].push(cw[k++]);
  }
  for (let i = 0; i < eccLen; i++) for (let j = 0; j < nb; j++) blocks[j].push(cw[k++]);
  const data: number[] = [];
  for (const blk of blocks) {
    expect(syndromesZero(blk, eccLen)).toBe(true);
    data.push(...blk.slice(0, blk.length - eccLen));
  }
  const dbits = data.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));
  const take = (() => { let p = 0; return (n: number) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | dbits[p++]; return v; }; })();
  expect(take(4)).toBe(0b0100);
  const len = take(ver <= 9 ? 8 : 16);
  const bytes = Uint8Array.from({ length: len }, () => take(8));
  return { text: new TextDecoder().decode(bytes), ecc, mask };
}

// ── Tests ────────────────────────────────────────────────────────────
describe('encodeQr — reference fixtures', () => {
  for (const c of reference.cases) {
    it(`matches qrcode@1.5.4 for ${JSON.stringify(c.text.slice(0, 24))} (v${c.version}, mask ${c.mask})`, () => {
      const forced = encodeQr(c.text, { ecc: c.ecc as 'M', mask: c.mask });
      expect(forced.version).toBe(c.version);
      expect(qrToRows(forced)).toEqual(c.rows);
      // The automatic mask choice agrees with the reference library too.
      const auto = encodeQr(c.text, { ecc: c.ecc as 'M' });
      expect(auto.mask).toBe(c.mask);
      expect(qrToRows(auto)).toEqual(c.rows);
    });
  }
});

describe('encodeQr — round trip through the test reader', () => {
  const texts = [
    'https://eurovision.games/room/K3PW7X',
    'http://localhost:4190/room/DESIGN',
    'Δωμάτιο ΠΑΡΤΥ · Καλλιτεχνικό όνομα',
    'w'.repeat(120),
    'u'.repeat(213), // the version-10 / level-M byte capacity
  ];
  for (const t of texts) {
    it(`decodes ${JSON.stringify(t.slice(0, 24))}`, () => {
      const qr = encodeQr(t);
      expect(qr.size).toBe(qr.version * 4 + 17);
      const out = decode(qr);
      expect(out.text).toBe(t);
      expect(out.mask).toBe(qr.mask);
    });
  }

  it('decodes under every forced mask', () => {
    for (let mask = 0; mask < 8; mask++) {
      expect(decode(encodeQr('https://eurovision.games/room/ABC234', { mask })).text).toBe('https://eurovision.games/room/ABC234');
    }
  });
});

describe('encodeQr — sizes and limits', () => {
  it('picks the smallest version for a room link', () => {
    expect(encodeQr('https://eurovision.games/room/K3PW7X').version).toBe(3);
    expect(encodeQr('HELLO').version).toBe(1);
  });

  it('throws past version 10', () => {
    expect(() => encodeQr('u'.repeat(214))).toThrow(QrTooLongError);
  });

  it('format and version BCH codes match the spec examples', () => {
    // ISO 18004 annex C: level M, mask 5 → 100000011001110; version 7 → 000111110010010100
    expect(formatBits('M', 5).toString(2).padStart(15, '0')).toBe('100000011001110');
    expect(versionBits(7).toString(2).padStart(18, '0')).toBe('000111110010010100');
  });

  it('qrPath draws one square per dark module inside the quiet zone', () => {
    const qr = encodeQr('HELLO');
    const dark = qr.modules.flat().filter(Boolean).length;
    const d = qrPath(qr, 4);
    expect(d.match(/M/g)?.length).toBe(dark);
    expect(d.startsWith('M4 4h1v1h-1z')).toBe(true); // finder corner at the border offset
  });
});
