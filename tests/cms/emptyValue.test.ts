// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { choice, flag, group, href, list, multiline, optional, richText, text, tuple } from '../../supabase/functions/_shared/cms/fields';
import { emptyValue } from '../../supabase/functions/_shared/cms/emptyValue';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';

describe('emptyValue', () => {
  it('is an empty string for every string kind', () => {
    for (const f of [text(), multiline(), richText(), href(), text({ rawHtml: true })]) expect(emptyValue(f)).toBe('');
  });

  it('is false for a flag and the first option for a choice', () => {
    expect(emptyValue(flag())).toBe(false);
    expect(emptyValue(choice(['muted', 'pink']))).toBe('muted');
  });

  it('is an empty list for a list, whatever its item', () => {
    expect(emptyValue(list(group({ q: text(), a: text() })))).toEqual([]);
  });

  it('is absent for an optional field (the key is left out of its group)', () => {
    expect(emptyValue(optional(text()))).toBeUndefined();
    const g = emptyValue(group({ a: text(), b: optional(group({ c: text() })) }));
    expect(g).toEqual({ a: '' });
    expect(Object.prototype.hasOwnProperty.call(g, 'b')).toBe(false);
  });

  it('builds groups and tuples of empties, at any depth', () => {
    const s = group({
      title: text(),
      cells: tuple([text(), choice(['a', 'b']), flag()]),
      inner: group({ items: list(text()), on: flag(), tone: optional(choice(['x'])) }),
    });
    expect(emptyValue(s)).toEqual({ title: '', cells: ['', 'a', false], inner: { items: [], on: false } });
  });

  it('returns a fresh value on every call (safe to insert into two locales)', () => {
    const s = group({ a: tuple([text()]) });
    const one = emptyValue(s) as { a: string[] };
    const two = emptyValue(s) as { a: string[] };
    expect(one).not.toBe(two);
    expect(one.a).not.toBe(two.a);
  });

  it('builds a value of the right shape for every registered doc type', () => {
    for (const [docType, def] of Object.entries(CMS_DOC_TYPES)) {
      const v = emptyValue(def.schema);
      expect(v, docType).toBeTypeOf('object');
      // Structurally valid: only emptiness (required strings) may fail.
      const r = def.schema.safeParse(v);
      const nonEmptiness = r.success ? [] : r.error.issues.filter((i) => !/Required|Anchored ids/.test(i.message));
      expect(nonEmptiness, docType).toEqual([]);
    }
  });
});
