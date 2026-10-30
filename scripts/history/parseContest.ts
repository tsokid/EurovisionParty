// Parses one "Eurovision Song Contest {year}" Wikipedia article (wikitext)
// into a ContestRecord: host, city, dates, and every entry with its semi and
// final results.
//
// Result tables are found by caption ("Results of the final ...", "First
// semi-final of ...", "Planned participants of ...") and read by header row
// (Running order / Country / Artist / Song / Points / Place). Jury and
// televote points come from the "Split results" table of the final, and are
// kept only when jury + televote equals the total for every finalist (2016
// onwards); the 2009–2015 split tables are rank-based and are not stored.
import { toIso } from './countryNames';

export type EntryRecord = {
  iso: string;
  artist: string | null;
  song: string | null;
  semi: 1 | 2 | null;
  semi_place: number | null;
  semi_points: number | null;
  qualified: boolean | null;
  in_final: boolean;
  final_running_order: number | null;
  final_place: number | null;
  total_points: number | null;
  jury_points: number | null;
  televote_points: number | null;
};

export type ContestRecord = {
  year: number;
  city: string;
  host_iso: string;
  final_date: string | null;
  semi1_date: string | null;
  semi2_date: string | null;
  cancelled: boolean;
  entries: EntryRecord[];
};

/**
 * Corrections applied after parsing, each with its reason. Only for facts
 * where the article's wording is not the name the contest is known by.
 */
const CITY_OVERRIDES: Record<number, { city: string; reason: string }> = {
  2010: {
    city: 'Oslo',
    reason: 'Infobox names the venue municipality (Bærum); the EBU event is "Oslo 2010".',
  },
};

// ── Wikitext helpers ────────────────────────────────────────────────────

/** Removes comments, references and footnote templates. */
export function stripNoise(text: string): string {
  let s = text.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref\b[^>]*\/>/gi, '');
  s = s.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = removeTemplates(s, /^(efn|efn-ua|efn-lr|efn-lg|sfn|sfnm|refn|r|rp|cn|citation needed|cite [a-z]+|citation|ref label|note label|anchor)$/i);
  return s;
}

/** Removes every template (with nested content) whose name matches `names`. */
function removeTemplates(text: string, names: RegExp): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('{{', i)) {
      const end = matchBraces(text, i);
      const inner = text.slice(i + 2, end - 2);
      const name = inner.split(/[|}]/, 1)[0].trim();
      if (end > i && names.test(name)) {
        i = end;
        continue;
      }
      out += '{{';
      i += 2;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

