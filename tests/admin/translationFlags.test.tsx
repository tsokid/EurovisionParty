// CMS P6: missing-translation flags at field, doc and tree level.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { group, list, text } from '../../supabase/functions/_shared/cms/fields';
import { missingTranslations } from '../../supabase/functions/_shared/cms/translations';
import { SchemaForm, type DocValue } from '../../src/admin/modules/pages/form/SchemaForm';
import { TranslationChips } from '../../src/admin/cms/TranslationChips';
import AdminSidebar from '../../src/admin/AdminSidebar';
import { __resetTranslationStatusForTests, reportGaps } from '../../src/admin/cms/translationStatus';

vi.mock('../../src/lib/supabase', () => ({
  supabase: { rpc: () => Promise.resolve({ data: [], error: null }) },
}));

const schema = group({ title: text({ label: 'Title' }), items: list(group({ q: text({ label: 'Question' }) }), { label: 'Items' }) });

function Form({ initial }: { initial: DocValue }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <TranslationChips missing={missingTranslations(schema, value)} formRef={ref} />
      <SchemaForm schema={schema} value={value} onChange={setValue} errors={[]} warnings={[]} />
    </div>
  );
}

beforeEach(() => {
  __resetTranslationStatusForTests();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('field and doc flags', () => {
  it('a red dot on the empty side of a field; the doc chips count each language and jump to the first gap', () => {
    render(<Form initial={{ en: { title: 'Hello', items: [{ q: 'Q1' }, { q: 'Q2' }] }, el: { title: '', items: [{ q: 'Ε1' }, { q: '' }] } }} />);
    const dots = screen.getAllByTestId('missing-dot');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveTextContent('Λείπει η μετάφραση (EL)');
    expect(screen.getByLabelText('Title (EL)')).toHaveAttribute('data-cms-missing', 'true');
    expect(screen.getByLabelText('Title (EN)')).not.toHaveAttribute('data-cms-missing');

    const chips = screen.getByRole('group', { name: 'Μεταφράσεις' });
    expect(within(chips).getByText('EN: πλήρες')).toBeTruthy();
    const el = within(chips).getByRole('button', { name: 'EL: λείπουν 2 μεταφράσεις. Πήγαινε στο πρώτο κενό' });
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(el);
    expect(document.activeElement).toBe(screen.getByLabelText('Title (EL)'));

    fireEvent.change(screen.getByLabelText('Title (EL)'), { target: { value: 'Γεια' } });
    expect(screen.getAllByTestId('missing-dot')).toHaveLength(1);
    expect(within(chips).getByText('EL: λείπουν 1')).toBeTruthy();
  });
});

describe('tree flags', () => {
  it('the page tree shows a dot on a doc missing a language, and on its group; the header row too', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/pages/faq']}>
        <AdminSidebar />
      </MemoryRouter>,
    );
    expect(screen.queryAllByTestId('tree-missing')).toHaveLength(0);
    act(() => {
      reportGaps('faq', { en: 0, el: 2 });
      reportGaps('site-header', { en: 1, el: 0 });
    });
    // FAQ sits in more than one group (header menu, footer column): flagged in each.
    const faqs = screen.getAllByRole('link', { name: /Συχνές ερωτήσεις/ });
    for (const faq of faqs) expect(within(faq).getByTestId('tree-missing')).toHaveTextContent('Λείπουν μεταφράσεις: EL 2');
    const header = screen.getByRole('link', { name: /^Header|Κεφαλίδα/ });
    expect(within(header).getByTestId('tree-missing')).toHaveTextContent('Λείπουν μεταφράσεις: EN 1');
    expect(screen.getAllByTestId('tree-missing').some((d) => d.textContent === 'Κάποια σελίδα εδώ θέλει μετάφραση')).toBe(true);
    act(() => reportGaps('faq', { en: 0, el: 0 }));
    for (const faq of screen.getAllByRole('link', { name: /Συχνές ερωτήσεις/ })) expect(within(faq).queryByTestId('tree-missing')).toBeNull();
  });
});
