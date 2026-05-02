// Reads PNGs from public/cards/_source/{Champion,Thief,Duelist,Oracle,Guru}.png
// Writes optimized JPGs at @1x (400w) and @2x (800w) into public/cards/.
// Source filenames are case-insensitive (Champion.png or champion.png).
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const NAMES = ['champion', 'thief', 'duelist', 'oracle', 'guru'] as const;
const SRC = 'public/cards/Source';
const OUT = 'public/cards';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const files = existsSync(SRC) ? readdirSync(SRC) : [];

function findSource(name: string): string | null {
  const match = files.find((f) => f.toLowerCase() === `${name}.png`);
  return match ? `${SRC}/${match}` : null;
}

for (const name of NAMES) {
  const src = findSource(name);
  if (!src) {
    console.warn(`[skip] ${name}.png not found in ${SRC}`);
    continue;
  }
  await sharp(src).resize({ width: 400 }).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  await sharp(src).resize({ width: 800 }).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(`${OUT}/${name}@2x.jpg`);
  console.log(`[ok] ${name}`);
}
