/**
 * Compare two SEO snapshots. Exit 1 on removed routes or hard SEO-field changes;
 * internal-link and H2-count changes are warnings only.
 *
 * JSON-LD `dateModified` is the one volatile value: where a page derives it
 * from the build (PredictionsPage: VITE_BUILD_DATE = the HEAD commit date,
 * vite.config.ts buildDate()), it moves on every commit. A JSON-LD change
 * that is *only* a dateModified date moving to another valid date is a
 * warning. Anything else in JSON-LD, including dateModified appearing,
 * disappearing or turning into a non-date, is still an error.
 * `datePublished` is a fixed constant on every page, so it stays an error.
 *
 * With a policy (an SEO intent, scripts/seo/intent.ts), a hard change the
 * intent declares for that route and field is reported under ALLOWED
 * instead of ERRORS, and a removed route the policy accepts (a 301 in
 * vercel.json) likewise. The build runs this through scripts/seo/guard.ts.
 *
 *   npx tsx scripts/seo/snapshot-diff.ts before.json after.json [--intent seo-intent.json]
 *
 * before/after: a snapshot (snapshot.ts) or a deployed /_seo/snapshot.json.
 * --intent applies every entry in the file (the guard applies only the ones
 * the live snapshot has not seen).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBaseline, type Snapshot } from './snapshot';

const HARD = ['title', 'description', 'robots', 'canonical', 'h1', 'hreflang', 'jsonLd'] as const;
const SOFT = ['ogTitle', 'ogDescription'] as const;

export type HardField = (typeof HARD)[number];

/** What an SEO intent lets change (scripts/seo/intent.ts). */
export interface DiffPolicy {
  allows(route: string, field: HardField): boolean;
  /** `builtRoutes`: the routes of the new snapshot (where a redirect may land). */
  allowsRemoval(route: string, builtRoutes: Set<string>): boolean;
}

export interface DiffResult {
  added: string[];
  removed: string[];
  errors: string[];
  /** Hard changes the policy declared (empty without one). */
  allowed: string[];
  warnings: string[];
  exitCode: 0 | 1;
}

const j = (v: unknown): string => JSON.stringify(v);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const VOLATILE_DATE = '<dateModified>';

/** A JSON-LD entry with every date-valued `dateModified` masked (see header). */
export function maskVolatileDates(entry: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(entry);
  } catch {
    return entry; // INVALID:… entries compare verbatim
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) =>
        [k, k === 'dateModified' && typeof x === 'string' && ISO_DATE.test(x) ? VOLATILE_DATE : walk(x)]));
    }
    return v;
  };
  return JSON.stringify(walk(parsed));
}
const minus = (a: string[], b: string[]): string[] => a.filter((x) => !b.includes(x));

export function diffSnapshots(before: Snapshot, after: Snapshot, policy?: DiffPolicy): DiffResult {
  const bk = Object.keys(before);
  const ak = Object.keys(after);
  const added = ak.filter((k) => !(k in before)).sort();
  const removed = bk.filter((k) => !(k in after)).sort();
  const errors: string[] = [];
  const allowed: string[] = [];
  const built = new Set(ak);
  for (const r of removed) {
    if (policy?.allowsRemoval(r, built)) allowed.push(`removed route (301 in vercel.json): ${r}`);
    else errors.push(`removed route: ${r}`);
  }
  const warnings: string[] = added.map((r) => `added route: ${r}`);

  for (const route of bk.filter((k) => k in after).sort()) {
    const b = before[route];
    const a = after[route];
    for (const f of HARD) {
      if (j(b[f]) === j(a[f])) continue;
      if (f === 'hreflang' || f === 'jsonLd') {
        const rem = minus(b[f], a[f]).map((x) => `\n      - ${x}`).join('');
        const add = minus(a[f], b[f]).map((x) => `\n      + ${x}`).join('');
        const onlyDateModified = f === 'jsonLd'
          && j(b.jsonLd.map(maskVolatileDates)) === j(a.jsonLd.map(maskVolatileDates));
        if (onlyDateModified) warnings.push(`${route} jsonLd dateModified changed:${rem}${add}`);
        else (policy?.allows(route, f) ? allowed : errors).push(`${route} ${f} changed:${rem}${add}`);
      } else {
        (policy?.allows(route, f) ? allowed : errors).push(`${route} ${f}: ${j(b[f])} -> ${j(a[f])}`);
      }
    }
    for (const f of SOFT) {
      if (j(b[f]) !== j(a[f])) warnings.push(`${route} ${f}: ${j(b[f])} -> ${j(a[f])}`);
    }
    if (b.h2Count !== a.h2Count) warnings.push(`${route} h2Count: ${b.h2Count} -> ${a.h2Count}`);
    const added2 = minus(a.internalLinks, b.internalLinks);
    const removed2 = minus(b.internalLinks, a.internalLinks);
    if (added2.length || removed2.length) {
      const parts = [];
      if (removed2.length) parts.push(`removed [${removed2.join(', ')}]`);
      if (added2.length) parts.push(`added [${added2.join(', ')}]`);
      warnings.push(`${route} internal links: ${parts.join(' ')}`);
    }
  }
  return { added, removed, errors, allowed, warnings, exitCode: errors.length ? 1 : 0 };
}

/** The diff as the CLI and the build print it. */
export function formatDiff(r: DiffResult): string {
  const out = [`routes added: ${r.added.length}, removed: ${r.removed.length}`];
  if (r.errors.length) out.push(`\nERRORS (${r.errors.length}):\n  ${r.errors.join('\n  ')}`);
  if (r.allowed.length) out.push(`\nALLOWED BY SEO INTENT (${r.allowed.length}):\n  ${r.allowed.join('\n  ')}`);
  if (r.warnings.length) out.push(`\nWARNINGS (${r.warnings.length}):\n  ${r.warnings.join('\n  ')}`);
  out.push(r.exitCode ? '\nFAIL: SEO regression detected' : '\nOK: no blocking SEO changes');
  return out.join('\n');
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--intent');
  const intentPath = i >= 0 ? args[i + 1] : undefined;
  const [bp, ap] = args.filter((_, k) => i < 0 || (k !== i && k !== i + 1));
  if (!bp || !ap || (i >= 0 && !intentPath)) {
    console.error('usage: snapshot-diff.ts <before.json> <after.json> [--intent seo-intent.json]');
    process.exit(2);
  }
  const before = readBaseline(JSON.parse(readFileSync(bp, 'utf8'))).routes;
  const after = readBaseline(JSON.parse(readFileSync(ap, 'utf8'))).routes;
  let policy: DiffPolicy | undefined;
  if (intentPath) {
    const { intentContext, intentPolicy, readIntentFile } = await import('./intent');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    policy = intentPolicy(readIntentFile(resolve(intentPath)), intentContext(root));
  }
  const r = diffSnapshots(before, after, policy);
  console.log(formatDiff(r));
  process.exit(r.exitCode);
}
