// Placeholder templates for CMS copy (spec §3 "Templates").
//
// Syntax:
//   {name}  a placeholder; name matches [a-zA-Z][a-zA-Z0-9]*
//   {{      a literal "{"
//   }}      a literal "}"
// Any other brace (a lone "{" or "}", or "{" not followed by name + "}") is
// left as written. Deno-free and dependency-free.

type Token = { kind: 'text'; value: string } | { kind: 'var'; name: string };

const NAME = /^[a-zA-Z][a-zA-Z0-9]*/;

function tokenize(template: string): Token[] {
  const out: Token[] = [];
  let buf = '';
  let i = 0;
  while (i < template.length) {
    const c = template[i];
    const next = template[i + 1];
    if ((c === '{' && next === '{') || (c === '}' && next === '}')) {
      buf += c;
      i += 2;
      continue;
    }
    if (c === '{') {
      const m = NAME.exec(template.slice(i + 1));
      if (m && template[i + 1 + m[0].length] === '}') {
        if (buf) out.push({ kind: 'text', value: buf });
        buf = '';
        out.push({ kind: 'var', name: m[0] });
        i += m[0].length + 2;
        continue;
      }
    }
    buf += c;
    i += 1;
  }
  if (buf) out.push({ kind: 'text', value: buf });
  return out;
}

/** Placeholder names used in `template`, in first-use order, without duplicates. */
export function placeholdersIn(template: string): string[] {
  const names = tokenize(template).flatMap((t) => (t.kind === 'var' ? [t.name] : []));
  return [...new Set(names)];
}

/** Renders `template`, throwing if a placeholder it uses has no value in `vars`. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return tokenize(template)
    .map((t) => {
      if (t.kind === 'text') return t.value;
      if (!Object.prototype.hasOwnProperty.call(vars, t.name)) {
        throw new Error(`interpolate: missing value for placeholder {${t.name}} in "${template}"`);
      }
      return String(vars[t.name]);
    })
    .join('');
}
