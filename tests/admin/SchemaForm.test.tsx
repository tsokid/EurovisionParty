import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { z } from 'zod';
import {
  choice, flag, group, href, list, multiline, optional, richText, text, tuple,
} from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import type { ValidationError } from '../../supabase/functions/_shared/cms/validate';
import { SchemaForm, type DocValue } from '../../src/admin/modules/pages/form/SchemaForm';
import { bundledContent, getSite } from '../../src/lib/seo/contentData';
import { contestVars } from '../../src/admin/modules/pages/contestContext';
import { toCurrentContest } from '../../src/lib/currentContest';

const deepFreeze = <T,>(v: T): T => {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
};

type Props = {
  schema: z.ZodType;
  initial: DocValue;
  errors?: ValidationError[];
  warnings?: ValidationError[];
  vars?: { en: Record<string, string | number>; el: Record<string, string | number> };
  onFieldRender?: (path: string) => void;
};

/**
 * A controlled host: every value handed to (or produced by) the form is deep-
 * frozen, so any in-place mutation throws. `changes` records each new value
 * and the value it replaced.
 */
function setup(props: Props) {
  const changes: { prev: DocValue; prevJson: string; next: DocValue }[] = [];
  let current = deepFreeze(props.initial);
  function Host() {
    const [value, setValue] = useState<DocValue>(current);
    return (
      <SchemaForm
        schema={props.schema}
        value={value}
        onChange={(next) => {
          changes.push({ prev: value, prevJson: JSON.stringify(value), next });
          current = deepFreeze(next);
          setValue(current);
        }}
        errors={props.errors ?? []}
        warnings={props.warnings ?? []}
        vars={props.vars}
        onFieldRender={props.onFieldRender}
      />
    );
  }
  const utils = render(<Host />);
  return {
    ...utils,
    changes,
    value: () => current,
    /** Every change returned a new object and left the old value as it was. */
    assertImmutable: () => {
      for (const c of changes) {
        expect(c.next).not.toBe(c.prev);
        expect(JSON.stringify(c.prev)).toBe(c.prevJson);
      }
    },
  };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('SchemaForm: string kinds', () => {
  const schema = group({
    title: text({ label: 'Title' }),
    body: multiline(),
    story: richText(),
    link: href(),
    perLocaleLink: href({ shared: false }),
  });
  const initial = {
    en: { title: 'Hello', body: 'Line', story: '**Hi**', link: '/faq', perLocaleLink: '/en' },
    el: { title: 'Γεια', body: 'Γραμμή', story: '**Γεια**', link: '/faq', perLocaleLink: '/el' },
  };

  it('shows EN and EL side by side and edits one locale at a time', () => {
    const f = setup({ schema, initial });
    expect(screen.getByLabelText('Title (EN)')).toHaveValue('Hello');
    expect(screen.getByLabelText('Title (EL)')).toHaveValue('Γεια');
    type('Title (EL)', 'Καλημέρα');
    expect(f.value().el).toMatchObject({ title: 'Καλημέρα' });
    expect(f.value().en).toMatchObject({ title: 'Hello' });
    expect(f.value().en).toBe(f.changes[0].prev.en); // structural sharing: the untouched locale is reused
    f.assertImmutable();
  });

  it('uses a textarea for multiline and richText, an input for text and href', () => {
    setup({ schema, initial });
    expect(screen.getByLabelText('Body (EN)').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Story (EL)').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Title (EN)').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Per locale link (EN)').tagName).toBe('INPUT');
  });

  it('edits a shared href once, for both locales', () => {
    const f = setup({ schema, initial });
    expect(screen.queryByLabelText('Link (EN)')).toBeNull();
    type('Link (EN + EL)', '/rules');
    expect(f.value().en).toMatchObject({ link: '/rules' });
    expect(f.value().el).toMatchObject({ link: '/rules' });
    f.assertImmutable();
  });

  it('edits a non-shared href per locale', () => {
    const f = setup({ schema, initial });
    type('Per locale link (EL)', '/el/x');
    expect(f.value().el).toMatchObject({ perLocaleLink: '/el/x' });
    expect(f.value().en).toMatchObject({ perLocaleLink: '/en' });
  });

  it('gives rawHtml fields a monospace textarea with the allowlist hint', () => {
    const s = group({ rest: text({ rawHtml: true }) });
    setup({ schema: s, initial: { en: { rest: 'a <em>b</em>' }, el: { rest: 'α' } } });
    const ta = screen.getByLabelText('Rest (EN)');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.className).toContain('font-mono');
    expect(screen.getAllByText('Allowed: <strong>, <em>, <b>, <i>, <br>, <a href="/…">').length).toBeGreaterThan(0);
  });
});

