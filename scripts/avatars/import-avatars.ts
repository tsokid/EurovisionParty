// Import owner avatar artwork into the Stage avatar registry.
//
//   npx tsx scripts/avatars/import-avatars.ts <zipOrFolder> [options]
//
// Options:
//   --exclude <dir>   skip any file under a folder with this name (repeatable),
//                     e.g. a superseded "02_New_8_First_Version"
//   --hidden <list>   numbers held back from the picker, e.g. "41-48,52"
//   --skip <list>     numbers left out entirely (no files, no entry), e.g. "41,46,48"
//   --out <dir>       image folder (default public/avatars)
//   --registry <file> generated TS (default src/components/stage/avatars/images.generated.ts)
//   --quality <n>     WebP quality (default 80)
//
// For every PNG/JPG/WebP (recursively): centre-crop to a square, write
// <id>-96.webp and <id>-512.webp (transparency kept), and regenerate the typed
// registry. Ids and titles come from the file name:
//   "07_folk_metal_baritone.png" → id "img-07", title "Folk Metal Baritone"
//   "Ντίβα των Πούλιων.png"      → id "img-ntiva-ton-poulion", title as written
// Titles go into both locales unchanged (owner ruling: character names stay
// as named). A duplicate id is an error: exclude the superseded folder.
//
// Requires `sharp`, already a devDependency (scripts/optimize-cards.ts uses it).
// Zips are unpacked with fflate when it resolves, else with the system `tar`
// (bsdtar on Windows 10+/macOS reads zip).
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SIZES = [96, 512] as const;
// No file cache: Windows keeps cached inputs open, which blocks cleaning up an unzipped folder.
sharp.cache(false);
const EXT = /\.(png|jpe?g|webp)$/i;

interface Options {
  input: string;
  exclude: string[];
  hidden: Set<number>;
  skip: Set<number>;
  out: string;
  registry: string;
  quality: number;
}

function parseRange(list: string): Set<number> {
  const set = new Set<number>();
  for (const part of list.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`--hidden: cannot read "${part}"`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
  }
  return set;
}

export function parseArgs(argv: string[]): Options {
  const o: Options = {
    input: '', exclude: [], hidden: new Set(), skip: new Set(), out: 'public/avatars',
    registry: 'src/components/stage/avatars/images.generated.ts', quality: 80,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === '--exclude') o.exclude.push(next());
    else if (a === '--hidden') o.hidden = parseRange(next());
    else if (a === '--skip') o.skip = parseRange(next());
    else if (a === '--out') o.out = next();
    else if (a === '--registry') o.registry = next();
    else if (a === '--quality') o.quality = Number(next());
    else if (!o.input) o.input = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  if (!o.input) throw new Error('Usage: import-avatars.ts <zipOrFolder> [--exclude dir] [--hidden 41-48]');
  return o;
}

const GREEK: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x',
  ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};

/** ASCII slug, Greek transliterated: "Ντίβα των Πούλιων" → "ntiva-ton-poulion". */
export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('el')
    .replace(/ου/g, 'ou')
    .split('').map((ch) => GREEK[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Title from the file name. All-lowercase names get title case
 * ("disco_commander" → "Disco Commander"); names with capitals are kept as
 * written ("Ντίβα των Πούλιων", "Fox_Synthpop" → "Fox Synthpop").
 */
export function titleFrom(stem: string): string {
  const words = stem.replace(/[_]+/g, ' ').trim().split(/\s+/);
  if (stem !== stem.toLocaleLowerCase('el')) return words.join(' ');
  const ACRONYMS: Record<string, string> = { dj: 'DJ', mc: 'MC', tv: 'TV', uk: 'UK', usa: 'USA' };
  return words.map((w) => ACRONYMS[w] ?? w.charAt(0).toLocaleUpperCase('el') + w.slice(1)).join(' ');
}

export interface Parsed {
  id: string;
  num: number | null;
  title: string;
}

/** Id and title from a file name ("07_folk_metal_baritone.png"). */
export function parseName(file: string): Parsed {
  const stem = path.basename(file).replace(EXT, '');
  const m = stem.match(/^(\d+)[\s._-]+(.+)$/);
  if (m) return { id: `img-${m[1].padStart(2, '0')}`, num: Number(m[1]), title: titleFrom(m[2]) };
  return { id: `img-${slugify(stem) || createHash('sha1').update(stem).digest('hex').slice(0, 8)}`, num: null, title: titleFrom(stem) };
}

function walk(dir: string, exclude: string[], acc: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (exclude.includes(name) || name === '__MACOSX') continue;
      walk(p, exclude, acc);
    } else if (EXT.test(name) && !name.startsWith('._')) {
      acc.push(p);
    }
  }
  return acc;
}

