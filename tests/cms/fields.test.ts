// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  text, multiline, list, group, richText, tuple, choice, flag, optional, fieldMeta, fieldPaths, fieldAt,
} from '../../supabase/functions/_shared/cms/fields';
import { interpolate, placeholdersIn } from '../../supabase/functions/_shared/cms/placeholders';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';

describe('field metadata', () => {
  it('round-trips text metadata, defaulting required to true', () => {
    const f = text({ label: 'Title', help: 'Shown in the tab', maxLength: 60, placeholders: ['year'] });
    expect(fieldMeta(f)).toEqual({
      kind: 'text', label: 'Title', help: 'Shown in the tab', maxLength: 60, placeholders: ['year'], required: true,
      placeholderHelp: { year: expect.any(String) },
    });
  });

  it('round-trips each kind', () => {
    expect(fieldMeta(multiline({ label: 'Body', required: false }))).toMatchObject({ kind: 'multiline', label: 'Body', required: false });
    expect(fieldMeta(richText({ help: 'Markdown' }))).toMatchObject({ kind: 'richText', help: 'Markdown', required: true });
    expect(fieldMeta(list(text(), { label: 'Items' }))).toMatchObject({ kind: 'list', label: 'Items' });
    expect(fieldMeta(group({ a: text() }, { label: 'Hero' }))).toMatchObject({ kind: 'group', label: 'Hero' });
  });

  it('round-trips tuple, choice and flag', () => {
    expect(fieldMeta(tuple([text(), text()], { label: 'Headers' }))).toEqual({ kind: 'tuple', label: 'Headers' });
    expect(fieldMeta(choice(['muted', 'pink'], { label: 'Tone' }))).toEqual({ kind: 'choice', label: 'Tone', options: ['muted', 'pink'], shared: true });
    expect(fieldMeta(flag({ help: 'Open cap' }))).toEqual({ kind: 'flag', help: 'Open cap', shared: true });
  });

  it('tuple fixes the length; choice and flag accept only their values', () => {
    const t = tuple([text(), text()]);
    expect(t.safeParse(['a', 'b']).success).toBe(true);
    expect(t.safeParse(['a']).success).toBe(false);
    expect(t.safeParse(['a', 'b', 'c']).success).toBe(false);
    const c = choice(['muted', 'pink']);
    expect(c.safeParse('pink').success).toBe(true);
    expect(c.safeParse('blue').success).toBe(false);
    expect(flag().safeParse(true).success).toBe(true);
    expect(flag().safeParse('true').success).toBe(false);
  });

  it('choice and flag are locale-shared by default; other kinds opt in', () => {
    expect(fieldMeta(choice(['a'])).shared).toBe(true);
    expect(fieldMeta(flag()).shared).toBe(true);
    expect(fieldMeta(choice(['a'], { shared: false })).shared).toBe(false);
    expect(fieldMeta(flag({ shared: false })).shared).toBe(false);
    expect(fieldMeta(text()).shared).toBeUndefined();
    expect(fieldMeta(text({ shared: true })).shared).toBe(true);
    expect(fieldMeta(group({ a: text() }, { shared: true })).shared).toBe(true);
    expect(fieldMeta(list(text())).shared).toBeUndefined();
  });

  it('records rawHtml on string fields', () => {
    expect(fieldMeta(text({ rawHtml: true })).rawHtml).toBe(true);
    expect(fieldMeta(multiline({ rawHtml: true })).rawHtml).toBe(true);
    expect(fieldMeta(text()).rawHtml).toBeUndefined();
  });

  it('optional() keeps the inner metadata, adds optional: true and accepts an absent key', () => {
    const inner = text({ label: 'Link', shared: true });
    const o = optional(inner);
    expect(fieldMeta(o)).toEqual({ ...fieldMeta(inner), optional: true });
    expect(fieldMeta(inner).optional).toBeUndefined();
    expect(fieldMeta(optional(choice(['a', 'b'])))).toEqual({ kind: 'choice', options: ['a', 'b'], shared: true, optional: true });
    const g = group({ x: o });
    expect(g.safeParse({}).success).toBe(true);
    expect(g.safeParse({ x: 'a' }).success).toBe(true);
    expect(g.safeParse({ x: 1 }).success).toBe(false);
  });

  it('fieldPaths and fieldAt walk the whole tree, optional wrappers included', () => {
    const s = group({
      a: text({ rawHtml: true }),
      b: list(group({ c: text({ rawHtml: true }), d: text() })),
      e: optional(text({ rawHtml: true })),
      f: tuple([text(), text({ rawHtml: true })]),
      g: optional(group({ h: text({ rawHtml: true }) })),
    });
    expect(fieldPaths(s, (m) => !!m.rawHtml)).toEqual(['a', 'b.*.c', 'e', 'f.1', 'g.h']);
    for (const p of ['a', 'b.*.c', 'b.0.c', 'e', 'f.1', 'g.h']) expect(fieldMeta(fieldAt(s, p)!).rawHtml).toBe(true);
    expect(fieldMeta(fieldAt(s, 'g')!)).toMatchObject({ kind: 'group', optional: true });
    expect(fieldAt(s, 'nope')).toBeUndefined();
    expect(fieldAt(s, 'a.b')).toBeUndefined();
  });

  it('defaults placeholders to none', () => {
    expect(fieldMeta(text()).placeholders).toEqual([]);
  });

  it('throws for a schema that is not a CMS field', async () => {
    const { z } = await import('zod');
    expect(() => fieldMeta(z.string())).toThrow(/not a CMS field/);
  });

  it('list and group expose their children', () => {
    const item = text({ label: 'Q' });
    const l = list(item);
    expect(fieldMeta(l.element)).toMatchObject({ label: 'Q' });
    const g = group({ title: text({ label: 'T' }) });
    expect(fieldMeta(g.shape.title)).toMatchObject({ label: 'T' });
  });
});

