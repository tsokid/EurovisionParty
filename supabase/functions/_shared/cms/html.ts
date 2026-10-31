// rawHtml allowlist (CMS 3b ruling I4 option b).
//
// A field marked `rawHtml` is rendered with dangerouslySetInnerHTML, so its
// value must stay inside this allowlist. Everything else is an error:
//
//   tags        strong, em, b, i, br (void), a
//   on <a>      href (required; starts with "/" or "https://", never "//"),
//               target="_blank", rel
//   text        anything but a stray "<"; entities (&amp; &#39; ...) are fine
//
// Tags must nest and close properly (<a> never inside <a>). A pure tokenizer
// and checker: no DOM, no dependencies, runs in Node, Deno and the browser.

const CONTAINER_TAGS = new Set(['strong', 'em', 'b', 'i', 'a']);
const VOID_TAGS = new Set(['br']);
const A_ATTRS = new Set(['href', 'target', 'rel']);

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the entities a browser would decode in an attribute value. */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body.toLowerCase()) ? NAMED_ENTITIES[body.toLowerCase()] : whole;
  });
}

/**
 * A site path that already starts with a locale (/en, /el, /en/…, /el?…):
 * links rendered through LocaleLink get the active locale added, so such a
 * path would be prefixed twice. isSafeHref allows it (raw <a> needs it).
 */
export const isLocalePrefixedPath = (href: string): boolean => /^\/(?:en|el)(?:[/?#]|$)/.test(href);

export const LOCALE_PREFIX_MESSAGE = 'Write the path without /en or /el — the language is added automatically';

/**
 * A link target the CMS allows: a path on this site ("/faq", not the
 * protocol-relative "//host") or an https:// URL, with no whitespace or
 * control characters.
 */
export function isSafeHref(href: string): boolean {
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f\\]/.test(href)) return false;
  if (href.startsWith('https://')) return href.length > 'https://'.length;
  return href.startsWith('/') && !href.startsWith('//');
}

/** Named entities in `s` (with or without ";") that decodeEntities does not know. */
function unknownEntities(s: string): string[] {
  return [...s.matchAll(/&([a-z][a-z0-9]*);?/gi)].map((m) => m[1]).filter((name) => !Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase()));
}

type Attr = { name: string; value: string; raw: string };

/** Parses `name="v" name='v' name=v name` up to the end of `src`; null on a malformed attribute list. */
function parseAttrs(src: string): Attr[] | null {
  const attrs: Attr[] = [];
  const re = /\s*([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) return null;
    const raw = m[2] ?? m[3] ?? m[4] ?? '';
    attrs.push({ name: m[1].toLowerCase(), value: decodeEntities(raw), raw });
    i = re.lastIndex;
  }
  return attrs;
}

/** Every allowlist violation in `html`, in document order (empty: allowed). */
export function htmlErrors(html: string): string[] {
  const errors: string[] = [];
  const open: string[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    const next = html[lt + 1] ?? '';
    if (next === '!' || next === '?') {
      errors.push(`disallowed markup "${html.slice(lt, lt + 4)}"`);
      const gt = html.indexOf('>', lt);
      i = gt === -1 ? html.length : gt + 1;
      continue;
    }
    if (!/[a-zA-Z/]/.test(next)) {
      errors.push('stray "<" (write &lt;)');
      i = lt + 1;
      continue;
    }
    // A tag ends at the first ">" outside a quoted attribute value.
    let end = -1;
    let quote = '';
    for (let j = lt + 1; j < html.length; j++) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') {
        end = j;
        break;
      }
    }
    if (end === -1) {
      errors.push(`unterminated tag "${html.slice(lt, lt + 20)}"`);
      break;
    }
    const raw = html.slice(lt + 1, end);
    i = end + 1;

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim().toLowerCase();
      if (!CONTAINER_TAGS.has(name) && !VOID_TAGS.has(name)) {
        errors.push(`disallowed tag </${name}>`);
      } else if (!open.length || VOID_TAGS.has(name)) {
        errors.push(`unexpected </${name}>`);
      } else if (open[open.length - 1] !== name) {
        errors.push(`mismatched </${name}> (expected </${open[open.length - 1]}>)`);
        const at = open.lastIndexOf(name);
        if (at !== -1) open.length = at;
      } else {
        open.pop();
      }
      continue;
    }

    const nameMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(raw)!;
    const name = nameMatch[0].toLowerCase();
    let rest = raw.slice(nameMatch[0].length);
    if (rest.endsWith('/')) rest = rest.slice(0, -1);
    if (!CONTAINER_TAGS.has(name) && !VOID_TAGS.has(name)) {
      errors.push(`disallowed tag <${name}>`);
      continue;
    }
    if (rest !== '' && !/^\s/.test(rest)) {
      errors.push(`malformed tag <${name}>`);
      continue;
    }
    const attrs = parseAttrs(rest);
    if (!attrs) {
      errors.push(`malformed attributes on <${name}>`);
      continue;
    }
    const seen = new Set<string>();
    for (const { name: attr, value, raw } of attrs) {
      if (seen.has(attr)) {
        errors.push(`duplicate attribute ${attr} on <${name}>`);
        continue;
      }
      seen.add(attr);
      if (name !== 'a' || !A_ATTRS.has(attr)) {
        errors.push(`disallowed attribute ${attr} on <${name}>`);
      } else if (attr === 'href' && unknownEntities(raw).length) {
        // A browser decodes entities we do not (&sol; is "/"): never guess, reject.
        for (const e of unknownEntities(raw)) errors.push(`unknown entity &${e}; in href`);
      } else if (attr === 'href' && !isSafeHref(value)) {
        errors.push(`disallowed href "${value}" (must start with / or https://)`);
      } else if (attr === 'target' && value !== '_blank') {
        errors.push(`disallowed target "${value}" (only _blank)`);
      }
    }
    if (name === 'a' && !seen.has('href')) errors.push('<a> needs an href');
    if (VOID_TAGS.has(name)) continue;
    if (name === 'a' && open.includes('a')) errors.push('nested <a>');
    open.push(name);
  }
  for (const name of open.reverse()) errors.push(`unclosed <${name}>`);
  return errors;
}