async function unzip(zip: string): Promise<string> {
  // A new, empty folder beside the zip (system temp may be off-limits in sandboxes).
  const dir = mkdtempSync(path.join(path.dirname(path.resolve(zip)), '.avatars-unzip-'));
  try {
    const { unzipSync } = await import('fflate');
    const files = unzipSync(new Uint8Array(readFileSync(zip)));
    for (const [name, data] of Object.entries(files)) {
      const rel = name.replace(/\\/g, '/'); // some Windows zippers store "a\b.png"
      if (rel.endsWith('/')) continue;
      const target = path.join(dir, rel);
      if (!target.startsWith(dir)) continue; // zip-slip guard
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, data);
    }
  } catch {
    // Windows ships bsdtar (reads zip) in System32; a Git-Bash GNU tar on PATH does not.
    const winTar = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : '';
    execFileSync(winTar && existsSync(winTar) ? winTar : 'tar', ['-xf', zip, '-C', dir]);
  }
  return dir;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function run(o: Options): Promise<{ count: number; bytes: number; ids: string[] }> {
  const isZip = /\.zip$/i.test(o.input);
  const root = isZip ? await unzip(o.input) : o.input;
  try {
    const files = walk(root, o.exclude);
    if (files.length === 0) throw new Error(`No PNG/JPG/WebP files under ${o.input}`);
    const seen = new Map<string, string>();
    const entries: (Parsed & { file: string; hash: string })[] = [];
    for (const file of files) {
      const p = parseName(file);
      if (p.num !== null && o.skip.has(p.num)) continue;
      if (seen.has(p.id)) {
        throw new Error(`Duplicate id ${p.id}:\n  ${seen.get(p.id)}\n  ${file}\nUse --exclude <folder> for the superseded set.`);
      }
      seen.set(p.id, file);
      entries.push({ ...p, file, hash: '' });
    }
    entries.sort((a, b) => (a.num ?? 1e9) - (b.num ?? 1e9) || (a.id < b.id ? -1 : 1));

    mkdirSync(o.out, { recursive: true });
    let bytes = 0;
    for (const e of entries) {
      const img = sharp(e.file, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      const side = Math.min(meta.width ?? 0, meta.height ?? 0);
      if (!side) throw new Error(`Cannot read ${e.file}`);
      const left = Math.floor(((meta.width ?? side) - side) / 2);
      const top = Math.floor(((meta.height ?? side) - side) / 2);
      const square = await img.extract({ left, top, width: side, height: side }).toBuffer();
      const h = createHash('sha1');
      for (const size of SIZES) {
        const buf = await sharp(square)
          .resize(size, size, { fit: 'cover', kernel: 'lanczos3' })
          .webp({ quality: o.quality, alphaQuality: 90, effort: 6, smartSubsample: true })
          .toBuffer();
        writeFileSync(path.join(o.out, `${e.id}-${size}.webp`), buf);
        h.update(buf);
        bytes += buf.length;
      }
      e.hash = h.digest('hex').slice(0, 8);
    }

    const publicDir = path.resolve('public');
    const outAbs = path.resolve(o.out);
    const urlBase = outAbs.startsWith(publicDir) ? `/${path.relative(publicDir, outAbs).split(path.sep).join('/')}` : `/${path.basename(outAbs)}`;
    const lines = entries.map((e) => {
      const hidden = e.num !== null && o.hidden.has(e.num);
      const title = esc(e.title);
      return `  { kind: 'image', id: '${e.id}', title: { el: '${title}', en: '${title}' }, thumb: '${urlBase}/${e.id}-96.webp?v=${e.hash}', full: '${urlBase}/${e.id}-512.webp?v=${e.hash}'${hidden ? ', hidden: true' : ''} },`;
    });
    const ts = `// GENERATED by scripts/avatars/import-avatars.ts — do not edit by hand.
// Owner avatar artwork: ${urlBase}/<id>-96.webp (thumb) and <id>-512.webp (viewer),
// transparent cutouts drawn on the Stage avatar circle. \`?v=\` is a content hash.
// \`hidden: true\` = registered (old rows still render) but not offered in the picker.
import type { ImageAvatarSpec } from './types';

export const IMAGE_AVATARS: readonly ImageAvatarSpec[] = [
${lines.join('\n')}
];
`;
    mkdirSync(path.dirname(o.registry), { recursive: true });
    writeFileSync(o.registry, ts);
    return { count: entries.length, bytes, ids: entries.map((e) => e.id) };
  } finally {
    if (isZip) {
      try { rmSync(root, { recursive: true, force: true, maxRetries: 3 }); }
      catch { console.warn(`Could not remove the unzipped folder ${root}; delete it by hand.`); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run(parseArgs(process.argv.slice(2)))
    .then((r) => console.log(`Imported ${r.count} avatars, ${(r.bytes / 1024 / 1024).toFixed(2)} MB of WebP.`))
    .catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