describe('placeholders', () => {
  it('replaces placeholders, numbers included', () => {
    expect(interpolate('Eurovision {year} in {city}', { year: 2026, city: 'Vienna' })).toBe('Eurovision 2026 in Vienna');
    expect(interpolate('{count}{count}', { count: 3 })).toBe('33');
  });

  it('throws on a missing var', () => {
    expect(() => interpolate('Hi {city}', {})).toThrow(/city/);
  });

  it('{{ and }} render literal braces and never start a placeholder', () => {
    expect(interpolate('{{year}}', { year: 2026 })).toBe('{year}');
    expect(interpolate('a {{ b }} c', {})).toBe('a { b } c');
    expect(interpolate('{{{year}}}', { year: 2026 })).toBe('{2026}');
  });

  it('leaves a lone brace that is not a placeholder alone', () => {
    expect(interpolate('a { b', {})).toBe('a { b');
    expect(interpolate('x } y', {})).toBe('x } y');
    expect(interpolate('{not valid}', {})).toBe('{not valid}');
    expect(interpolate('{1abc}', {})).toBe('{1abc}');
  });

  it('placeholdersIn lists names in order, deduplicated, skipping escapes', () => {
    expect(placeholdersIn('{year} {city} {year} {{count}} {cityIn}')).toEqual(['year', 'city', 'cityIn']);
    expect(placeholdersIn('no placeholders')).toEqual([]);
  });
});

describe('href field kind', () => {
  it('is its own kind, locale-shared by default', async () => {
    const { href } = await import('../../supabase/functions/_shared/cms/fields');
    expect(fieldMeta(href())).toMatchObject({ kind: 'href', shared: true, required: true });
    expect(fieldMeta(href({ shared: false })).shared).toBe(false);
  });

  it('must start with / or https:// (not //)', async () => {
    const { href } = await import('../../supabase/functions/_shared/cms/fields');
    const h = href();
    for (const ok of ['/faq', '/en/eurovision-night', 'https://eurovision.games/x']) expect(h.safeParse(ok).success, ok).toBe(true);
    for (const bad of ['faq', 'http://x.com', 'javascript:alert(1)', '//evil.example', '']) {
      const r = h.safeParse(bad);
      expect(r.success, bad).toBe(false);
    }
    expect(h.safeParse('faq').error!.issues[0].message).toBe('Must start with / (a page on this site) or https://');
  });

  it('every href-like field of every doc type is an href kind', () => {
    const notHref: string[] = [];
    for (const [docId, def] of Object.entries(CMS_DOC_TYPES)) {
      if (docId.startsWith('__')) continue;
      for (const p of fieldPaths(def.schema, (m) => m.kind !== 'group' && m.kind !== 'list' && m.kind !== 'tuple')) {
        const meta = fieldMeta(fieldAt(def.schema, p)!);
        if (/(^|\.)(href|linkHref)$/i.test(p) && meta.kind !== 'href') notHref.push(`${docId}.${p}`);
      }
    }
    expect(notHref).toEqual([]);
    expect(fieldMeta(fieldAt(CMS_DOC_TYPES.about.schema, 'whatsIn.items.*.linkHref')!)).toMatchObject({ kind: 'href', optional: true });
  });
});

