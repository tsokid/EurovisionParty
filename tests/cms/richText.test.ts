// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseRichText, richTextErrors } from '../../supabase/functions/_shared/cms/richText';

const t = (value: string) => ({ type: 'text', value });

describe('parseRichText', () => {
  it('parses paragraphs split on blank lines, joining wrapped lines with a space', () => {
    expect(parseRichText('one\ntwo\n\nthree')).toEqual([
      { type: 'paragraph', children: [t('one two')] },
      { type: 'paragraph', children: [t('three')] },
    ]);
  });

  it('parses strong, em, nesting and links', () => {
    expect(parseRichText('a **b *c*** [d](/faq) *e*')).toEqual([
      {
        type: 'paragraph',
        children: [
          t('a '),
          { type: 'strong', children: [t('b '), { type: 'em', children: [t('c')] }] },
          t(' '),
          { type: 'link', href: '/faq', children: [t('d')] },
          t(' '),
          { type: 'em', children: [t('e')] },
        ],
      },
    ]);
  });

  it('parses ### headings, bullet and numbered lists', () => {
    expect(parseRichText('### Title\n- a\n- **b**\n\n1. x\n2. y')).toEqual([
      { type: 'heading', level: 3, children: [t('Title')] },
      { type: 'list', ordered: false, items: [[t('a')], [{ type: 'strong', children: [t('b')] }]] },
      { type: 'list', ordered: true, items: [[t('x')], [t('y')]] },
    ]);
  });

  it('treats a backslash escape as a literal', () => {
    expect(parseRichText('2 \\* 3 \\< 4')).toEqual([{ type: 'paragraph', children: [t('2 * 3 < 4')] }]);
    expect(parseRichText('\\- not a list')).toEqual([{ type: 'paragraph', children: [t('- not a list')] }]);
  });

  it('keeps https links and renders an unsafe link as its label only', () => {
    expect(parseRichText('[a](https://x.org)')).toEqual([
      { type: 'paragraph', children: [{ type: 'link', href: 'https://x.org', children: [t('a')] }] },
    ]);
    expect(parseRichText('[a](javascript:alert)')).toEqual([{ type: 'paragraph', children: [t('a')] }]);
  });

  it('never emits raw tags as anything but text', () => {
    expect(parseRichText('<b>x</b>')).toEqual([{ type: 'paragraph', children: [t('<b>x</b>')] }]);
  });

  it('returns nothing for an empty string and normalises CRLF', () => {
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText('a\r\n\r\nb')).toHaveLength(2);
  });
});

describe('richTextErrors', () => {
  it('is empty for valid input', () => {
    expect(richTextErrors('### H\n\nHello **x** and [y](/z).\n\n- a\n1. b')).toEqual([]);
  });

  it.each([
    ['raw tag', 'ok\n\n<script>x</script>', 3, /Raw HTML/],
    ['unsafe href', 'a\n[x](javascript:alert)', 2, /Unsafe link/],
    ['protocol-relative href', '[x](//evil.com)', 1, /Unsafe link/],
    ['http href', '[x](http://x.org)', 1, /Unsafe link/],
    ['unclosed bold', 'a\nb **c', 2, /Unclosed \*\*/],
    ['unclosed italic', '*c', 1, /Unclosed \*/],
    ['unclosed link', '[c', 1, /Unclosed \[/],
    ['link without address', 'x [c] y', 1, /needs an address/],
    ['image', '![a](/x.png)', 1, /Images/],
    ['code', 'a `b`', 1, /Code/],
    ['quote', '\n> q', 2, /Quotes/],
    ['h2', '## H', 1, /### headings/],
    ['h1', '# H', 1, /### headings/],
    ['nested link', '[a [b](/x)](/y)', 1, /nested/],
    ['empty heading', '### ', 1, /Empty heading/],
  ])('rejects %s with its line number', (_n, src, line, msg) => {
    const errs = richTextErrors(src);
    expect(errs.some((e) => e.line === line && msg.test(e.message))).toBe(true);
  });

  it('reports every offending line', () => {
    expect(richTextErrors('<a>\nfine\n<b>').map((e) => e.line)).toEqual([1, 3]);
  });
});
