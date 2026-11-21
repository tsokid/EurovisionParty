// src/lib/qr.ts
// Compact, dependency-free QR Code generator (ISO/IEC 18004), byte mode only,
// versions 1–10, all four error-correction levels. Enough for a room join
// link (≈40 bytes → version 3 at level M). Algorithm follows the public
// reference implementation by Project Nayuki (MIT); written from scratch here.
//
// Verified in tests/lib/qr.test.ts against fixtures produced by the `qrcode`
// npm package (forced mask, byte segment) and decoded by jsQR. See the
// Task 5 report for the procedure.

export type QrEcc = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  version: number;
  size: number;
  ecc: QrEcc;
  mask: number;
  /** modules[y][x] — true = dark. */
  modules: boolean[][];
}

export interface QrOptions {
  ecc?: QrEcc;
  /** Force a mask pattern 0–7 (tests); default picks the lowest penalty. */
  mask?: number;
  minVersion?: number;
}

export class QrTooLongError extends Error {
  constructor(bytes: number) {
    super(`QR: ${bytes} bytes do not fit in version 10`);
    this.name = 'QrTooLongError';
  }
}

export const QR_MAX_VERSION = 10;

const ECC_INDEX: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
/** Format-info bits of each level (ISO 18004 table 12). */
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Index [ecc][version], versions 1–10 (slot 0 unused).
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
];
const NUM_EC_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
];
const ALIGNMENT_POSITIONS: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

/** Modules available for data + ECC bits (everything that is not a function pattern). */
function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(ver: number, ecc: QrEcc): number {
  const e = ECC_INDEX[ecc];
  return Math.floor(rawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_EC_BLOCKS[e][ver];
}

// ── GF(256) Reed–Solomon (primitive polynomial 0x11D) ───────────────
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// ── Encoding ─────────────────────────────────────────────────────────
function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function appendBits(bits: number[], value: number, len: number) {
  for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

/** Data codewords (mode, count, payload, terminator, padding) for one version. */
function encodeData(bytes: number[], ver: number, ecc: QrEcc): number[] {
  const capacityBits = dataCodewords(ver, ecc) * 8;
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4); // byte mode
  appendBits(bits, bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) appendBits(bits, b, 8);
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    out.push(byte);
  }
  return out;
}

/** Split into blocks, append RS ECC, interleave. */
function addEccAndInterleave(data: number[], ver: number, ecc: QrEcc): number[] {
  const e = ECC_INDEX[ecc];
  const numBlocks = NUM_EC_BLOCKS[e][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const eccBytes = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0); // placeholder, skipped below
    blocks.push(dat.concat(eccBytes));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// ── Matrix ───────────────────────────────────────────────────────────
class Grid {
  readonly version: number;
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];
  constructor(version: number) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }
  setFn(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }
}

function drawFinder(g: Grid, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      g.setFn(x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) g.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
}

export function formatBits(ecc: QrEcc, mask: number): number {
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

export function versionBits(ver: number): number {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function drawFormat(g: Grid, ecc: QrEcc, mask: number) {
  const bits = formatBits(ecc, mask);
  const s = g.size;
  for (let i = 0; i <= 5; i++) g.setFn(8, i, bit(bits, i));
  g.setFn(8, 7, bit(bits, 6));
  g.setFn(8, 8, bit(bits, 7));
  g.setFn(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) g.setFn(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) g.setFn(s - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) g.setFn(8, s - 15 + i, bit(bits, i));
  g.setFn(8, s - 8, true); // the always-dark module
}

function drawVersion(g: Grid) {
  if (g.version < 7) return;
  const bits = versionBits(g.version);
  for (let i = 0; i < 18; i++) {
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    g.setFn(a, b, bit(bits, i));
    g.setFn(b, a, bit(bits, i));
  }
}

function drawFunctionPatterns(g: Grid, ecc: QrEcc) {
  const s = g.size;
  for (let i = 0; i < s; i++) {
    g.setFn(6, i, i % 2 === 0);
    g.setFn(i, 6, i % 2 === 0);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, s - 4, 3);
  drawFinder(g, 3, s - 4);
  const pos = ALIGNMENT_POSITIONS[g.version];
  const last = pos.length - 1;
  pos.forEach((px, i) => {
    pos.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      drawAlignment(g, px, py);
    });
  });
  drawFormat(g, ecc, 0); // reserved now, real bits after masking
  drawVersion(g);
}

