// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  text, multiline, list, group, richText, tuple, choice, flag, fieldMeta,
} from '../../supabase/functions/_shared/cms/fields';
import { interpolate, placeholdersIn } from '../../supabase/functions/_shared/cms/placeholders';

describe('field metadata', () => {
  it('round-trips text metadata, defaulting required to true', () => {
    const f = text({ label: 'Title', help: 'Shown in the tab', maxLength: 60, placeholders: ['year'] });
    expect(fieldMeta(f)).toEqual({
      kind: 'text', label: 'Title', help: 'Shown in the tab', maxLength: 60, placeholders: ['year'], required: true,
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
    expect(fieldMeta(choice(['muted', 'pink'], { label: 'Tone' }))).toEqual({ kind: 'choice', label: 'Tone', options: ['muted', 'pink'] });
    expect(fieldMeta(flag({ help: 'Open cap' }))).toEqual({ kind: 'flag', help: 'Open cap' });
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
