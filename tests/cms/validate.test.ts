// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { text, multiline, list, group, choice, flag, optional, tuple } from '../../supabase/functions/_shared/cms/fields';
import { sharedMismatches, validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { CMS_DOC_TYPES, docTypeFor } from '../../supabase/functions/_shared/cms/registry';

const schema = group({
  title: text({ label: 'Title', maxLength: 20, placeholders: ['year'] }),
  intro: multiline({ placeholders: ['count', 'year'] }),
  note: text({ required: false }),
  faq: list(group({ q: text(), a: multiline() })),
});

const page = (over: Record<string, unknown> = {}) => ({
  title: 'Eurovision {year}',
  intro: '{count} songs in {year}',
  note: '',
  faq: [{ q: 'Q?', a: 'A.' }],
  ...over,
});

const TYPE = '__test-page';
const ROOT = resolve(__dirname, '../..');

describe('validateDocument', () => {
  // The registry is empty until Tasks 4-6; register a fixture type for the test.
  CMS_DOC_TYPES[TYPE] = { schema, label: 'Test', group: 'site' };

  it('accepts a valid doc and returns the value', () => {
    const doc = { en: page(), el: page({ title: 'Γιουροβίζιον {year}' }) };
    const r = validateDocument(TYPE, doc);
    expect(r).toEqual({ ok: true, value: doc });
  });

  it('reports an empty required field in el with its path and locale', () => {
    const r = validateDocument(TYPE, { en: page(), el: page({ title: '  ' }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([{ path: 'title', locale: 'el', message: expect.stringMatching(/required/i) }]);
  });

  it('reports empty required fields inside lists with an indexed path', () => {
    const r = validateDocument(TYPE, { en: page({ faq: [{ q: 'Q?', a: '' }] }), el: page() });
    expect(!r.ok && r.errors).toEqual([{ path: 'faq.0.a', locale: 'en', message: expect.stringMatching(/required/i) }]);
  });

  it('allows an empty optional field', () => {
    expect(validateDocument(TYPE, { en: page({ note: '' }), el: page({ note: '' }) }).ok).toBe(true);
  });

  it('reports an unknown placeholder', () => {
    const r = validateDocument(TYPE, { en: page({ title: 'Eurovision {city}' }), el: page() });
    expect(!r.ok && r.errors).toEqual([{ path: 'title', locale: 'en', message: expect.stringContaining('{city}') }]);
  });

  it('reports a bad placeholder inside a nested list item with its exact path and locale', () => {
    const r = validateDocument(TYPE, { en: page(), el: page({ faq: [{ q: 'Q?', a: 'A.' }, { q: 'In {city}?', a: 'A.' }] }) });
    expect(!r.ok && r.errors).toEqual([{ path: 'faq.1.q', locale: 'el', message: expect.stringContaining('{city}') }]);
  });

  it('flags escaped braces in a field that declares no placeholders', () => {
    for (const note of ['{{year}}', 'a }} b']) {
      const r = validateDocument(TYPE, { en: page({ note }), el: page() });
      expect(!r.ok && r.errors).toEqual([{ path: 'note', locale: 'en', message: 'escaped braces in a field without placeholders' }]);
    }
  });

  it('accepts escaped braces in a field that declares placeholders', () => {
    expect(validateDocument(TYPE, { en: page({ title: '{{x}} {year}' }), el: page() }).ok).toBe(true);
  });

  it('enforces maxLength', () => {
    const r = validateDocument(TYPE, { en: page(), el: page({ title: 'x'.repeat(21) }) });
    expect(!r.ok && r.errors).toEqual([{ path: 'title', locale: 'el', message: expect.stringContaining('20') }]);
  });

  it('reports unknown keys (strict schemas)', () => {
    const r = validateDocument(TYPE, { en: page({ extra: 'x' }), el: page({ faq: [{ q: 'Q', a: 'A', z: 1 }] }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(expect.arrayContaining([
      { path: '', locale: 'en', message: expect.stringContaining('extra') },
      { path: 'faq.0', locale: 'el', message: expect.stringContaining('z') },
    ]));
    expect(r.errors).toHaveLength(2);
  });

  it('reports an unknown top-level key and a missing locale', () => {
    const r = validateDocument(TYPE, { en: page(), fr: page() });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ locale: 'el', path: '' }),
      expect.objectContaining({ message: expect.stringContaining('fr') }),
    ]));
  });

  it('reports wrong types and missing fields', () => {
    const noFaq: Record<string, unknown> = page();
    delete noFaq.faq;
    const r = validateDocument(TYPE, { en: noFaq, el: page({ title: 5 }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => `${e.locale}:${e.path}`).sort()).toEqual(['el:title', 'en:faq']);
  });

  it('rejects a non-object document', () => {
    expect(validateDocument(TYPE, 'nope').ok).toBe(false);
    expect(validateDocument(TYPE, null).ok).toBe(false);
  });

  it('rejects an unknown doc type', () => {
    const r = validateDocument('no-such-type', { en: {}, el: {} });
    expect(!r.ok && r.errors[0].message).toMatch(/unknown doc type/i);
  });
});

describe('locale-shared fields', () => {
  const SHARED = '__test-shared';
  const sharedSchema = group({
    tone: choice(['muted', 'pink']),
    open: flag(),
    href: text({ shared: true }),
    label: text(),
    maybe: optional(choice(['a', 'b'])),
    rows: list(group({ id: choice(['x', 'y', 'z']), text: text() })),
  });
  CMS_DOC_TYPES[SHARED] = { schema: sharedSchema, label: 'Shared', group: 'site' };
  const loc = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    tone: 'pink', open: true, href: '/faq', label: 'Label', maybe: 'a',
    rows: [{ id: 'x', text: 'One' }, { id: 'y', text: 'Two' }],
    ...over,
  });
  const MSG = 'must equal the en value (locale-shared field)';

  it('accepts a doc whose shared fields match and whose translated fields differ', () => {
    const r = validateDocument(SHARED, { en: loc(), el: loc({ label: 'Ετικέτα', rows: [{ id: 'x', text: 'Ένα' }, { id: 'y', text: 'Δύο' }] }) });
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('reports every differing shared field under el with its path', () => {
    const r = validateDocument(SHARED, { en: loc(), el: loc({ tone: 'muted', open: false, href: '/rules' }) });
    expect(!r.ok && r.errors).toEqual([
      { path: 'tone', locale: 'el', message: MSG },
      { path: 'open', locale: 'el', message: MSG },
      { path: 'href', locale: 'el', message: MSG },
    ]);
  });

  it('compares shared fields inside list items by index', () => {
    const r = validateDocument(SHARED, { en: loc(), el: loc({ rows: [{ id: 'x', text: 'Ένα' }, { id: 'z', text: 'Δύο' }] }) });
    expect(!r.ok && r.errors).toEqual([{ path: 'rows.1.id', locale: 'el', message: MSG }]);
  });

  const LEN = 'must have the same number of items as en (list holds locale-shared fields)';

  it('requires a list holding shared fields to have as many items in el as in en', () => {
    const r = validateDocument(SHARED, { en: loc(), el: loc({ rows: [{ id: 'x', text: 'Ένα' }] }) });
    expect(!r.ok && r.errors).toEqual([{ path: 'rows', locale: 'el', message: LEN }]);
    const more = validateDocument(SHARED, {
      en: loc(),
      el: loc({ rows: [{ id: 'x', text: 'Ένα' }, { id: 'y', text: 'Δύο' }, { id: 'z', text: 'Τρία' }] }),
    });
    expect(!more.ok && more.errors).toEqual([{ path: 'rows', locale: 'el', message: LEN }]);
  });

  it('still compares the shared fields of the indices both locales have', () => {
    const r = validateDocument(SHARED, { en: loc(), el: loc({ rows: [{ id: 'z', text: 'Ένα' }] }) });
    expect(!r.ok && r.errors).toEqual([
      { path: 'rows', locale: 'el', message: LEN },
      { path: 'rows.0.id', locale: 'el', message: MSG },
    ]);
  });

  describe('list length rule', () => {
    const NESTED = '__test-shared-nested';
    const nestedSchema = group({
      // Shared field two levels down, through an optional wrapper and a group.
      deep: list(group({ label: text(), more: optional(group({ link: text({ shared: true }) })) })),
      // Shared field inside a nested list.
      outer: list(group({ inner: list(group({ tone: choice(['a', 'b']) })) })),
      // No shared field anywhere: lengths may differ.
      free: list(group({ q: text(), a: text() })),
      // A plain list of strings.
      cells: list(text()),
    });
    CMS_DOC_TYPES[NESTED] = { schema: nestedSchema, label: 'Nested', group: 'site' };
    const base = (): Record<string, unknown> => ({
      deep: [{ label: 'A' }, { label: 'B', more: { link: '/x' } }],
      outer: [{ inner: [{ tone: 'a' }, { tone: 'b' }] }],
      free: [{ q: 'Q', a: 'A' }],
      cells: ['a'],
    });

    it('applies through optional wrappers and nested groups', () => {
      const el = base();
      el.deep = [{ label: 'Α' }];
      const r = validateDocument(NESTED, { en: base(), el });
      expect(!r.ok && r.errors).toEqual([{ path: 'deep', locale: 'el', message: LEN }]);
    });

    it('applies to a nested list, at its own path', () => {
      const el = base();
      el.outer = [{ inner: [{ tone: 'a' }] }];
      const r = validateDocument(NESTED, { en: base(), el });
      expect(!r.ok && r.errors).toEqual([{ path: 'outer.0.inner', locale: 'el', message: LEN }]);
    });

    it('does not apply to a list without shared fields', () => {
      const el = base();
      el.free = [{ q: 'Ε', a: 'Α' }, { q: 'Ε2', a: 'Α2' }];
      el.cells = [];
      expect(validateDocument(NESTED, { en: base(), el }).ok).toBe(true);
    });

    it('exempts tuples', () => {
      const t = tuple([text({ shared: true }), text()]);
      expect(sharedMismatches(t, ['/a', 'x'], ['/a'])).toEqual([]);
    });
  });

  it('treats an optional shared field present in one locale only as different', () => {
    const el = loc();
    delete el.maybe;
    const r = validateDocument(SHARED, { en: loc(), el });
    expect(!r.ok && r.errors).toEqual([{ path: 'maybe', locale: 'el', message: MSG }]);
    const both = loc();
    delete both.maybe;
    expect(validateDocument(SHARED, { en: both, el: { ...both } }).ok).toBe(true);
  });

  it('reports shape errors and shared mismatches together', () => {
    const r = validateDocument(SHARED, { en: loc(), el: loc({ tone: 'muted', label: '' }) });
    expect(!r.ok && r.errors).toEqual(expect.arrayContaining([
      { path: 'label', locale: 'el', message: expect.stringMatching(/required/i) },
      { path: 'tone', locale: 'el', message: MSG },
    ]));
  });

  it('marks the Task 4 presentation fields as shared', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Loose = Record<string, any>;
    const doc = (id: string) => JSON.parse(readFileSync(resolve(ROOT, `content/pages/${id}.json`), 'utf8')) as Record<'en' | 'el', Loose>;
    const cases: [string, (el: Loose) => void, string][] = [
      ['scoring', (el) => { el.quiz.rows[0].tone = el.quiz.rows[0].tone === 'muted' ? 'strong' : 'muted'; }, 'quiz.rows.0.tone'],
      ['cookies', (el) => { el.whatWeUse.rows[1].defaultTone = el.whatWeUse.rows[1].defaultTone === 'pink' ? 'muted' : 'pink'; }, 'whatWeUse.rows.1.defaultTone'],
      ['dashboard', (el) => { el.sections.sources.rows[0].capIsOpen = !el.sections.sources.rows[0].capIsOpen; }, 'sections.sources.rows.0.capIsOpen'],
      ['faq', (el) => { [el.anchored[0].id, el.anchored[1].id] = [el.anchored[1].id, el.anchored[0].id]; }, 'anchored.0.id'],
      ['about', (el) => { el.related[0].href = '/elsewhere'; }, 'related.0.href'],
    ];
    for (const [id, mutate, path] of cases) {
      const d = doc(id);
      expect(validateDocument(id, d).ok).toBe(true);
      mutate(d.el);
      const r = validateDocument(id, d);
      expect(!r.ok && r.errors).toEqual(expect.arrayContaining([{ path, locale: 'el', message: MSG }]));
    }
  });
});

describe('faq anchored ids', () => {
  type Anchored = { id: string; q: string; a: string }[];
  const doc = () => JSON.parse(readFileSync(resolve(ROOT, 'content/pages/faq.json'), 'utf8')) as Record<'en' | 'el', { anchored: Anchored }>;

  it('accepts create, join and leave in any order', () => {
    const d = doc();
    d.en.anchored.reverse();
    d.el.anchored.reverse();
    expect(validateDocument('faq', d).ok).toBe(true);
  });

  it('rejects a duplicate, a missing or an extra id', () => {
    const variants: ((a: Anchored) => void)[] = [
      (a) => { a[2].id = 'join'; },
      (a) => { a.pop(); },
      (a) => { a.push({ ...a[0] }); },
    ];
    for (const change of variants) {
      const d = doc();
      change(d.en.anchored);
      change(d.el.anchored);
      const r = validateDocument('faq', d);
      expect(!r.ok && r.errors).toEqual(expect.arrayContaining([
        { path: 'anchored', locale: 'en', message: expect.stringContaining('create, join, leave') },
        { path: 'anchored', locale: 'el', message: expect.stringContaining('create, join, leave') },
      ]));
    }
  });
});

describe('docTypeFor', () => {
  it('maps static page ids to the same name and editorial ids to their family', () => {
    expect(docTypeFor('faq')).toBe('faq');
    expect(docTypeFor('how-to-play')).toBe('how-to-play');
    expect(docTypeFor('not-found')).toBe('not-found');
    expect(docTypeFor('archive-1956')).toBe('archive');
    expect(docTypeFor('country-GR')).toBe('country');
    expect(docTypeFor('hub-2026')).toBe('hub');
  });
});