describe('linked pairs', () => {
  const g = group(
    { label: optional(text()), link: optional(text()), tail: text({ required: false }) },
    { pairs: [['label', 'link']] },
  );

  it('records the pairs in the metadata', () => {
    expect(fieldMeta(g).pairs).toEqual([['label', 'link']]);
  });

  it('accepts both or neither', () => {
    expect(g.safeParse({ tail: '' }).success).toBe(true);
    expect(g.safeParse({ label: 'L', link: '/x', tail: '' }).success).toBe(true);
    expect(g.safeParse({ label: '', link: '', tail: '' }).success).toBe(false); // empty strings fail required, not the pair
  });

  it('rejects one without the other, at the missing key', () => {
    const r = g.safeParse({ label: 'L', tail: '' });
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([['link', 'Set both label and link, or neither']]);
    const r2 = g.safeParse({ link: '/x', tail: '' });
    expect(r2.error!.issues.map((i) => i.path.join('.'))).toEqual(['label']);
  });

  it('throws when a pair names a key the group does not have', () => {
    expect(() => group({ a: text() }, { pairs: [['a', 'b']] })).toThrow(/b/);
  });

  it('applies to the about and eurovision-night link pairs', () => {
    expect(fieldMeta(fieldAt(CMS_DOC_TYPES.about.schema, 'whatsIn.items.*')!).pairs).toEqual([['linkLabel', 'linkHref']]);
    expect(fieldMeta(fieldAt(CMS_DOC_TYPES['eurovision-night'].schema, 'sections.playbook.steps.*')!).pairs).toEqual([['href', 'linkLabel']]);
  });
});

describe('placeholder help', () => {
  it('fills a default help line for a known placeholder and takes overrides', () => {
    expect(fieldMeta(text({ placeholders: ['year'] })).placeholderHelp).toEqual({ year: expect.stringMatching(/year/i) });
    expect(fieldMeta(text({ placeholders: ['year'], placeholderHelp: { year: 'Custom' } })).placeholderHelp).toEqual({ year: 'Custom' });
    expect(fieldMeta(text()).placeholderHelp).toBeUndefined();
  });

  it('throws for a placeholder without help, or help for an undeclared placeholder', () => {
    expect(() => text({ placeholders: ['zzzUnknown'] })).toThrow(/zzzUnknown/);
    expect(() => text({ placeholders: ['year'], placeholderHelp: { city: 'x' } })).toThrow(/city/);
  });

  it('every templated field of every doc type documents each of its placeholders', () => {
    for (const [docId, def] of Object.entries(CMS_DOC_TYPES)) {
      for (const p of fieldPaths(def.schema, (m) => (m.placeholders ?? []).length > 0)) {
        const meta = fieldMeta(fieldAt(def.schema, p)!);
        expect(Object.keys(meta.placeholderHelp ?? {}).sort(), `${docId}.${p}`).toEqual([...meta.placeholders!].sort());
        for (const h of Object.values(meta.placeholderHelp!)) expect(h.trim().length, `${docId}.${p}`).toBeGreaterThan(5);
      }
    }
  });
});

describe('labels and length presets', () => {
  it('seoTitle and metaDescription are text with a soft max of 60 / 160', async () => {
    const { seoTitle, metaDescription } = await import('../../supabase/functions/_shared/cms/schemas/common');
    expect(fieldMeta(seoTitle())).toMatchObject({ kind: 'text', softMaxLength: 60, required: true });
    expect(fieldMeta(metaDescription())).toMatchObject({ kind: 'text', softMaxLength: 160 });
    expect(fieldMeta(seoTitle({ placeholders: ['year'] })).placeholders).toEqual(['year']);
    // Soft: a long value still parses.
    expect(seoTitle().safeParse('x'.repeat(200)).success).toBe(true);
  });

  it('every meta title/description and schemaTitle/schemaDescription uses the presets', () => {
    for (const [docId, def] of Object.entries(CMS_DOC_TYPES)) {
      if (docId.startsWith('__') || def.group !== 'site') continue; // editorial: metaDescription, checked in editorial.test
      const soft = (p: string) => fieldMeta(fieldAt(def.schema, p)!).softMaxLength;
      expect(soft('meta.title'), `${docId} meta.title`).toBe(60);
      expect(soft('meta.description'), `${docId} meta.description`).toBe(160);
      for (const [key, max] of [['schemaTitle', 60], ['schemaDescription', 160]] as const) {
        if (fieldAt(def.schema, `meta.${key}`)) expect(soft(`meta.${key}`), `${docId} meta.${key}`).toBe(max);
      }
    }
  });

  it('meta, hero and cta groups carry a label', () => {
    for (const [docId, def] of Object.entries(CMS_DOC_TYPES)) {
      if (docId.startsWith('__')) continue;
      for (const key of ['meta', 'hero', 'cta']) {
        const node = fieldAt(def.schema, key);
        if (node) expect(fieldMeta(node).label, `${docId}.${key}`).toBeTruthy();
      }
    }
  });
});
