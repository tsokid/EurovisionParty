// @vitest-environment node
// rawHtml allowlist (3b ruling I4 option b): a rawHtml field is rendered with
// dangerouslySetInnerHTML, so its markup must stay inside a small allowlist.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { htmlErrors, isSafeHref } from '../../supabase/functions/_shared/cms/html';
import { fieldPaths, group, text } from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';
import { walkSchema } from '../../supabase/functions/_shared/cms/walk';

describe('htmlErrors (allowlist)', () => {
  it.each([
    'plain text',
    '',
    'a <strong>bold</strong> and <em>soft</em> word',
    '<b>b</b> <i>i</i> line<br>break<br/>again<br />end',
    '<strong><em>nested</em> fine</strong>',
    'Tom &amp; Jerry &lt;3 &#39;quoted&#39; &#x2014; &nbsp;',
    'a bare & ampersand and a > sign',
    'see <a href="/faq">the FAQ</a>',
    'see <a href="https://example.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">site</a>',
    "single quotes <a href='/rules'>rules</a>",
    '<STRONG>upper</STRONG> case tag names',
  ])('accepts %j', (html) => {
    expect(htmlErrors(html)).toEqual([]);
  });

  it.each([
    ['<script>alert(1)</script>', 'disallowed tag <script>'],
    ['<img src=x onerror="alert(1)">', 'disallowed tag <img>'],
    ['<em onclick="x()">hi</em>', 'disallowed attribute onclick on <em>'],
    ['<a href="/x" onclick="x()">hi</a>', 'disallowed attribute onclick on <a>'],
    ['<a href="javascript:alert(1)">x</a>', 'disallowed href "javascript:alert(1)" (must start with / or https://)'],
    ['<a href="data:text/html,hi">x</a>', 'disallowed href "data:text/html,hi" (must start with / or https://)'],
    ['<a href="http://example.com">x</a>', 'disallowed href "http://example.com" (must start with / or https://)'],
    ['<a href="//evil.example">x</a>', 'disallowed href "//evil.example" (must start with / or https://)'],
    ['<a href="&#106;avascript:x">x</a>', 'disallowed href "javascript:x" (must start with / or https://)'],
    ['<a href="/&sol;evil.com">x</a>', 'unknown entity &sol; in href'],
    ['<a href="/&Tab;/evil.com">x</a>', 'unknown entity &Tab; in href'],
    ['<a href="/&bsol;evil.com">x</a>', 'unknown entity &bsol; in href'],
    ['<a href="/&constructor;x">x</a>', 'unknown entity &constructor; in href'],
    ['<a>x</a>', '<a> needs an href'],
    ['<a href="/x" target="_self">x</a>', 'disallowed target "_self" (only _blank)'],
    ['<a href="/x" style="color:red">x</a>', 'disallowed attribute style on <a>'],
    ['<strong>never closed', 'unclosed <strong>'],
    ['<em>crossed <strong>tags</em></strong>', 'mismatched </em> (expected </strong>)'],
    ['stray </em> close', 'unexpected </em>'],
    ['<a href="/x"><a href="/y">x</a></a>', 'nested <a>'],
    ['<!-- comment -->', 'disallowed markup "<!--"'],
    ['a < b', 'stray "<" (write &lt;)'],
    ['<em', 'unterminated tag "<em"'],
    ['<a href="/x" href="/y">x</a>', 'duplicate attribute href on <a>'],
    ['<br>x</br>', 'unexpected </br>'],
    ['<em class="x">x</em>', 'disallowed attribute class on <em>'],
  ])('rejects %j', (html, message) => {
    expect(htmlErrors(html)).toContain(message);
  });

  it('isSafeHref allows site paths and https only', () => {
    expect(isSafeHref('/faq')).toBe(true);
    expect(isSafeHref('/')).toBe(true);
    expect(isSafeHref('https://eurovision.games/en')).toBe(true);
    for (const bad of ['', 'faq', '//x.com', '/\\x.com', 'http://x.com', 'javascript:x', 'data:x', 'HTTPS://x', ' /faq', '/fa q', 'mailto:a@b.c']) {
      expect(isSafeHref(bad), bad).toBe(false);
    }
  });
});

describe('rawHtml fields are checked by validation', () => {
  it('reports each allowlist error at the field', () => {
    const s = group({ body: text({ rawHtml: true }), plain: text() });
    const r = s.safeParse({ body: 'x <img src=x onerror=y>', plain: 'a <img> is just text here' });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([['body', 'disallowed tag <img>']]);
  });

  it('every rawHtml value in every committed content/pages doc passes', () => {
    const dir = resolve(__dirname, '../../content/pages');
    let checked = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const docId = file.slice(0, -5);
      const def = CMS_DOC_TYPES[docTypeFor(docId)];
      const doc = JSON.parse(readFileSync(resolve(dir, file), 'utf8')) as Record<'en' | 'el', unknown>;
      if (!fieldPaths(def.schema, (m) => !!m.rawHtml).length) continue;
      for (const locale of ['en', 'el'] as const) {
        walkSchema(def.schema, (n) => {
          if (n.meta.rawHtml && typeof n.values[0] === 'string') {
            expect(htmlErrors(n.values[0]), `${docId} ${locale}.${n.path}`).toEqual([]);
            checked += 1;
          }
        }, [doc[locale]]);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
