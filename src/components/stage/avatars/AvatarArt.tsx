// Layered SVG renderer for the Stage avatar set (see registry.ts).
// One 64×64 viewBox, clipped to a circle. Layer order, back to front:
// background → back hair / cape → shoulders + collar → neck → ears → face →
// make-up → eyes → mouth → front hair → headpiece → extras.
// Shapes are bold on purpose: the hair silhouette, headpiece and colours
// carry the character at 32px; lashes, gems and sequins reward 96px.
import { useId, type ReactElement } from 'react';
import type { AvatarSpec, CollarStyle, EyeStyle, HairStyle, HeadStyle, MouthStyle } from './types';

const INK = '#1A0B24';

/** Mixes a hex colour with black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function star(cx: number, cy: number, r: number, inner = 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

function heart(cx: number, cy: number, s: number): string {
  return `M${cx} ${cy + s * 0.9}C${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.9} ${cy - s * 1.3} ${cx} ${cy - s * 0.45}C${cx + s * 0.9} ${cy - s * 1.3} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;
}

// ── Hair ────────────────────────────────────────────────────────────────
const CAP = 'M20.3 31C19.5 20.5 25 16.5 32 16.5S44.5 20.5 43.7 31C41 25 37 22.6 32 22.6S23 25 20.3 31Z';

function hairBack(style: HairStyle, c: string): ReactElement | null {
  const dark = shade(c, -0.25);
  switch (style) {
    case 'beehive':
      return (
        <g fill={c}>
          <ellipse cx="32" cy="30" rx="15.5" ry="13" />
          <ellipse cx="32" cy="15" rx="12.5" ry="14" />
          <path d="M24 9Q32 1 40 9" fill="none" stroke={shade(c, 0.35)} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M22 17Q32 9 42 17" fill="none" stroke={dark} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 'tower':
      return (
        <g fill={c}>
          <ellipse cx="32" cy="31" rx="14.5" ry="12" />
          <rect x="21.5" y="-4" width="21" height="34" rx="10.5" />
          <path d="M26 0Q32 4 38 0M25 8Q32 12 39 8M25 16Q32 20 39 16" fill="none" stroke={dark} strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );
    case 'afro': {
      const bumps = Array.from({ length: 14 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 14;
        return <circle key={i} cx={32 + 17 * Math.cos(a)} cy={27 + 16 * Math.sin(a)} r="6.5" />;
      });
      return (
        <g fill={c}>
          <circle cx="32" cy="27" r="18" />
          {bumps}
          <path d="M18 18Q22 12 27 11" fill="none" stroke={shade(c, 0.3)} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    }
    case 'curls': {
      const ring = [
        [17, 40], [15, 32], [16, 24], [20, 17], [26, 12.5], [32, 11], [38, 12.5], [44, 17], [48, 24], [49, 32], [47, 40],
      ];
      return (
        <g fill={c}>
          {ring.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" />)}
          {ring.map(([x, y], i) => <circle key={`h${i}`} cx={x - 1.3} cy={y - 1.5} r="2" fill={shade(c, 0.25)} />)}
        </g>
      );
    }
    case 'long':
      return (
        <path
          fill={c}
          d="M18.5 30C17 14 47 14 45.5 30L47 46C48 50 50 52 49 55C45 57 41 54 39 50L38 38H26L25 50C23 54 19 57 15 55C14 52 16 50 17 46Z"
        />
      );
    case 'waves':
      return (
        <g fill={c}>
          <path d="M18 30C16 13 48 13 46 30L48 44C50 47 47 49 49 52C46 56 41 54 39 50L38 38H26L25 50C23 54 18 56 15 52C17 49 14 47 16 44Z" />
          <path d="M16 44Q19 47 16 52M48 44Q45 47 48 52" fill="none" stroke={dark} strokeWidth="1.2" />
        </g>
      );
    case 'bob':
      return <path fill={c} d="M16.5 40C14 16 50 16 47.5 40C47.5 43 45 44 43 43L43 32H21L21 43C19 44 16.5 43 16.5 40Z" />;
    case 'buns':
      return (
        <g fill={c}>
          <circle cx="19" cy="15" r="8" />
          <circle cx="45" cy="15" r="8" />
          <circle cx="17.2" cy="13" r="2.4" fill={shade(c, 0.3)} />
          <circle cx="43.2" cy="13" r="2.4" fill={shade(c, 0.3)} />
          <ellipse cx="32" cy="27" rx="13" ry="11" />
        </g>
      );
    case 'ponytail':
      return (
        <g fill={c}>
          <path d="M38 15C46 2 62 6 60 22C59 30 56 36 53 40C54 30 52 24 46 22Z" />
          <ellipse cx="32" cy="27" rx="13" ry="11" />
          <path d="M52 30C55 34 55 38 53 40" fill="none" stroke={shade(c, 0.35)} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="41" cy="15.5" r="3.2" fill="#FFC53D" />
        </g>
      );
    case 'flame':
      return (
        <path
          fill={c}
          d="M17 34C14 24 16 16 20 12C20 16 22 18 23 18C22 12 25 6 30 3C29 8 31 12 33 13C33 8 36 4 41 3C39 8 41 12 43 14C44 11 46 9 49 9C47 13 49 20 47 34Z"
        />
      );
    case 'pompadour':
      return <ellipse cx="32" cy="27" rx="13" ry="11" fill={c} />;
    case 'mohawk':
    case 'bald':
      return null;
  }
}

function hairFront(style: HairStyle, c: string): ReactElement | null {
  const light = shade(c, 0.3);
  switch (style) {
    case 'beehive':
    case 'tower':
      return (
        <g>
          <path fill={c} d="M20.3 31C19.5 20.5 25 16.5 32 16.5S44.5 20.5 43.7 31C42 26 38 21 30 22C25 22.5 22 26 20.3 31Z" />
          <path d="M24 24Q29 19.5 36 20.5" fill="none" stroke={light} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 'afro':
    case 'curls':
      return (
        <g fill={c}>
          <path d={CAP} />
          {[22.5, 27, 32, 37, 41.5].map((x, i) => <circle key={i} cx={x} cy={i % 2 ? 21 : 22.5} r="3.4" />)}
        </g>
      );
    case 'long':
      return (
        <g>
          <path fill={c} d="M20.3 32C18.5 19 28 14.5 37 16.5C43.5 18 45.5 24 43.7 32C41.5 25 38 21.5 31 23C26 24 22 27.5 20.3 32Z" />
          <path d="M27 19.5Q33 17.5 39 19.5" fill="none" stroke={light} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 'waves':
      return (
        <g>
          <path fill={c} d="M20.3 31C18 17 34 12 42.5 18.5C47 22 46.5 31 44.2 38C42.8 31 40.5 26.5 35 25.5C28 24 23 26.5 20.3 31Z" />
          <path d="M26 21Q34 16.5 41 21.5" fill="none" stroke={light} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 'bob':
      return (
        <g>
          <path fill={c} d="M19.6 28.5C19 18 25 15.5 32 15.5S45 18 44.4 28.5Z" />
          <path d="M23 21Q32 17 41 21" fill="none" stroke={light} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 'buns':
    case 'ponytail':
      return (
        <g>
          <path fill={c} d={CAP} />
          <path d="M24 22Q32 18 40 22" fill="none" stroke={light} strokeWidth="1.1" strokeLinecap="round" />
        </g>
      );
    case 'flame':
      return <path fill={c} d="M20.3 31C19 22 23 17 27 16C27 19 29 20 31 20C31 17 33 15 36 15C35 18 37 20 39 20C40 18 42 17 44 18C44.5 22 44.5 26 43.7 31C40 25 36 23.5 32 23.5S23.5 25 20.3 31Z" />;
    case 'pompadour':
      return (
        <g>
          <path fill={c} d="M19.8 28C17 15 28 6 41 9C49 11 49.5 20 44.2 28C41 22 33 20 26 23C23.5 24 21 25.5 19.8 28Z" />
          <path d="M25 15Q33 9 43 12" fill="none" stroke={light} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case 'mohawk':
      return (
        <g>
          <path fill={c} d="M26.5 23L23 3L29 12L32 0L35 12L41 3L37.5 23Z" />
          <path d="M32 3L32 21" stroke={light} strokeWidth="1.2" />
        </g>
      );
    case 'bald':
      return null;
  }
}

// ── Headpieces ──────────────────────────────────────────────────────────
function headpiece(style: HeadStyle, c: string, accent: string): ReactElement | null {
  const dark = shade(c, -0.3);
  switch (style) {
    case 'crown':
      return (
        <g>
          <path fill={c} stroke={dark} strokeWidth="0.8" strokeLinejoin="round" d="M21 20L21.5 8L26.5 13.5L32 5L37.5 13.5L42.5 8L43 20Z" />
          <rect x="21" y="17" width="22" height="3.5" rx="1" fill={dark} />
          {[21.5, 32, 42.5].map((x, i) => <circle key={i} cx={x} cy={i === 1 ? 5 : 8} r="1.6" fill={accent} />)}
          <circle cx="32" cy="15" r="2" fill={accent} />
        </g>
      );
    case 'tiara':
      return (
        <g>
          <path d="M21 23Q32 15 43 23" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <path fill={c} d="M32 9L35 15.5L32 19.5L29 15.5Z" />
          <path fill={c} d="M25.5 15L27.5 18.5L25 20.5ZM38.5 15L36.5 18.5L39 20.5Z" />
          <circle cx="32" cy="15" r="1.5" fill={accent} />
          <path d={sparkle(32, 7, 2.6)} fill="#fff" />
        </g>
      );
    case 'plume':
      return (
        <g>
          {[-38, -14, 10, 34].map((rot, i) => (
            <g key={i} transform={`rotate(${rot} 34 20)`}>
              <ellipse cx="34" cy="7" rx="3.6" ry="11" fill={i % 2 ? accent : c} />
              <path d="M34 -3L34 18" stroke={shade(i % 2 ? accent : c, -0.25)} strokeWidth="0.7" />
            </g>
          ))}
          <path d="M21 22Q32 16 43 22" fill="none" stroke={dark} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="34" cy="19.5" r="2.4" fill="#fff" stroke={dark} strokeWidth="0.6" />
        </g>
      );
    case 'star':
      return (
        <g>
          <path d="M21 22Q32 15.5 43 22" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <path d={star(32, 10, 8)} fill={c} stroke={dark} strokeWidth="0.8" strokeLinejoin="round" />
          <circle cx="32" cy="10.5" r="1.6" fill={accent} />
        </g>
      );
    case 'horns':
      return (
        <g fill={c} stroke={dark} strokeWidth="0.8">
          <path d="M23 19C19 15 18 9 20 4C21 9 24 12 27 15Z" />
          <path d="M41 19C45 15 46 9 44 4C43 9 40 12 37 15Z" />
        </g>
      );
    case 'halo':
      return (
        <g>
          <ellipse cx="32" cy="8.5" rx="11" ry="3.2" fill="none" stroke={c} strokeWidth="2.4" />
          <path d={sparkle(44, 5, 2.4)} fill="#fff" />
          <path d={sparkle(19.5, 11, 1.8)} fill="#fff" />
        </g>
      );
    case 'flowers':
      return (
        <g>
          {[
            [21.5, 23, 3.6], [26, 17.5, 4.2], [32, 15.5, 4.6], [38, 17.5, 4.2], [42.5, 23, 3.6],
          ].map(([x, y, r], i) => (
            <g key={i}>
              {[0, 72, 144, 216, 288].map((a) => (
                <circle
                  key={a}
                  cx={x + r * 0.55 * Math.cos((a * Math.PI) / 180)}
                  cy={y + r * 0.55 * Math.sin((a * Math.PI) / 180)}
                  r={r * 0.48}
                  fill={i % 2 ? accent : c}
                />
              ))}
              <circle cx={x} cy={y} r={r * 0.32} fill="#FFE08A" />
            </g>
          ))}
        </g>
      );
    case 'tophat':
      return (
        <g transform="rotate(-10 32 18)">
          <ellipse cx="32" cy="18.5" rx="13" ry="2.8" fill={dark} />
          <rect x="24.5" y="2" width="15" height="16.5" rx="1.5" fill={c} />
          <rect x="24.5" y="13" width="15" height="3.2" fill={accent} />
          <path d={sparkle(36.5, 6.5, 2.2)} fill="#fff" />
        </g>
      );
    case 'discoball':
      return (
        <g>
          <path d="M22 22Q32 17 42 22" fill="none" stroke={dark} strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="10" r="8.5" fill={c} />
          <g stroke={dark} strokeWidth="0.6" fill="none">
            <ellipse cx="32" cy="10" rx="8.5" ry="3" />
            <ellipse cx="32" cy="10" rx="3.5" ry="8.5" />
            <path d="M23.5 10H40.5M32 1.5V18.5" />
          </g>
          <path d="M27 5.5L30 5.5L30 8.5L27 8.5Z" fill="#fff" opacity="0.85" />
          <path d={sparkle(44, 4, 2.6)} fill={accent} />
          <path d={sparkle(19, 6, 1.9)} fill="#fff" />
        </g>
      );
    case 'cowboy':
      return (
        <g>
          <path fill={c} d="M10 20C14 24 22 22 32 22S50 24 54 20C52 17 46 18 43 17L41 7C39 4 36 6 32 6S25 4 23 7L21 17C18 18 12 17 10 20Z" />
          <path d="M22 16Q32 19 42 16" fill="none" stroke={accent} strokeWidth="2" />
          {[25, 29, 33, 37].map((x) => <circle key={x} cx={x + 1} cy="17.2" r="0.8" fill="#fff" />)}
        </g>
      );
    case 'moon':
      return (
        <g>
          <path d="M21 22Q32 15.5 43 22" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <path fill={c} d="M35 3A8 8 0 1 0 38 17A6.3 6.3 0 1 1 35 3Z" />
          <path d={sparkle(41, 7, 2)} fill={accent} />
        </g>
      );
    case 'bow':
      return (
        <g>
          <path fill={c} stroke={dark} strokeWidth="0.8" d="M38 16L29 9C27 12 27 18 29 21ZM38 16L47 9C49 12 49 18 47 21Z" />
          <circle cx="38" cy="15.5" r="2.6" fill={accent} />
        </g>
      );
    case 'antenna':
      return (
        <g stroke={c} strokeWidth="1.6" strokeLinecap="round">
          <path d="M26 19L22 7M38 19L42 7" />
          <circle cx="22" cy="6" r="2.6" fill={accent} stroke="none" />
          <circle cx="42" cy="6" r="2.6" fill={accent} stroke="none" />
        </g>
      );
    case 'none':
      return null;
  }
}

// ── Eyes ────────────────────────────────────────────────────────────────
function lashEye(x: number, dir: -1 | 1, shadow: string, open = true): ReactElement {
  // dir -1 = left eye (wing to the left), 1 = right eye; x = eye centre.
  const o = x;
  return (
    <g>
      <ellipse cx={o} cy="29.6" rx="3.9" ry="2.7" fill={shadow} opacity="0.95" />
      {open ? (
        <>
          <ellipse cx={o} cy="31" rx="2.6" ry="1.9" fill="#fff" />
          <circle cx={o + dir * 0.3} cy="31.2" r="1.35" fill={INK} />
          <circle cx={o + dir * 0.3 + 0.5} cy="30.6" r="0.45" fill="#fff" />
        </>
      ) : null}
      <path
        d={open ? `M${o - 3} 30.4Q${o} 28.4 ${o + 3} 30.4` : `M${o - 2.8} 31Q${o} 33 ${o + 2.8} 31`}
        fill="none"
        stroke={INK}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d={`M${o + dir * 2.8} 30.3L${o + dir * 5.2} 28.2M${o + dir * 1.6} 29.3L${o + dir * 3} 26.9M${o + dir * 0.1} 28.9L${o + dir * 0.6} 26.6`}
        stroke={INK}
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </g>
  );
}

function eyes(style: EyeStyle, c: string): ReactElement {
  const dark = shade(c, -0.45);
  switch (style) {
    case 'lashes':
      return <g>{lashEye(27.2, -1, c)}{lashEye(36.8, 1, c)}</g>;
    case 'wink':
      return <g>{lashEye(27.2, -1, c)}{lashEye(36.8, 1, c, false)}</g>;
    case 'glitter':
      return (
        <g>
          {lashEye(27.2, -1, c)}
          {lashEye(36.8, 1, c)}
          <path d={sparkle(23.5, 34.5, 1.6)} fill="#fff" />
          <path d={sparkle(40.5, 34.5, 1.6)} fill="#fff" />
        </g>
      );
    case 'cateye':
      return (
        <g>
          <path fill={c} stroke={dark} strokeWidth="1" strokeLinejoin="round" d="M19.5 27.5L31 29.2L30.2 32.8C29 35 24.5 35.2 22.6 33Z" />
          <path fill={c} stroke={dark} strokeWidth="1" strokeLinejoin="round" d="M44.5 27.5L33 29.2L33.8 32.8C35 35 39.5 35.2 41.4 33Z" />
          <path d="M31 30L33 30" stroke={dark} strokeWidth="1.2" />
          <path d="M24 30.2L27 30.6M37 30.6L40 30.2" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" opacity="0.8" />
          <circle cx="19.8" cy="27.6" r="1" fill="#fff" />
          <circle cx="44.2" cy="27.6" r="1" fill="#fff" />
        </g>
      );
    case 'heart':
      return (
        <g>
          <path d={heart(27, 30.8, 3.6)} fill={c} stroke={dark} strokeWidth="0.9" />
          <path d={heart(37, 30.8, 3.6)} fill={c} stroke={dark} strokeWidth="0.9" />
          <path d="M30 29.6Q32 28.6 34 29.6" fill="none" stroke={dark} strokeWidth="1" />
          <path d="M25 29.3L26.2 28.6M35 29.3L36.2 28.6" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      );
    case 'star':
      return (
        <g>
          <path d={star(27, 30.8, 5)} fill={c} stroke={dark} strokeWidth="0.8" strokeLinejoin="round" />
          <path d={star(37, 30.8, 5)} fill={c} stroke={dark} strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M30.5 30.2L33.5 30.2" stroke={dark} strokeWidth="1" />
        </g>
      );
    case 'round':
      return (
        <g>
          <circle cx="27" cy="31" r="4" fill={c} stroke="#FFC53D" strokeWidth="1.2" />
          <circle cx="37" cy="31" r="4" fill={c} stroke="#FFC53D" strokeWidth="1.2" />
          <path d="M31 30.5Q32 29.6 33 30.5" fill="none" stroke="#FFC53D" strokeWidth="1" />
          <path d="M25 29.5L26.5 28.6M35 29.5L36.5 28.6" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      );
    case 'visor':
      return (
        <g>
          <rect x="19" y="27.2" width="26" height="6.6" rx="3.3" fill={c} stroke={dark} strokeWidth="0.8" />
          <rect x="21.5" y="28.6" width="21" height="1.4" rx="0.7" fill="#fff" opacity="0.7" />
          <circle cx="26" cy="31.6" r="0.9" fill="#fff" />
          <circle cx="38" cy="31.6" r="0.9" fill="#fff" />
        </g>
      );
    case 'mask':
      return (
        <g>
          <path
            fill={c}
            stroke={dark}
            strokeWidth="0.8"
            d="M18 27C21 26 26 27 32 29.5C38 27 43 26 46 27C46 32 43 35.5 38.5 35C35 34.6 33.5 33 32 33S29 34.6 25.5 35C21 35.5 18 32 18 27Z"
          />
          <ellipse cx="27" cy="31" rx="2.8" ry="1.8" fill={INK} />
          <ellipse cx="37" cy="31" rx="2.8" ry="1.8" fill={INK} />
          <circle cx="27.8" cy="30.5" r="0.5" fill="#fff" />
          <circle cx="37.8" cy="30.5" r="0.5" fill="#fff" />
          <path d={sparkle(46, 26.5, 2.6)} fill="#FFE08A" />
        </g>
      );
  }
}

function mouth(style: MouthStyle, c: string): ReactElement {
  const dark = shade(c, -0.35);
  switch (style) {
    case 'lips':
      return (
        <g>
          <path fill={c} d="M27.2 39.2Q29.7 37 32 38.3Q34.3 37 36.8 39.2Q32 43.4 27.2 39.2Z" />
          <path d="M27.6 39.3Q32 40.4 36.4 39.3" fill="none" stroke={dark} strokeWidth="0.6" />
          <ellipse cx="33.8" cy="40.6" rx="1" ry="0.45" fill="#fff" opacity="0.6" />
        </g>
      );
    case 'smile':
      return (
        <g>
          <path fill={dark} d="M27.5 38.3Q32 44 36.5 38.3Q32 39.6 27.5 38.3Z" />
          <path fill="#fff" d="M28.6 38.8Q32 40 35.4 38.8L35 39.8Q32 40.6 29 39.8Z" />
          <path d="M27.5 38.3Q32 44 36.5 38.3" fill="none" stroke={c} strokeWidth="1.1" strokeLinecap="round" />
        </g>
      );
    case 'sing':
      return (
        <g>
          <ellipse cx="32" cy="39.8" rx="2.9" ry="3.3" fill={c} />
          <ellipse cx="32" cy="40" rx="1.7" ry="2.2" fill="#3A0A22" />
        </g>
      );
    case 'smirk':
      return (
        <g>
          <path fill={c} d="M28 39.4Q31 38 33 38.8Q35 37.6 37 38.2Q35 42 30.5 41.2Q28.6 40.8 28 39.4Z" />
          <circle cx="38.2" cy="37.8" r="0.6" fill={INK} />
        </g>
      );
  }
}

// ── Collars ─────────────────────────────────────────────────────────────
const BODY = 'M5 66C7 54 18 49.5 32 49.5S57 54 59 66Z';

function collarBack(style: CollarStyle, c: string): ReactElement | null {
  if (style !== 'cape') return null;
  return <path fill={shade(c, -0.25)} d="M11 64L15 34L27 47ZM53 64L49 34L37 47Z" />;
}

function collar(style: CollarStyle, c: string, accent: string): ReactElement {
  const dark = shade(c, -0.3);
  const body = <path d={BODY} fill={c} />;
  switch (style) {
    case 'sequins': {
      const dots: ReactElement[] = [];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 12; col++) {
          const x = 10 + col * 4 + (row % 2) * 2;
          const y = 53 + row * 3.4;
          dots.push(<circle key={`${row}-${col}`} cx={x} cy={y} r="1.15" fill={(row + col) % 3 === 0 ? '#fff' : accent} opacity={(row + col) % 3 === 0 ? 0.9 : 0.75} />);
        }
      }
      return <g>{body}{dots}<path d="M26 50Q32 55 38 50" fill="none" stroke={accent} strokeWidth="1.4" /></g>;
    }
    case 'pads':
      return (
        <g>
          {body}
          <path fill={accent} d="M3 56L19 48.5L23 58Z" />
          <path fill={accent} d="M61 56L45 48.5L41 58Z" />
          <path fill={dark} d="M26 50L32 60L38 50Z" />
        </g>
      );
    case 'boa':
      return (
        <g>
          {body}
          {[8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 57].map((x, i) => (
            <circle key={i} cx={x} cy={52 + Math.abs(x - 32) * -0.12 + (i % 2) * 1.4} r="4.4" fill={i % 2 ? accent : shade(accent, 0.25)} />
          ))}
        </g>
      );
    case 'ruff':
      return (
        <g>
          {body}
          <path
            fill={accent}
            stroke={shade(accent, -0.2)}
            strokeWidth="0.6"
            d="M16 50L20 46L22 51L26 46.5L28 51.5L32 47L36 51.5L38 46.5L42 51L44 46L48 50L45 55L40 53.5L36 56L32 54L28 56L24 53.5L19 55Z"
          />
        </g>
      );
    case 'cape':
      return (
        <g>
          {body}
          <path d="M26 50L32 58L38 50" fill={accent} />
          <circle cx="32" cy="55" r="1.8" fill="#FFC53D" />
        </g>
      );
    case 'pearls':
      return (
        <g>
          {body}
          {Array.from({ length: 11 }, (_, i) => {
            const t = i / 10;
            const x = 22 + t * 20;
            const y = 51 + Math.sin(t * Math.PI) * 6;
            return <circle key={i} cx={x} cy={y} r="1.6" fill="#FFF8EC" stroke={shade(c, -0.35)} strokeWidth="0.3" />;
          })}
          <circle cx="32" cy="58.6" r="2.4" fill={accent} />
        </g>
      );
    case 'lapels':
      return (
        <g>
          {body}
          <path fill="#fff" d="M25 50L32 62L39 50Z" />
          <path fill={dark} d="M18 51L25 50L31 63L24 60ZM46 51L39 50L33 63L40 60Z" />
          <path fill={accent} d="M32 53L27.5 50.5L27.5 55.5ZM32 53L36.5 50.5L36.5 55.5Z" />
          <circle cx="32" cy="53" r="1.2" fill={shade(accent, -0.3)} />
        </g>
      );
    case 'stars':
      return (
        <g>
          {body}
          {[[14, 58], [22, 55], [42, 55], [50, 58], [32, 60]].map(([x, y], i) => (
            <path key={i} d={star(x, y, 2.8)} fill={accent} />
          ))}
        </g>
      );
  }
}

// ── Avatar ──────────────────────────────────────────────────────────────
export interface AvatarArtProps {
  spec: AvatarSpec;
  /** Rendered size in px (width = height). Omit to fill the parent. */
  size?: number;
  title?: string;
  className?: string;
}

