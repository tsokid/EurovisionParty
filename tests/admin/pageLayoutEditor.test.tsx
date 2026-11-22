// The page-layout editor (CMS P6, owner decision Q4 = B): a section-based
// page's sections and blocks as one list. Add, duplicate, reorder (buttons
// and drag) and remove blocks; reorder, hide and put back sections; a locked
// section (behind JSON-LD) never leaves; the section's own fields sit inside
// its card; the hero, breadcrumbs and meta stay outside.
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { SchemaForm, type DocValue } from '../../src/admin/modules/pages/form/SchemaForm';
import { ToastHost } from '../../src/admin/ui/kit';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: [], error: null }),
    storage: { from: () => ({ createSignedUrls: () => Promise.resolve({ data: [], error: null }) }) },
  },
}));

type Item = { type: string; key?: string; id?: string; body?: string };
type Doc = { en: Record<string, unknown> & { layout?: Item[] }; el: Record<string, unknown> & { layout?: Item[] } };

const published = (id: string) => JSON.parse(readFileSync(resolve(__dirname, `../../content/pages/${id}.json`), 'utf8')) as Doc;

const NO_ERRORS: never[] = [];

function setup(docId: string, initial: Doc = published(docId)) {
  let current = initial;
  function Host() {
    const [value, setValue] = useState<DocValue>(current);
    return (
      <MemoryRouter>
        <ToastHost>
          <SchemaForm
            schema={CMS_DOC_TYPES[docId].schema}
            value={value}
            onChange={(next) => {
              current = next as Doc;
              setValue(next);
            }}
            errors={NO_ERRORS}
            warnings={[]}
          />
        </ToastHost>
      </MemoryRouter>
    );
  }
  render(<Host />);
  return { value: () => current };
}

/** A form control by its label text (getByLabelText is very slow in jsdom on a form this size). */
function control(name: string): HTMLElement {
  const label = [...document.querySelectorAll('label[for]')].find((l) => l.textContent === name);
  const el = label && document.getElementById(label.getAttribute('for')!);
  if (!el) throw new Error(`no control labelled ${name}`);
  return el;
}

const keys = (items: Item[] | undefined) => (items ?? []).map((it) => (it.type === 'section' ? it.key : `${it.type}:${it.body ?? ''}`));
const ABOUT = ['whatIs', 'why', 'whatsIn', 'freeNoAccount', 'ebu', 'builtBy'];
const sectionCards = () => screen.getAllByTestId('layout-section');

describe('page layout editor', { timeout: 90_000 }, () => {
  it('shows the sections in order with their own fields inside; the hero and meta stay outside the list', () => {
    setup('about');
    const cards = sectionCards();
    expect(cards).toHaveLength(6);
    const about = published('about');
    expect(within(cards[0]).getByText((about.en.whatIs as { title: string }).title)).toBeTruthy();
    // The section's own field is inside its card…
    expect(within(cards[1]).getByLabelText(/Why we built it.*› Body \(EN\)|› Body \(EN\)/)).toBeTruthy();
    // …and not drawn a second time outside it; the hero title is outside the list.
    const list = screen.getByRole('list', { name: 'Page sections' });
    expect(within(list).queryByLabelText('Hero › Title (EN)')).toBeNull();
    expect(control('Hero › Title (EN)')).toBeTruthy();
    expect(screen.getAllByLabelText(/› Body \(EN\)$/).filter((el) => cards[1].contains(el))).toHaveLength(1);
  });

  it('adds, duplicates and removes blocks; nothing is written until the first change', () => {
    const form = setup('about');
    expect(form.value().en.layout).toBeUndefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Τύπος μπλοκ: Page sections' }), { target: { value: 'callout' } });
    fireEvent.click(screen.getByRole('button', { name: 'Προσθήκη μπλοκ: Page sections' }));
    expect(keys(form.value().en.layout)).toEqual([...ABOUT, 'callout:']);
    expect(form.value().el.layout).toEqual(form.value().en.layout);
    fireEvent.change(control('Page sections › Μπλοκ 7 › Text (EN)'), { target: { value: 'Note' } });
    fireEvent.change(control('Page sections › Μπλοκ 7 › Text (EL)'), { target: { value: 'Σημείωση' } });
    fireEvent.click(screen.getByRole('button', { name: 'Διπλότυπο: Page sections › Μπλοκ 7' }));
    const [a, b] = form.value().en.layout!.slice(6);
    expect([a.body, b.body]).toEqual(['Note', 'Note']);
    expect(a.id).not.toBe(b.id);
    expect(form.value().el.layout![7]).toMatchObject({ body: 'Σημείωση', id: b.id });
    fireEvent.click(screen.getByRole('button', { name: 'Αφαίρεση: Page sections › Μπλοκ 8' }));
    expect(keys(form.value().en.layout)).toEqual([...ABOUT, 'callout:Note']);
    expect(validateDocument('about', form.value()).ok).toBe(true);
  });

  it('reorders with the buttons and by dragging the grip, the same in both languages', () => {
    const form = setup('about');
    fireEvent.click(screen.getByRole('button', { name: /^Μετακίνηση κάτω: Page sections › Ενότητα «What is/ }));
    expect(keys(form.value().en.layout).slice(0, 2)).toEqual(['why', 'whatIs']);
    const grip = screen.getByRole('img', { name: /^Σύρε για μετακίνηση: Page sections › Ενότητα «Built by/ });
    const target = sectionCards()[0];
    const data = { effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '' };
    act(() => {
      fireEvent(grip, Object.assign(createEvent.dragStart(grip), { dataTransfer: data }));
    });
    fireEvent(target, Object.assign(createEvent.dragOver(target), { dataTransfer: data }));
    fireEvent(target, Object.assign(createEvent.drop(target), { dataTransfer: data }));
    expect(keys(form.value().en.layout)).toEqual(['builtBy', 'why', 'whatIs', 'whatsIn', 'freeNoAccount', 'ebu']);
    expect(keys(form.value().el.layout)).toEqual(keys(form.value().en.layout));
  });

  it('hides a section into «Κρυμμένες ενότητες» and puts it back; its text is kept', () => {
    const form = setup('about');
    fireEvent.click(screen.getByRole('button', { name: /^Αφαίρεση: Page sections › Ενότητα «Not affiliated/ }));
    expect(keys(form.value().en.layout)).toEqual(ABOUT.filter((k) => k !== 'ebu'));
    expect(form.value().en.ebu).toEqual(published('about').en.ebu);
    const tray = screen.getByTestId('hidden-sections');
    fireEvent.click(within(tray).getByRole('button', { name: /^Επαναφορά ενότητας: Not affiliated/ }));
    expect(keys(form.value().en.layout)).toEqual([...ABOUT.filter((k) => k !== 'ebu'), 'ebu']);
    expect(screen.queryByTestId('hidden-sections')).toBeNull();
  });

  it('a locked section (the FAQ behind the FAQPage) cannot be hidden or duplicated', () => {
    setup('eurovision-games');
    const faq = sectionCards().find((c) => within(c).queryByText('Κλειδωμένη'))!;
    expect(faq).toBeTruthy();
    expect(within(faq).getByRole('button', { name: /^Αφαίρεση: Page sections › Ενότητα «[^»]*»$/ })).toBeDisabled();
    expect(within(faq).getByRole('button', { name: /^Διπλότυπο: Page sections › Ενότητα «[^»]*»$/ })).toBeDisabled();
    // Its two parts (the heading and the question list) are both inside the card.
    expect(within(faq).getAllByLabelText(/› Q \(EN\)$/).length).toBeGreaterThan(0);
  });
});
