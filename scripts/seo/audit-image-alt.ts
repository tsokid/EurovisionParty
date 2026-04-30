import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../../src');

interface Finding {
  file: string;
  line: number;
  match: string;
  reason: 'missing-alt' | 'empty-alt' | 'placeholder-alt';
}

// Walk the src tree picking up TSX/TS files only.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(full, out);
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

// Treat any of these as placeholder/lazy alt values worth flagging.
const PLACEHOLDER_VALUES = ['todo', 'tbd', 'image', 'photo', 'picture', 'icon', 'fixme'];

// Scan one file's source for <img> tags. Reports:
//   - missing alt attribute entirely
//   - alt with placeholder text ("image", "todo", etc.)
// Decorative <img alt=""> is allowed (semantic — tells screen readers to skip).
function scanFile(file: string): Finding[] {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const out: Finding[] = [];

  // Match <img ...>  (greedy across newlines but capped to 800 chars to avoid runaway)
  const imgRe = /<img\b[^>]{0,800}>/gs;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(src)) !== null) {
    const tag = m[0];
    // Compute line number from char offset
    const lineNo = src.slice(0, m.index).split('\n').length;
    const altMatch = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/);
    if (!altMatch) {
      out.push({ file, line: lineNo, match: tag.slice(0, 120), reason: 'missing-alt' });
      continue;
    }
    const altValue = (altMatch[1] ?? altMatch[2] ?? altMatch[3] ?? '').trim();
    // Empty alt "" is decorative, always acceptable. Skip.
    if (altValue === '') continue;
    // JSX expressions like {country.name} are fine — assume they evaluate to real text.
    // Only flag literal-string placeholders.
    const lower = altValue.toLowerCase();
    if (PLACEHOLDER_VALUES.includes(lower)) {
      out.push({ file, line: lineNo, match: tag.slice(0, 120), reason: 'placeholder-alt' });
    }
  }
  return out;
}

const files = walk(SRC);
const findings: Finding[] = [];
for (const f of files) findings.push(...scanFile(f));

if (findings.length === 0) {
  console.log(`✅ Image alt audit clean across ${files.length} TS/TSX files (no missing or placeholder alts).`);
  process.exit(0);
}

console.log(`❌ Found ${findings.length} image alt issue(s) across ${files.length} files:\n`);
for (const f of findings) {
  const rel = f.file.replace(SRC + '\\', '').replace(SRC + '/', '');
  console.log(`  [${f.reason}] ${rel}:${f.line}`);
  console.log(`    ${f.match}\n`);
}
process.exit(1);