function drawCodewords(g: Grid, codewords: number[]) {
  const s = g.size;
  let i = 0;
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? s - 1 - vert : vert;
        if (!g.isFunction[y][x] && i < codewords.length * 8) {
          g.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

export function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: throw new RangeError(`QR: mask ${mask}`);
  }
}

function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.isFunction[y][x] && maskApplies(mask, x, y)) g.modules[y][x] = !g.modules[y][x];
    }
  }
}

// ── Mask penalty (ISO 18004 §7.8.3) ─────────────────────────────────
function penalty(g: Grid): number {
  const s = g.size;
  const m = g.modules;
  let result = 0;

  const addHistory = (run: number, h: number[]) => {
    if (h[0] === 0) run += s; // light border before the first run
    h.pop();
    h.unshift(run);
  };
  const countPatterns = (h: number[]) => {
    const n = h[1];
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
  };
  const terminate = (color: boolean, run: number, h: number[]) => {
    if (color) {
      addHistory(run, h);
      run = 0;
    }
    addHistory(run + s, h);
    return countPatterns(h);
  };

  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < s; a++) {
      let color = false;
      let run = 0;
      const h = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < s; b++) {
        const cell = pass === 0 ? m[a][b] : m[b][a];
        if (cell === color) {
          run++;
          if (run === 5) result += 3;
          else if (run > 5) result++;
        } else {
          addHistory(run, h);
          if (!color) result += countPatterns(h) * 40;
          color = cell;
          run = 1;
        }
      }
      result += terminate(color, run, h) * 40;
    }
  }

  for (let y = 0; y < s - 1; y++) {
    for (let x = 0; x < s - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3;
    }
  }

  let dark = 0;
  for (const row of m) for (const c of row) if (c) dark++;
  const total = s * s;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return result + k * 10;
}

// ── Public API ───────────────────────────────────────────────────────
export function encodeQr(text: string, opts: QrOptions = {}): QrMatrix {
  const ecc = opts.ecc ?? 'M';
  const bytes = utf8(text);
  let ver = Math.max(1, opts.minVersion ?? 1);
  for (; ; ver++) {
    if (ver > QR_MAX_VERSION) throw new QrTooLongError(bytes.length);
    const needed = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= dataCodewords(ver, ecc) * 8) break;
  }

  const g = new Grid(ver);
  drawFunctionPatterns(g, ecc);
  drawCodewords(g, addEccAndInterleave(encodeData(bytes, ver, ecc), ver, ecc));

  let mask = opts.mask ?? -1;
  if (mask < 0) {
    let best = Infinity;
    for (let i = 0; i < 8; i++) {
      applyMask(g, i);
      drawFormat(g, ecc, i);
      const p = penalty(g);
      if (p < best) {
        best = p;
        mask = i;
      }
      applyMask(g, i); // XOR again = undo
    }
  }
  applyMask(g, mask);
  drawFormat(g, ecc, mask);
  return { version: ver, size: g.size, ecc, mask, modules: g.modules };
}

/** SVG path data: one 1×1 square per dark module, offset by a quiet zone. */
export function qrPath(qr: QrMatrix, border = 4): string {
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) d += `M${x + border} ${y + border}h1v1h-1z`;
    }
  }
  return d;
}

/** Rows as '1'/'0' strings (fixtures, debugging). */
export function qrToRows(qr: QrMatrix): string[] {
  return qr.modules.map((row) => row.map((c) => (c ? '1' : '0')).join(''));
}
