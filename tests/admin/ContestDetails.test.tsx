import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  rpcError: null as { message: string; code?: string } | null,
  contest: null as Row | null,
  countries: [] as Row[],
}));

vi.mock('../../src/lib/supabase', () => {
  const table = (name: string) => {
    const rows = () => (name === 'contests' ? (h.contest ? [h.contest] : []) : name === 'countries' ? h.countries : []);
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(ok, bad),
    };
    return chain;
  };
  return {
    supabase: {
      from: (name: string) => table(name),
      rpc: (name: string, args?: unknown) => {
        h.rpc(name, args);
        return Promise.resolve(h.rpcError ? { data: null, error: h.rpcError } : { data: null, error: null });
      },
    },
  };
});

import { ContestDetailsForm } from '../../src/admin/modules/contests/ContestDetailsForm';

const NOTE = 'Ενεργοποιήστε το αφού προσθέσετε δικό σας κείμενο ή εικόνα για αυτή τη χρονιά.';

describe('ContestDetailsForm', () => {
  beforeEach(() => {
    h.rpc.mockClear();
    h.rpcError = null;
    h.contest = {
      year: 2025, city: 'Basel', city_slug: 'basel', host_iso: 'CH',
      semi1_date: '2025-05-13', semi2_date: '2025-05-15', final_date: '2025-05-17', indexable: false,
    };
    h.countries = [
      { iso: 'AT', name_en: 'Austria' },
      { iso: 'CH', name_en: 'Switzerland' },
    ];
  });

  const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

  it('loads the contest into the form, with the indexable note', async () => {
    render(<ContestDetailsForm year={2025} />);
    expect(await screen.findByDisplayValue('Basel')).toBeTruthy();
    expect(field('Slug πόλης').value).toBe('basel');
    expect((screen.getByLabelText('Διοργάνωση') as HTMLSelectElement).value).toBe('CH');
    expect(field('Ημιτελικός 1').value).toBe('2025-05-13');
    expect(field('Ημιτελικός 2').value).toBe('2025-05-15');
    expect(field('Τελικός').value).toBe('2025-05-17');
    expect(field('Ορατό στις μηχανές αναζήτησης').checked).toBe(false);
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('locks the city slug of an archived year, with a hint (I3)', async () => {
    h.contest = { ...h.contest, stage: 'archived' };
    render(<ContestDetailsForm year={2025} />);
    await screen.findByDisplayValue('Basel');
    expect(field('Slug πόλης').disabled).toBe(true);
    expect(screen.getByText(/δεν αλλάζει αφού η χρονιά αρχειοθετηθεί/)).toBeTruthy();
    // Other fields stay editable.
    expect(field('Πόλη').disabled).toBe(false);
  });

  it('leaves the city slug editable before the year is archived', async () => {
    h.contest = { ...h.contest, stage: 'finalized' };
    render(<ContestDetailsForm year={2025} />);
    await screen.findByDisplayValue('Basel');
    expect(field('Slug πόλης').disabled).toBe(false);
    expect(screen.queryByText(/δεν αλλάζει αφού η χρονιά αρχειοθετηθεί/)).toBeNull();
  });

  it('saves only the changed fields through update_contest, then calls onSaved', async () => {
    const onSaved = vi.fn();
    render(<ContestDetailsForm year={2025} onSaved={onSaved} />);
    await screen.findByDisplayValue('Basel');
    fireEvent.change(field('Πόλη'), { target: { value: 'Basel-Stadt' } });
    fireEvent.change(field('Slug πόλης'), { target: { value: 'basel-stadt' } });
    fireEvent.change(screen.getByLabelText('Διοργάνωση'), { target: { value: 'AT' } });
    fireEvent.change(field('Ημιτελικός 2'), { target: { value: '' } });
    fireEvent.click(field('Ορατό στις μηχανές αναζήτησης'));
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('update_contest', {
        p_year: 2025,
        p_fields: { city: 'Basel-Stadt', city_slug: 'basel-stadt', host_iso: 'AT', semi2_date: null, indexable: true },
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await screen.findByText('Το 2025 αποθηκεύτηκε. Κάντε «Δημοσίευση» για να φανεί στο site.')).toBeTruthy();
  });

  it('an edit back to the original value is not sent', async () => {
    render(<ContestDetailsForm year={2025} />);
    await screen.findByDisplayValue('Basel');
    fireEvent.change(field('Πόλη'), { target: { value: 'Zurich' } });
    fireEvent.change(field('Πόλη'), { target: { value: 'Basel' } });
    expect((screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(field('Ορατό στις μηχανές αναζήτησης'));
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('update_contest', { p_year: 2025, p_fields: { indexable: true } }),
    );
  });

  it('a host can be cleared to none', async () => {
    render(<ContestDetailsForm year={2025} />);
    await screen.findByDisplayValue('Basel');
    fireEvent.change(screen.getByLabelText('Διοργάνωση'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('update_contest', { p_year: 2025, p_fields: { host_iso: null } }),
    );
  });

  it('refuses a malformed city slug or an empty city without calling the RPC', async () => {
    render(<ContestDetailsForm year={2025} />);
    await screen.findByDisplayValue('Basel');
    fireEvent.change(field('Slug πόλης'), { target: { value: 'Basel 2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }));
    expect(
      await screen.findByText('Slug πόλης: πεζά λατινικά a-z, λέξεις ενωμένες με μία παύλα (π.χ. "tel-aviv").'),
    ).toBeTruthy();
    fireEvent.change(field('Slug πόλης'), { target: { value: 'basel' } });
    fireEvent.change(field('Πόλη'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }));
    expect(await screen.findByText('Η πόλη είναι υποχρεωτική.')).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalledWith('update_contest', expect.anything());
  });

  it('shows RPC errors through formatError', async () => {
    h.rpcError = { message: 'new row for relation "contests" violates check constraint', code: '23514' };
    render(<ContestDetailsForm year={2025} />);
    await screen.findByDisplayValue('Basel');
    fireEvent.change(field('Πόλη'), { target: { value: 'Bern' } });
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση στοιχείων' }));
    expect(
      await screen.findByText('new row for relation "contests" violates check constraint · (23514)'),
    ).toBeTruthy();
  });
});
