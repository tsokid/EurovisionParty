// The admin overview shows the database size, read once (110).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const rpc = vi.fn(async () => ({ data: 37 * 1024 * 1024, error: null }));
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));

import DbSize from '../../src/admin/modules/overview/DbSize';

describe('DbSize', () => {
  it('reads the size once and shows it in MB with the limits', async () => {
    render(<DbSize />);
    expect(await screen.findByText('Τώρα: 37 MB')).toBeInTheDocument();
    expect(screen.getByText('Όριο: 500 MB στο Free, 8 GB στο Pro.')).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_db_size');
  });
});
