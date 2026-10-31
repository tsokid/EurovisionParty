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

describe('hardening', () => {
  const timed = (fn: () => void) => {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
  };

  it.each([
    ['[', '['.repeat(50_000)],
    ['*[', '*['.repeat(25_000)],
    ['[a', '[a'.repeat(25_000)],
    ['* ** ', '* ** '.repeat(10_000)],
    ['**', '**'.repeat(25_000)],
    ['](', '[](' .repeat(15_000)],
  ])('does not throw or crawl on 50k of %s, and reports an error', (_n, src) => {
    let errors: unknown[] = [];
    const ms = timed(() => {
      parseRichText(src);
      errors = richTextErrors(src);
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
  });

  it('an unclosed link label holding ~1M chars of children does not overflow the stack (no spread push)', () => {
    const src = '[' + '*a*'.repeat(300_000);
    expect(() => parseRichText(src)).not.toThrow();
    const errors = richTextErrors(src);
    expect(errors.some((e) => /Unclosed \[/.test(e.message))).toBe(true);
    const p = parseRichText(src)[0] as { children: Array<{ type: string }> };
    expect(p.children).toHaveLength(300_000);
    expect(p.children.every((c) => c.type === 'em')).toBe(true);
  });

  it('treats a [ inside a link label as literal text, with a nested-link error', () => {
    expect(richTextErrors('[a [b](/x)](/y)').some((e) => /nested/.test(e.message))).toBe(true);
  });

  it('caps nesting at 8 levels: deeper markers are literal and an error', () => {
    const ok = `${'*'.repeat(1)}a${'*'.repeat(1)}`;
    expect(richTextErrors(ok)).toEqual([]);
    const deep = '**a *b '.repeat(5);
    expect(richTextErrors(deep).some((e) => /deeply nested/.test(e.message))).toBe(true);
  });

  it('rejects a locale-prefixed site path (LocaleLink adds the locale) and renders its label as text', () => {
    const msg = 'Write the path without /en or /el — the language is added automatically';
    for (const href of ['/en/faq', '/el/faq', '/en', '/el', '/el#x']) {
      expect(richTextErrors(`[x](${href})`).map((e) => e.message), href).toEqual([msg]);
      expect(parseRichText(`[x](${href})`), href).toEqual([{ type: 'paragraph', children: [{ type: 'text', value: 'x' }] }]);
    }
    for (const href of ['/faq', '/english', '/elsewhere', 'https://eurovision.games/en/faq']) {
      expect(richTextErrors(`[x](${href})`), href).toEqual([]);
    }
  });

  it('rejects an address with ( in it', () => {
    expect(richTextErrors('[x](/a(b))').some((e) => /cannot contain \(/.test(e.message))).toBe(true);
  });

  it.each(['****', '[](/a)', '**', '*'])('rejects empty bold/italic/link in %s', (src) => {
    expect(richTextErrors(src).length).toBeGreaterThan(0);
  });

  it('parses 20k lines of one paragraph quickly', () => {
    const src = Array.from({ length: 20_000 }, (_, i) => `line ${i} **b**`).join('\n');
    const ms = timed(() => parseRichText(src));
    expect(ms).toBeLessThan(2000);
  });

  it('keeps 2026\\. as a paragraph, and flags ###x', () => {
    expect(parseRichText('2026\\. was fun')).toEqual([{ type: 'paragraph', children: [{ type: 'text', value: '2026. was fun' }] }]);
    const e = richTextErrors('###x');
    expect(e[0].message).toMatch(/### text/);
    expect(e[0].line).toBe(1);
  });
});
