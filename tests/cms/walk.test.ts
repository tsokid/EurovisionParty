// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { choice, group, list, optional, text, tuple } from '../../supabase/functions/_shared/cms/fields';
import { mapStrings, walkSchema, type WalkNode } from '../../supabase/functions/_shared/cms/walk';
import { interpolateDocument } from '../../supabase/functions/_shared/cms/interpolateDocument';
import * as extractCopy from '../../scripts/cms/extract-copy';

const s = group({
  a: text({ placeholders: ['year'] }),
  b: list(group({ c: text(), d: choice(['x', 'y']) })),
  e: optional(text()),
  f: tuple([text(), text()]),
  g: optional(group({ h: text() })),
});

describe('walkSchema', () => {
  it('visits every node of the schema in order, lists as *, optional wrapper then inner at the same path', () => {
    const seen: string[] = [];
    walkSchema(s, (n) => { seen.push(`${n.path || '(root)'}:${n.type}`); });
    expect(seen).toEqual([
      '(root):object', 'a:string', 'b:array', 'b.*:object', 'b.*.c:string', 'b.*.d:enum',
      'e:optional', 'e:string', 'f:tuple', 'f.0:string', 'f.1:string', 'g:optional', 'g:object', 'g.h:string',
    ]);
  });

  it('does not descend below a node whose visit returns false', () => {
    const seen: string[] = [];
    walkSchema(s, (n) => { seen.push(n.path); return n.path !== 'b' && n.path !== 'g'; });
    expect(seen).toEqual(['', 'a', 'b', 'e', 'e', 'f', 'f.0', 'f.1', 'g']);
  });

  it('walks values alongside: indices as numbers, only as deep as every value goes', () => {
    const en = { a: 'A', b: [{ c: 'c0', d: 'x' }, { c: 'c1', d: 'y' }], f: ['f0', 'f1'], g: { h: 'H' } };
    const el = { a: 'Α', b: [{ c: 'γ0', d: 'x' }], e: 'E', f: ['φ0', 'φ1'] };
    const nodes: WalkNode[] = [];
    walkSchema(s, (n) => { nodes.push(n); }, [en, el]);
    const at = (p: string) => nodes.filter((n) => n.path === p).map((n) => n.values);
    expect(at('b.0.c')).toEqual([['c0', 'γ0']]);
    expect(at('b.1.c')).toEqual([]); // el has one item
    expect(at('b')).toEqual([[en.b, el.b]]);
    // e is absent in en: the wrapper is visited, its inner is not.
    expect(at('e')).toEqual([[undefined, 'E']]);
    expect(at('g.h')).toEqual([]);
    expect(nodes.find((n) => n.path === 'b.0.c')!.segments).toEqual(['b', 0, 'c']);
  });

  it('gives each node its metadata', () => {
    const metas: Record<string, string> = {};
    walkSchema(s, (n) => { metas[n.path] = n.meta.kind; });
    expect(metas).toMatchObject({ '': 'group', a: 'text', b: 'list', 'b.*.d': 'choice', f: 'tuple' });
  });
});

describe('mapStrings', () => {
  it('maps every string leaf, keeps everything else, never mutates the input', () => {
    const v = { a: 'a', b: [{ c: 'c', d: 'x' }], f: ['1', '2'], extra: 'kept' };
    const out = mapStrings(s, v, (str, meta, path) => `${str}|${path}|${meta.placeholders!.length}`);
    expect(out).toEqual({ a: 'a|a|1', b: [{ c: 'c|b.0.c|0', d: 'x' }], f: ['1|f.0|0', '2|f.1|0'], extra: 'kept' });
    expect(v.a).toBe('a');
  });
});

describe('interpolateDocument (shared)', () => {
  it('renders templated fields only, in both locales', () => {
    const doc = { en: { a: '{{{year}}}', b: [], f: ['{x}', 'y'] }, el: { a: 'Το {year}', b: [], f: ['a', 'b'] } };
    expect(interpolateDocument(s, doc, { year: 7 })).toEqual({
      en: { a: '{7}', b: [], f: ['{x}', 'y'] },
      el: { a: 'Το 7', b: [], f: ['a', 'b'] },
    });
  });

  it('is the one extract-copy uses (no second copy of the walker)', () => {
    expect(extractCopy.interpolateDocument).toBe(interpolateDocument);
  });
});

describe('one schema walker', () => {
  it('no CMS module other than walk.ts switches on a zod def type', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const root = resolve(__dirname, '../..');
    const files = [
      ...readdirSync(resolve(root, 'supabase/functions/_shared/cms')).filter((f) => f.endsWith('.ts')).map((f) => `supabase/functions/_shared/cms/${f}`),
      ...readdirSync(resolve(root, 'scripts/cms')).filter((f) => f.endsWith('.ts')).map((f) => `scripts/cms/${f}`),
    ];
    const walkers = files.filter((f) => /\bdef\.type\b|\.innerType\b|\bdef\.shape\b/.test(readFileSync(resolve(root, f), 'utf8')));
    expect(walkers).toEqual(['supabase/functions/_shared/cms/walk.ts']);
  });
});
