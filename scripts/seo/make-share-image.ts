/**
 * The site's default share image (28 Nov 2026): 1200×630, the size every
 * network shows large (Facebook, WhatsApp, X, LinkedIn). The logo on the
 * stage background and gradient glow. Run once, commit public/share.jpg (a JPEG: WhatsApp skips previews over ~300 KB):
 *   npx tsx scripts/seo/make-share-image.ts
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const W = 1200;
const H = 630;

const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="violet" cx="22%" cy="28%" r="60%">
      <stop offset="0" stop-color="#A35BFF" stop-opacity=".55"/>
      <stop offset="1" stop-color="#A35BFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pink" cx="80%" cy="78%" r="60%">
      <stop offset="0" stop-color="#F0469C" stop-opacity=".5"/>
      <stop offset="1" stop-color="#F0469C" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="line" x1="0" x2="1">
      <stop offset="0" stop-color="#A35BFF"/><stop offset="1" stop-color="#F0469C"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0B0416"/>
  <rect width="${W}" height="${H}" fill="url(#violet)"/>
  <rect width="${W}" height="${H}" fill="url(#pink)"/>
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="url(#line)"/>
</svg>`);

async function main(): Promise<void> {
  const logo = await sharp(resolve(ROOT, 'public/logo.png')).resize({ width: 820 }).toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp(background)
    .composite([{ input: logo, left: Math.round((W - meta.width!) / 2), top: Math.round((H - meta.height!) / 2) }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(resolve(ROOT, 'public/share.jpg'));
  console.log('public/share.jpg written');
}

void main();
