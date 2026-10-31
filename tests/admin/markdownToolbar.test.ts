// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { applyMarkdown } from '../../src/admin/modules/pages/form/fields/markdownToolbar';
import { parseRichText, richTextErrors } from '../../supabase/functions/_shared/cms/richText';

/** `text` with [ and ] marking the selection, e.g. "say [hi]". */
function run(marked: string, action: Parameters<typeof applyMarkdown>[3]) {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  const text = marked.replace('[', '').replace(']', '');
  const out = applyMarkdown(text, start, end, action);
  return out.text.slice(0, out.start) + '[' + out.text.slice(out.start, out.end) + ']' + out.text.slice(out.end);
}

describe('applyMarkdown', () => {
  it('bold and italic wrap the selection and keep it selected', () => {
    expect(run('say [hi] there', 'bold')).toBe('say **[hi]** there');
    expect(run('say [hi] there', 'italic')).toBe('say *[hi]* there');
  });

  it('with no selection, inserts a selected sample', () => {
    expect(run('say []', 'bold')).toBe('say **[bold text]**');
    expect(run('say []', 'italic')).toBe('say *[italic text]*');
  });

  it('link wraps the selection as the label and selects the address', () => {
    const wrapped = applyMarkdown('see the FAQ now', 4, 11, 'link');
    expect(wrapped.text).toBe('see [the FAQ](https://) now');
    expect(wrapped.text.slice(wrapped.start, wrapped.end)).toBe('https://');
    const out = applyMarkdown('see ', 4, 4, 'link');
    expect(out.text).toBe('see [link text](https://)');
    expect(out.text.slice(out.start, out.end)).toBe('https://');
  });

  it('list prefixes every selected line once', () => {
    const out = applyMarkdown('one\ntwo\n- three', 0, 13, 'list');
    expect(out.text).toBe('- one\n- two\n- three');
  });

  it('heading prefixes the line holding the caret, replacing other # levels', () => {
    expect(applyMarkdown('intro\nTitle here', 8, 8, 'heading').text).toBe('intro\n### Title here');
    expect(applyMarkdown('## Title', 3, 3, 'heading').text).toBe('### Title');
    expect(applyMarkdown('### Title', 3, 3, 'heading').text).toBe('### Title');
  });

  it('a link left without its address is an error until the address is typed', () => {
    const out = applyMarkdown('Hello world', 6, 11, 'link');
    expect(richTextErrors(out.text)).toHaveLength(1);
    const filled = out.text.slice(0, out.start) + '/faq' + out.text.slice(out.end);
    expect(richTextErrors(filled)).toEqual([]);
  });

  it('every other action produces valid rich text', () => {
    for (const action of ['bold', 'italic', 'list', 'heading'] as const) {
      const { text } = applyMarkdown('Hello world', 6, 11, action);
      expect(richTextErrors(text), `${action}: ${text}`).toEqual([]);
      expect(parseRichText(text).length).toBeGreaterThan(0);
    }
  });
});