export function AvatarArt({ spec, size, title, className }: AvatarArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clip = `av-c-${uid}`;
  const grad = `av-g-${uid}`;
  const { skin, hair, eyes: eye, lips, head, collar: col, extras = [] } = spec;
  const skinShade = shade(skin, -0.16);
  const has = (e: string) => extras.includes(e as never);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size ?? '100%'}
      height={size ?? '100%'}
      className={className}
      data-avatar-art={spec.id}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
        <radialGradient id={grad} cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor={spec.bg[0]} />
          <stop offset="1" stopColor={spec.bg[1]} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill={`url(#${grad})`} />
        {spec.sparkles && (
          <g fill="#fff" opacity="0.75">
            <path d={sparkle(9, 14, 2.6)} />
            <path d={sparkle(55, 40, 2)} />
            <path d={sparkle(52, 9, 1.4)} />
          </g>
        )}
        {/* The character is drawn 10% larger than its 64-unit grid so the face reads at 32px. */}
        <g transform="translate(32 36) scale(1.1) translate(-32 -36)">
        {collarBack(col.style, col.color)}
        {hairBack(hair.style, hair.color)}
        {collar(col.style, col.color, col.accent ?? '#FFC53D')}
        <path d="M27.5 41H36.5V51.5Q32 54 27.5 51.5Z" fill={skinShade} />
        <circle cx="20.6" cy="33" r="2.6" fill={skinShade} />
        <circle cx="43.4" cy="33" r="2.6" fill={skinShade} />
        <ellipse cx="32" cy="32" rx="11.6" ry="13.4" fill={skin} />
        <ellipse cx="24.4" cy="36.2" rx="2.7" ry="1.6" fill="#FF5FA2" opacity="0.38" />
        <ellipse cx="39.6" cy="36.2" rx="2.7" ry="1.6" fill="#FF5FA2" opacity="0.38" />
        {spec.brows !== false && (
          <path d="M23.2 26.2Q27 23.4 30.6 25.4M33.4 25.4Q37 23.4 40.8 26.2" fill="none" stroke={shade(hair.style === 'bald' ? '#3A2A3F' : hair.color, -0.35)} strokeWidth="1.1" strokeLinecap="round" />
        )}
        {eyes(eye.style, eye.color)}
        {mouth(lips.style, lips.color)}
        {has('mole') && <circle cx="37.6" cy="37.6" r="0.75" fill={INK} />}
        {has('starpaint') && <path d={star(40.6, 35.6, 2.4)} fill="#FFC53D" />}
        {has('tear') && <path d="M24.6 34.5Q23.6 36.6 24.6 37.4Q25.6 36.6 24.6 34.5Z" fill="#2EE6D6" />}
        {has('gem') && <path d="M32 24.3L33.3 26L32 27.7L30.7 26Z" fill="#2EE6D6" stroke="#fff" strokeWidth="0.4" />}
        {hairFront(hair.style, hair.color)}
        {head && head.style !== 'none' && headpiece(head.style, head.color, head.accent ?? '#F0469C')}
        {has('earrings') && (
          <g fill="none" stroke="#FFC53D" strokeWidth="1.2">
            <circle cx="20.4" cy="38.4" r="2.4" />
            <circle cx="43.6" cy="38.4" r="2.4" />
          </g>
        )}
        {has('drops') && (
          <g fill="#C9A2FF" stroke="#fff" strokeWidth="0.4">
            <path d="M20.4 36L22 39.5L20.4 42L18.8 39.5Z" />
            <path d="M43.6 36L45.2 39.5L43.6 42L42 39.5Z" />
          </g>
        )}
        </g>
        <circle cx="32" cy="32" r="31.2" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="1.6" />
      </g>
    </svg>
  );
}
