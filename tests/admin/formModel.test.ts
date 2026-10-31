// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { blocks, fieldMeta, optional, text } from '../../supabase/functions/_shared/cms/fields';
import { schemaInfo } from '../../src/admin/modules/pages/form/formModel';

describe('schemaInfo: blocks and their union', () => {
  const zone = blocks({ label: 'Zone' });
  const NAMES = ['text', 'image', 'video', 'callout', 'faq', 'cta'];

  it('a blocks() list exposes its union element and every variant keyed by type', () => {
    const info = schemaInfo(zone);
    expect(info.meta.kind).toBe('blocks');
    expect(info.discriminator).toBe('type');
    expect(Object.keys(info.variants!)).toEqual(NAMES);
    expect(info.element && schemaInfo(info.element).meta.kind).toBe('union');
    expect(info.holdsShared).toBe(true);
  });

  it('a union keeps all its variants (not the last one as an optional inner)', () => {
    const union = schemaInfo(zone).element!;
    const info = schemaInfo(union);
    expect(info.inner).toBeUndefined();
    expect(Object.keys(info.variants!)).toEqual(NAMES);
    expect(info.children).toEqual([]);
  });

  it('the same key means different fields in different variants: keyed by type, never by path', () => {
    const { variants } = schemaInfo(zone);
    const body = (type: string) => schemaInfo(variants![type]).children.find((c) => c.key === 'body')!.schema;
    expect(fieldMeta(body('text')).kind).toBe('richText');
    expect(fieldMeta(body('callout')).kind).toBe('richText');
    expect(fieldMeta(body('cta')).kind).toBe('multiline');
  });

  it('optional() still exposes its inner field', () => {
    const inner = text({ label: 'X' });
    expect(schemaInfo(optional(inner)).inner).toBe(inner);
  });
});