/** Index just past the "}}" closing the "{{" at `start` (or text.length). */
function matchBraces(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i++;
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/** Splits on `sep` where not inside {{ }} or [[ ]]. */
function splitTop(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depthT = 0;
  let depthL = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{') { depthT++; cur += two; i++; continue; }
    if (two === '}}' && depthT > 0) { depthT--; cur += two; i++; continue; }
    if (two === '[[') { depthL++; cur += two; i++; continue; }
    if (two === ']]' && depthL > 0) { depthL--; cur += two; i++; continue; }
    if (depthT === 0 && depthL === 0 && text.startsWith(sep, i)) {
      parts.push(cur);
      cur = '';
      i += sep.length - 1;
      continue;
    }
    cur += text[i];
  }
  parts.push(cur);
  return parts;
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', minus: '−', shy: '',
};

function renderTemplate(inner: string): string {
  const parts = splitTop(inner, '|');
  const name = parts[0].trim().toLowerCase().replace(/_/g, ' ');
  const params = parts.slice(1);
  const positional = params.filter((p) => !/^\s*[A-Za-z][\w -]*\s*=/.test(p)).map((p) => p.trim());
  switch (name) {
    case 'lang':
      return positional[1] ?? '';
    case 'ill': {
      // Interlanguage link: the display text is lt= when given.
      const lt = params.find((p) => /^\s*lt\s*=/.test(p));
      return lt ? lt.replace(/^\s*lt\s*=/, '').trim() : (positional[0] ?? '');
    }
    case 'sortname':
      return [positional[0], positional[1]].filter(Boolean).join(' ');
    case 'feat.':
    case 'feat':
      return 'feat.';
    case 'hlist':
    case 'ubl':
    case 'unbulleted list':
    case 'plainlist':
    case 'flatlist':
      return positional.join(', ');
    case 'nbsp':
      return ' ';
    case 'snd':
    case 'spaced ndash':
      return ' – ';
    case 'ndash':
      return '–';
    case 'mdash':
      return '—';
    case 'space+double':
    case 'double+space':
      return '"';
    case 'space+single':
    case 'single+space':
      return "'";
    case 'double+single':
      return `"'`;
    case 'single+double':
      return `'"`;
    case "'":
      return "'";
    case '"':
      return '"';
    case 'transl':
    case 'transliteration':
      return positional[positional.length - 1] ?? '';
    case 'n/a':
    case 'flagicon':
    case 'flagdeco':
    case 'flag icon':
    case 'legend':
    case 'dagger':
    case 'double-dagger':
      return '';
    default:
      if (/^lang-/.test(name)) return positional[0] ?? '';
      return positional[0] ?? '';
  }
}

/** Wikitext fragment → plain text. */
export function renderInline(text: string): string {
  let s = stripNoise(text);
  // Links, innermost first. Files and categories are dropped.
  for (let guard = 0; guard < 50 && /\[\[/.test(s); guard++) {
    const next = s.replace(/\[\[([^[\]]*)\]\]/g, (_, body: string) => {
      if (/^\s*(file|image|category):/i.test(body)) return '';
      const pipe = body.indexOf('|');
      if (pipe < 0) return body;
      const label = body.slice(pipe + 1);
      // Pipe trick: [[Page (qualifier)|]] shows "Page".
      return label.trim() === '' ? body.slice(0, pipe).replace(/\s*\([^)]*\)\s*$/, '') : label;
    });
    if (next === s) break;
    s = next;
  }
  // Templates, innermost first.
  for (let guard = 0; guard < 50 && /\{\{/.test(s); guard++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => renderTemplate(inner));
    if (next === s) break;
    s = next;
  }
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<\/?[a-z][^>]*>/gi, '');
  s = s.replace(/'{2,}/g, '');
  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return String.fromCodePoint(n);
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
  return s.replace(/\s+/g, ' ').trim();
}

// ── Tables ──────────────────────────────────────────────────────────────

type Cell = { header: boolean; attrs: string; raw: string };
type Row = { attrs: string; cells: Cell[] };
export type Table = {
  caption: string;
  /** Column labels (header rows joined per column). */
  columns: string[];
  /** Body rows as a grid (rowspan/colspan expanded). */
  body: { attrs: string; cells: (Cell | undefined)[] }[];
};

const ATTRS_ONLY = /^\s*(?:[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'|]+)\s*)*$/;
const ATTRS_THEN_TEMPLATE = /^((?:\s*[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'|{]+))+)\s*(\{\{[\s\S]*)$/;

function makeCell(text: string, header: boolean): Cell {
  const parts = splitTop(text, '|');
  if (parts.length >= 2 && ATTRS_ONLY.test(parts[0]) && parts[0].trim() !== '') {
    return { header, attrs: parts[0].trim(), raw: parts.slice(1).join('|').trim() };
  }
  const m = text.match(ATTRS_THEN_TEMPLATE);
  if (m) return { header, attrs: m[1].trim(), raw: m[2].trim() };
  return { header, attrs: '', raw: text.trim() };
}

function attrNum(attrs: string, name: string): number {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, 'i'));
  return m ? Number(m[1]) : 1;
}

/** Every table in the wikitext (nested tables are returned separately). */
export function extractTables(wikitext: string): Table[] {
  const lines = wikitext.split('\n');
  const stack: string[][] = [];
  const raw: string[][] = [];
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith('{|')) {
      stack.push([]);
      continue;
    }
    if (t.startsWith('|}') && stack.length) {
      raw.push(stack.pop()!);
      continue;
    }
    if (stack.length) stack[stack.length - 1].push(line);
  }
  return raw.map(buildTable);
}

function buildTable(lines: string[]): Table {
  let caption = '';
  const rows: Row[] = [];
  let row: Row | null = null;
  let last: Cell | null = null;
  const ensureRow = () => {
    if (!row) {
      row = { attrs: '', cells: [] };
      rows.push(row);
    }
    return row;
  };
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith('|+')) {
      caption = makeCell(t.slice(2), false).raw;
      last = null;
    } else if (t.startsWith('|-')) {
      row = { attrs: t.slice(2).trim(), cells: [] };
      rows.push(row);
      last = null;
    } else if (t.startsWith('!')) {
      const r = ensureRow();
      for (const part of splitTop(t.slice(1), '!!').flatMap((p) => splitTop(p, '||'))) {
        last = makeCell(part, true);
        r.cells.push(last);
      }
    } else if (t.startsWith('|')) {
      const r = ensureRow();
      for (const part of splitTop(t.slice(1), '||')) {
        last = makeCell(part, false);
        r.cells.push(last);
      }
    } else if (last) {
      last.raw += '\n' + line;
    }
  }

  // Grid with rowspan/colspan expanded.
  const grid: { attrs: string; cells: (Cell | undefined)[] }[] = [];
  const pending: { cell: Cell; left: number }[] = [];
  for (const r of rows.filter((x) => x.cells.length > 0)) {
    const out: (Cell | undefined)[] = [];
    let col = 0;
    const place = (cell: Cell) => {
      while (pending[col] && pending[col].left > 0) {
        out[col] = pending[col].cell;
        pending[col].left--;
        col++;
      }
      const span = attrNum(cell.attrs, 'colspan');
      const rs = attrNum(cell.attrs, 'rowspan');
      for (let k = 0; k < span; k++) {
        out[col] = cell;
        pending[col] = { cell, left: rs - 1 };
        col++;
      }
    };
    for (const cell of r.cells) place(cell);
    while (pending[col] && pending[col].left > 0) {
      out[col] = pending[col].cell;
      pending[col].left--;
      col++;
    }
    grid.push({ attrs: r.attrs, cells: out });
  }

  // Header rows: leading rows made only of column-header cells.
  let h = 0;
  while (
    h < grid.length &&
    grid[h].cells.length > 0 &&
    grid[h].cells.every((c) => !c || (c.header && !/scope\s*=\s*"?row/i.test(c.attrs)))
  ) h++;
  const width = Math.max(0, ...grid.map((g) => g.cells.length));
  const columns: string[] = [];
  for (let c = 0; c < width; c++) {
    const labels: string[] = [];
    for (let r = 0; r < h; r++) {
      const cell = grid[r].cells[c];
      const label = cell ? renderInline(cell.raw) : '';
      if (label && labels[labels.length - 1] !== label) labels.push(label);
    }
    columns.push(labels.join(' '));
  }
  return { caption: renderInline(caption), columns, body: grid.slice(h) };
}

// ── Contest ─────────────────────────────────────────────────────────────

type Kind = { stage: 'final' } | { stage: 'semi'; semi: 1 | 2 };

function classify(caption: string): Kind | null {
  const c = caption.toLowerCase();
  if (!/^(results of|planned participants of|first semi-final|second semi-final|semi-final|final of)/.test(c)) return null;
  if (/qualifying round|kvalifikacija|pre-?qualif/.test(c)) return null;
  if (/semi-final/.test(c)) {
    if (/second|semi-final 2/.test(c)) return { stage: 'semi', semi: 2 };
    return { stage: 'semi', semi: 1 };
  }
  return { stage: 'final' };
}

const COUNTRY_TEMPLATE = /\{\{\s*(?:esc|esccnty|escfam|country|flagcountry)\s*\|\s*([^|}]+)/i;

/**
 * ISO from a country cell. Null only for placeholder cells (empty, or
 * "10 qualifiers from ..." in 2020); any other unknown name throws, so no
 * entry is ever dropped silently.
 */
function cellIso(raw: string): string | null {
  const m = stripNoise(raw).match(COUNTRY_TEMPLATE);
  if (m) return toIso(m[1]);
  const label = renderInline(raw);
  if (label === '' || /qualifier|^n\/a$|^tbd$/i.test(label)) return null;
  return toIso(label);
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const text = renderInline(raw).replace(/[,\s]/g, '');
  const m = text.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function song(raw: string): string | null {
  let s = renderInline(raw);
  if (s.startsWith('"')) {
    const end = s.indexOf('"', 1);
    if (end > 0) s = s.slice(1, end);
  }
  s = s.trim();
  return s === '' ? null : s;
}

function text(raw: string): string | null {
  const s = renderInline(raw);
  return s === '' ? null : s;
}

type ResultRow = {
  iso: string;
  artist: string | null;
  song: string | null;
  running_order: number | null;
  place: number | null;
  points: number | null;
  gold: boolean;
  disqualified: boolean;
};

function findCol(columns: string[], re: RegExp): number {
  return columns.findIndex((c) => re.test(c));
}

function readResults(t: Table): ResultRow[] {
  const col = {
    ro: findCol(t.columns, /^(r\/o|running order)/i),
    country: findCol(t.columns, /country/i),
    artist: findCol(t.columns, /artist/i),
    song: findCol(t.columns, /song/i),
    points: findCol(t.columns, /^(points|votes|score)/i),
    place: findCol(t.columns, /^place/i),
  };
  if (col.country < 0 || col.artist < 0 || col.song < 0) return [];
  const out: ResultRow[] = [];
  for (const r of t.body) {
    const c = r.cells;
    const countryCell = c[col.country];
    if (!countryCell) continue;
    const iso = cellIso(countryCell.raw);
    if (!iso) continue;
    out.push({
      iso,
      artist: c[col.artist] ? text(c[col.artist]!.raw) : null,
      song: c[col.song] ? song(c[col.song]!.raw) : null,
      running_order: col.ro >= 0 ? num(c[col.ro]?.raw) : null,
      place: col.place >= 0 ? num(c[col.place]?.raw) : null,
      points: col.points >= 0 ? num(c[col.points]?.raw) : null,
      gold: /gold/i.test(r.attrs),
      // Struck-through country with no result: disqualified before the
      // show (Netherlands in the 2024 final).
      disqualified: /<s>/i.test(countryCell.raw),
    });
  }
  return out;
}

/** jury/televote points per ISO from a final "Split results" table. */
function readSplit(t: Table): Map<string, { jury?: number; televote?: number }> {
  const out = new Map<string, { jury?: number; televote?: number }>();
  const pairs: [keyof { jury: number; televote: number }, RegExp][] = [
    ['jury', /^jury/i],
    ['televote', /^televot/i],
  ];
  for (const [key, re] of pairs) {
    const cc = t.columns.findIndex((c) => re.test(c) && /country/i.test(c));
    const pc = t.columns.findIndex((c) => re.test(c) && /points/i.test(c));
    if (cc < 0 || pc < 0) continue;
    for (const r of t.body) {
      const countryCell = r.cells[cc];
      if (!countryCell) continue;
      const iso = cellIso(countryCell.raw);
      const pts = num(r.cells[pc]?.raw);
      if (!iso || pts === null) continue;
      const cur = out.get(iso) ?? {};
      cur[key] = pts;
      out.set(iso, cur);
    }
  }
  return out;
}

/** Plain parameter value of the contest infobox. */
function infobox(wikitext: string, key: string): string | null {
  const m = wikitext.match(new RegExp(`\\n\\s*\\|\\s*${key}\\s*=([^\\n]*)`));
  return m ? m[1].trim() : null;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** ISO date from an infobox date value ({{start date|y|m|d}} or "d Month yyyy"). */
export function parseDate(value: string | null): string | null {
  if (!value) return null;
  const pad = (n: string | number) => String(n).padStart(2, '0');
  const sd = value.match(/\{\{\s*start date\s*\|([^}]*)\}\}/i);
  if (sd) {
    const nums = sd[1].split('|').map((p) => p.trim()).filter((p) => /^\d+$/.test(p));
    if (nums.length >= 3) return `${nums[0]}-${pad(nums[1])}-${pad(nums[2])}`;
  }
  const plain = renderInline(value).match(/(\d{1,2}) ([A-Za-z]+) (\d{4})/);
  if (plain) {
    const mi = MONTHS.indexOf(plain[2].toLowerCase());
    if (mi >= 0) return `${plain[3]}-${pad(mi + 1)}-${pad(plain[1])}`;
  }
  return null;
}

function venue(wikitext: string): { city: string; country: string } {
  const v = infobox(wikitext, 'venue');
  if (!v) throw new Error('infobox has no venue');
  const lines = v.split(/<br\s*\/?>/i);
  const place = renderInline(lines[lines.length - 1]);
  const comma = place.lastIndexOf(',');
  if (comma < 0) throw new Error(`venue "${place}" has no "City, Country"`);
  return { city: place.slice(0, comma).trim(), country: place.slice(comma + 1).trim() };
}

/** Parses one contest article. Throws when the result tables cannot be read. */
export function parseContest(year: number, wikitext: string): ContestRecord {
  const clean = stripNoise(wikitext);
  const v = venue(clean);
  const finalRaw = infobox(clean, 'final');
  const cancelled = /cancel/i.test(finalRaw ?? '');

  let finalRows: ResultRow[] | null = null;
  const semiRows = new Map<1 | 2, ResultRow[]>();
  let split: Map<string, { jury?: number; televote?: number }> | null = null;

  for (const t of extractTables(clean)) {
    const cap = t.caption;
    if (/split results/i.test(cap)) {
      if (!/semi/i.test(cap)) split = readSplit(t);
      continue;
    }
    const kind = classify(cap);
    if (!kind) continue;
    const rows = readResults(t);
    if (rows.length === 0) continue;
    if (kind.stage === 'final') {
      if (finalRows) throw new Error(`${year}: more than one final results table`);
      finalRows = rows;
    } else {
      if (semiRows.has(kind.semi)) throw new Error(`${year}: more than one table for semi ${kind.semi}`);
      semiRows.set(kind.semi, rows);
    }
  }
  if (!finalRows) throw new Error(`${year}: no final results table`);

  finalRows = mergeDuplicates(year, finalRows);
  const finalByIso = new Map(finalRows.map((r) => [r.iso, r]));
  const entries = new Map<string, EntryRecord>();
  const blank = (iso: string): EntryRecord => ({
    iso, artist: null, song: null, semi: null, semi_place: null, semi_points: null, qualified: null,
    in_final: false, final_running_order: null, final_place: null, total_points: null,
    jury_points: null, televote_points: null,
  });

  for (const [semi, rows] of [...semiRows.entries()].sort((a, b) => a[0] - b[0])) {
    for (const r of rows) {
      if (entries.has(r.iso)) throw new Error(`${year}: ${r.iso} appears in more than one semi-final`);
      const e = blank(r.iso);
      e.artist = r.artist;
      e.song = r.song;
      e.semi = semi;
      if (!cancelled) {
        e.semi_place = r.place;
        e.semi_points = r.points;
        e.qualified = finalByIso.has(r.iso);
      }
      entries.set(r.iso, e);
    }
  }

  for (const r of finalRows) {
    const e = entries.get(r.iso) ?? blank(r.iso);
    e.artist = r.artist ?? e.artist;
    e.song = r.song ?? e.song;
    if (r.disqualified) {
      // Qualified (semi result kept) but never performed in the final.
      if (r.place !== null || r.points !== null) throw new Error(`${year}: struck-through ${r.iso} has a result`);
    } else if (!cancelled) {
      e.in_final = true;
      e.final_running_order = r.running_order;
      e.total_points = r.points;
      // 1956: only the winner was announced (no Place column).
      e.final_place = r.place ?? (r.gold ? 1 : null);
    }
    entries.set(r.iso, e);
  }

  if (split && !cancelled) applySplit(entries, split);

  return {
    year,
    city: CITY_OVERRIDES[year]?.city ?? v.city,
    host_iso: toIso(v.country),
    final_date: parseDate(finalRaw),
    semi1_date: parseDate(infobox(clean, 'semi1') ?? infobox(clean, 'semi')),
    semi2_date: parseDate(infobox(clean, 'semi2')),
    cancelled,
    entries: [...entries.values()].sort((a, b) => a.iso.localeCompare(b.iso)),
  };
}

/** Stores jury/televote only when both add up to the total for every finalist. */
function applySplit(entries: Map<string, EntryRecord>, split: Map<string, { jury?: number; televote?: number }>): void {
  const finalists = [...entries.values()].filter((e) => e.in_final);
  const consistent = finalists.every((e) => {
    const s = split.get(e.iso);
    return s?.jury !== undefined && s.televote !== undefined && e.total_points === s.jury + s.televote;
  });
  if (!consistent) return;
  for (const e of finalists) {
    const s = split.get(e.iso)!;
    e.jury_points = s.jury!;
    e.televote_points = s.televote!;
  }
}

/**
 * One row per country. 1956 had two songs per country: the winning song is
 * kept on its own; otherwise both are joined with " / " and the running
 * order is dropped. Any other year with a duplicate country throws.
 */
function mergeDuplicates(year: number, rows: ResultRow[]): ResultRow[] {
  const byIso = new Map<string, ResultRow[]>();
  for (const r of rows) byIso.set(r.iso, [...(byIso.get(r.iso) ?? []), r]);
  const out: ResultRow[] = [];
  for (const [iso, list] of byIso) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    if (year !== 1956) throw new Error(`${year}: ${iso} appears ${list.length} times in the final`);
    const winner = list.find((r) => r.gold || r.place === 1);
    if (winner) {
      out.push(winner);
      continue;
    }
    const join = (xs: (string | null)[]) => {
      const uniq = [...new Set(xs.filter((x): x is string => x !== null))];
      return uniq.length ? uniq.join(' / ') : null;
    };
    out.push({
      iso,
      artist: join(list.map((r) => r.artist)),
      song: join(list.map((r) => r.song)),
      running_order: null,
      place: null,
      points: null,
      gold: false,
      disqualified: false,
    });
  }
  return out;
}