describe('SchemaForm: choice, flag, tuple, group, optional', () => {
  it('a shared choice is one select writing both locales', () => {
    const s = group({ tone: choice(['muted', 'pink']) });
    const f = setup({ schema: s, initial: { en: { tone: 'muted' }, el: { tone: 'muted' } } });
    const sel = screen.getByLabelText('Tone (EN + EL)');
    expect(sel.tagName).toBe('SELECT');
    expect(within(sel).getAllByRole('option').map((o) => o.textContent)).toEqual(['muted', 'pink']);
    fireEvent.change(sel, { target: { value: 'pink' } });
    expect(f.value()).toEqual({ en: { tone: 'pink' }, el: { tone: 'pink' } });
    f.assertImmutable();
  });

  it('a shared flag is one checkbox writing both locales', () => {
    const s = group({ capIsOpen: flag() });
    const f = setup({ schema: s, initial: { en: { capIsOpen: false }, el: { capIsOpen: false } } });
    fireEvent.click(screen.getByLabelText('Cap is open (EN + EL)'));
    expect(f.value()).toEqual({ en: { capIsOpen: true }, el: { capIsOpen: true } });
    f.assertImmutable();
  });

  it('a tuple renders fixed rows with no add or remove', () => {
    const s = group({ headers: tuple([text(), text()]) });
    const f = setup({ schema: s, initial: { en: { headers: ['A', 'B'] }, el: { headers: ['Α', 'Β'] } } });
    expect(screen.getByLabelText('Headers › Item 2 (EL)')).toHaveValue('Β');
    expect(screen.queryByRole('button', { name: /add|remove/i })).toBeNull();
    type('Headers › Item 1 (EN)', 'Z');
    expect(f.value().en).toEqual({ headers: ['Z', 'B'] });
    f.assertImmutable();
  });

  it('a group is a fieldset named by its label, or by its humanised key', () => {
    const s = group({ meta: group({ title: text() }, { label: 'Page meta (SEO)' }), joinSection: group({ title: text() }) });
    setup({ schema: s, initial: { en: { meta: { title: 'a' }, joinSection: { title: 'b' } }, el: { meta: { title: 'α' }, joinSection: { title: 'β' } } } });
    expect(screen.getByRole('group', { name: 'Page meta (SEO)' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Join section' })).toBeInTheDocument();
    expect(screen.getByLabelText('Page meta (SEO) › Title (EL)')).toHaveValue('α');
  });

  it('an optional field toggles with Add / Remove (both locales)', () => {
    const s = group({ title: text(), linkLabel: optional(text()) });
    const f = setup({ schema: s, initial: { en: { title: 't' }, el: { title: 'τ' } } });
    expect(screen.queryByLabelText('Link label (EN)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Link label' }));
    expect(f.value()).toEqual({ en: { title: 't', linkLabel: '' }, el: { title: 'τ', linkLabel: '' } });
    type('Link label (EL)', 'σύνδεσμος');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Link label' }));
    expect(f.value()).toEqual({ en: { title: 't' }, el: { title: 'τ' } });
    expect('linkLabel' in (f.value().en as object)).toBe(false);
    f.assertImmutable();
  });

  it('an optional group is added with its empty value', () => {
    const s = group({ link: optional(group({ before: text(), label: text() })) });
    const f = setup({ schema: s, initial: { en: {}, el: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Link' }));
    expect(f.value()).toEqual({ en: { link: { before: '', label: '' } }, el: { link: { before: '', label: '' } } });
    expect(screen.getByLabelText('Link › Label (EN)')).toHaveValue('');
  });
});

describe('SchemaForm: lists', () => {
  // FAQ-like: a list whose items hold a shared choice, so items line up by index.
  const anchored = group({
    faq: list(group({ id: choice(['create', 'join', 'leave']), q: text({ label: 'Question' }) }), { label: 'FAQ' }),
  });
  const initial = {
    en: { faq: [{ id: 'create', q: 'C?' }, { id: 'join', q: 'J?' }] },
    el: { faq: [{ id: 'create', q: 'Δ?' }, { id: 'join', q: 'Σ?' }] },
  };
  const qs = (v: DocValue, l: 'en' | 'el') => (v[l] as { faq: { q: string }[] }).faq.map((i) => i.q);
  const ids = (v: DocValue, l: 'en' | 'el') => (v[l] as { faq: { id: string }[] }).faq.map((i) => i.id);

  it('labels items "Item n" under the list label', () => {
    setup({ schema: anchored, initial });
    expect(screen.getByLabelText('FAQ › Item 2 › Question (EL)')).toHaveValue('Σ?');
    expect(screen.getByLabelText('FAQ › Item 1 › Id (EN + EL)')).toHaveValue('create');
  });

  it('shared list: add appends the empty item to both locales', () => {
    const f = setup({ schema: anchored, initial });
    fireEvent.click(screen.getByRole('button', { name: 'Add item to FAQ' }));
    expect(qs(f.value(), 'en')).toEqual(['C?', 'J?', '']);
    expect(qs(f.value(), 'el')).toEqual(['Δ?', 'Σ?', '']);
    expect(ids(f.value(), 'en')).toEqual(['create', 'join', 'create']);
    expect(ids(f.value(), 'el')).toEqual(ids(f.value(), 'en'));
    f.assertImmutable();
  });

  it('shared list: remove and reorder apply to both locales at the same index', () => {
    const f = setup({ schema: anchored, initial });
    fireEvent.click(screen.getByRole('button', { name: 'Move FAQ › Item 2 up' }));
    expect(qs(f.value(), 'en')).toEqual(['J?', 'C?']);
    expect(qs(f.value(), 'el')).toEqual(['Σ?', 'Δ?']);
    expect(ids(f.value(), 'el')).toEqual(['join', 'create']);
    fireEvent.click(screen.getByRole('button', { name: 'Move FAQ › Item 1 down' }));
    expect(qs(f.value(), 'el')).toEqual(['Δ?', 'Σ?']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove FAQ › Item 1' }));
    expect(qs(f.value(), 'en')).toEqual(['J?']);
    expect(qs(f.value(), 'el')).toEqual(['Σ?']);
    expect(ids(f.value(), 'en')).toEqual(['join']);
    expect(ids(f.value(), 'el')).toEqual(['join']);
    f.assertImmutable();
  });

  it('shared list: the first item cannot move up, the last cannot move down', () => {
    setup({ schema: anchored, initial });
    expect(screen.getByRole('button', { name: 'Move FAQ › Item 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move FAQ › Item 2 down' })).toBeDisabled();
  });

  it('free list (no shared fields): each locale is edited on its own', () => {
    const s = group({ keywords: list(text()) });
    const f = setup({ schema: s, initial: { en: { keywords: ['a', 'b'] }, el: { keywords: ['α'] } } });
    expect(screen.getByLabelText('Keywords › Item 2 (EN)')).toHaveValue('b');
    expect(screen.queryByLabelText('Keywords › Item 2 (EL)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add item to Keywords (EL)' }));
    expect(f.value()).toEqual({ en: { keywords: ['a', 'b'] }, el: { keywords: ['α', ''] } });
    fireEvent.click(screen.getByRole('button', { name: 'Move Keywords › Item 2 (EN) up' }));
    expect(f.value()).toEqual({ en: { keywords: ['b', 'a'] }, el: { keywords: ['α', ''] } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Keywords › Item 1 (EL)' }));
    expect(f.value()).toEqual({ en: { keywords: ['b', 'a'] }, el: { keywords: [''] } });
    f.assertImmutable();
  });

  it('a list of tuples (table rows) adds a row of empties', () => {
    const s = group({ rows: list(tuple([text(), text()])) });
    const f = setup({ schema: s, initial: { en: { rows: [] }, el: { rows: [] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item to Rows (EN)' }));
    expect(f.value().en).toEqual({ rows: [['', '']] });
    expect(screen.getByLabelText('Rows › Item 1 › Item 2 (EN)')).toHaveValue('');
  });
});

describe('SchemaForm: counters', () => {
  const s = group({ title: text({ label: 'SEO title', softMaxLength: 10, placeholders: ['year'] }) });

  it('counts characters against the soft limit', () => {
    setup({ schema: s, initial: { en: { title: 'Short' }, el: { title: 'Μικρό' } } });
    expect(screen.getAllByText('5 / 10')).toHaveLength(2);
    expect(screen.queryByText('Search engines may cut this off')).toBeNull();
  });

  it('turns amber above the soft limit, without blocking the input', () => {
    const f = setup({ schema: s, initial: { en: { title: 'Short' }, el: { title: 'Μικρό' } } });
    type('SEO title (EN)', 'Much too long a title');
    const counter = screen.getByText('21 / 10');
    expect(counter.className).toContain('amber');
    expect(screen.getByText('Search engines may cut this off')).toBeInTheDocument();
    expect(screen.getByLabelText('SEO title (EN)')).not.toBeDisabled();
    expect(screen.getByLabelText('SEO title (EN)')).not.toHaveAttribute('maxLength');
    type('SEO title (EN)', 'Even longer than that one');
    expect(f.value().en).toEqual({ title: 'Even longer than that one' });
  });

  it('counts the interpolated value when live-contest vars are given', () => {
    setup({ schema: s, initial: { en: { title: 'Final {year}' }, el: { title: '{year}' } }, vars: { en: { year: 2026 }, el: { year: 2026 } } });
    expect(screen.getByText('10 / 10')).toBeInTheDocument(); // "Final 2026", not "Final {year}" (12)
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
  });

  it('each locale counts with its own vars: a Greek field counts the Greek city', () => {
    // The live contest (snapshot: Vienna 2026), as the Pages editor builds it.
    const vars = contestVars(toCurrentContest(getSite().current));
    expect(vars.en.cityIn).toBe('in Vienna');
    expect(vars.el.cityIn).toBe('στη Βιέννη');
    const c = group({ title: text({ label: 'SEO title', softMaxLength: 30, placeholders: ['cityIn'] }) });
    setup({ schema: c, initial: { en: { title: 'Party {cityIn}' }, el: { title: 'Πάρτι {cityIn}' } }, vars });
    expect(screen.getByText('15 / 30')).toBeInTheDocument(); // "Party in Vienna"
    expect(screen.getByText('16 / 30')).toBeInTheDocument(); // "Πάρτι στη Βιέννη", not "Πάρτι in Vienna" (15)
  });

  it('counts the raw value without vars', () => {
    setup({ schema: s, initial: { en: { title: 'Final {year}' }, el: { title: '{year}' } } });
    expect(screen.getByText('12 / 10')).toBeInTheDocument();
  });
});

describe('SchemaForm: placeholder chips', () => {
  const s = group({ title: text({ placeholders: ['year', 'city'] }) });

  it('shows one chip per placeholder, with its help as the title', () => {
    setup({ schema: s, initial: { en: { title: '' }, el: { title: '' } } });
    const chips = screen.getAllByRole('button', { name: 'Insert {year} into Title (EN)' });
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveAttribute('title', 'The live contest year, e.g. 2026');
    expect(screen.getByRole('button', { name: 'Insert {city} into Title (EL)' })).toBeInTheDocument();
  });

  it('inserts the placeholder at the cursor', () => {
    const f = setup({ schema: s, initial: { en: { title: 'Eurovision final' }, el: { title: '' } } });
    const input = screen.getByLabelText('Title (EN)') as HTMLInputElement;
    input.setSelectionRange(10, 10);
    fireEvent.click(screen.getByRole('button', { name: 'Insert {year} into Title (EN)' }));
    expect(f.value().en).toEqual({ title: 'Eurovision{year} final' });
    expect(f.value().el).toEqual({ title: '' });
  });

  it('replaces a selection', () => {
    const f = setup({ schema: s, initial: { en: { title: 'In Vienna' }, el: { title: '' } } });
    const input = screen.getByLabelText('Title (EN)') as HTMLInputElement;
    input.setSelectionRange(3, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Insert {city} into Title (EN)' }));
    expect(f.value().en).toEqual({ title: 'In {city}' });
  });
});

describe('SchemaForm: errors and warnings', () => {
  const s = group({
    meta: group({ title: text(), description: text() }, { label: 'Page meta (SEO)' }),
    faq: list(group({ q: text(), a: text() }), { label: 'FAQ' }),
  });
  const initial = {
    en: { meta: { title: 't', description: 'd' }, faq: [{ q: 'q', a: '' }] },
    el: { meta: { title: 'τ', description: 'δ' }, faq: [{ q: 'ε', a: 'α' }] },
  };

  it('shows each error at its field and locale', () => {
    setup({
      schema: s,
      initial,
      errors: [
        { path: 'faq.0.a', locale: 'en', message: 'Required: must not be empty' },
        { path: 'meta.title', locale: 'el', message: 'Too long: 99 characters, max 60' },
      ],
    });
    const enA = screen.getByLabelText('FAQ › Item 1 › A (EN)');
    expect(enA).toHaveAttribute('aria-invalid', 'true');
    expect(enA).toHaveAccessibleDescription(/Required: must not be empty/);
    expect(screen.getByLabelText('FAQ › Item 1 › A (EL)')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Page meta (SEO) › Title (EL)')).toHaveAccessibleDescription(/Too long/);
    expect(screen.getByLabelText('Page meta (SEO) › Title (EN)')).not.toHaveAccessibleDescription(/Too long/);
  });

  it('shows warnings at their field, distinct from errors', () => {
    setup({ schema: s, initial, warnings: [{ path: 'meta.description', locale: 'en', message: 'Longer than recommended' }] });
    const d = screen.getByLabelText('Page meta (SEO) › Description (EN)');
    expect(d).toHaveAccessibleDescription(/Longer than recommended/);
    expect(d).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('shows document-level errors (locale null) at the top', () => {
    const { container } = setup({ schema: s, initial, errors: [{ path: '', locale: null, message: 'Unknown doc type' }] });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unknown doc type');
    expect(container.firstElementChild?.firstElementChild).toBe(alert);
  });

  it('shows a container error (list length mismatch) at the list', () => {
    setup({ schema: s, initial, errors: [{ path: 'faq', locale: 'el', message: 'must have the same number of items as en' }] });
    expect(screen.getByRole('group', { name: 'FAQ' })).toHaveTextContent('EL: must have the same number of items as en');
  });
});

describe('SchemaForm: performance', () => {
  it('typing in one field does not re-render its siblings', () => {
    const s = group({ a: text(), b: text(), items: list(group({ q: text() })) });
    const renders = new Map<string, number>();
    setup({
      schema: s,
      initial: { en: { a: 'x', b: 'y', items: [{ q: '1' }, { q: '2' }] }, el: { a: 'χ', b: 'ψ', items: [{ q: 'α' }, { q: 'β' }] } },
      onFieldRender: (p) => renders.set(p, (renders.get(p) ?? 0) + 1),
    });
    const before = new Map(renders);
    expect(before.get('b')).toBeGreaterThan(0);
    type('A (EN)', 'xx');
    type('Items › Item 1 › Q (EL)', 'αα');
    expect(renders.get('a')).toBeGreaterThan(before.get('a')!);
    expect(renders.get('items.0.q')).toBeGreaterThan(before.get('items.0.q')!);
    expect(renders.get('b')).toBe(before.get('b'));
    expect(renders.get('items.1')).toBe(before.get('items.1'));
    expect(renders.get('items.1.q')).toBe(before.get('items.1.q'));
  });
});

describe('SchemaForm: every page', () => {
  it.each(Object.entries(CMS_DOC_TYPES).filter(([, d]) => d.group === 'site'))('renders the published %s document with a label on every input', (docId, def) => {
    const doc = bundledContent(`pages/${docId}.json`) as DocValue;
    const onRender = vi.fn();
    const { container, unmount } = setup({ schema: def.schema, initial: doc, onFieldRender: onRender });
    const inputs = container.querySelectorAll('input, textarea, select');
    expect(inputs.length).toBeGreaterThan(3);
    // (HTMLInputElement.labels is very slow in jsdom: match label[for] by id instead.)
    const labelled = new Map<string, number>();
    for (const l of container.querySelectorAll('label[for]')) labelled.set(l.getAttribute('for')!, (labelled.get(l.getAttribute('for')!) ?? 0) + 1);
    for (const el of inputs) {
      expect(el.closest('label'), el.outerHTML.slice(0, 80)).toBeNull();
      expect(labelled.get(el.id), el.outerHTML.slice(0, 80)).toBe(1);
    }
    unmount();
  });
});
