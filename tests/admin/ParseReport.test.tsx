import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../src/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.then = (f: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(f);
  return { supabase: { from: () => chain } };
});

import { ParseReport } from '../../src/admin/modules/parser/ParseReport';
import type { ParseRun } from '../../src/admin/modules/parser/useParserState';

const URL = 'https://www.eurovision.com/eurovision-song-contest/burgas-2027/burgas-2027-grand-final/';
const run = (id: string, rows: ParseRun['rows'], status: ParseRun['status'] = 'ok', error: string | null = null): ParseRun => ({
  id, kind: 'participants', year: 2027, finished_at: '2027-05-13T21:00:00Z', http_status: 200,
  status, rows_upserted: rows?.length ?? 0, error, rows, source_url: URL,
});

describe('ParseReport', () => {
  it('lists every country with artist and song, the diff and the warnings', () => {
    const prev = run('a', [{ iso: 'GR', name: 'Greece', artist: 'Old', song: 'S' }, { iso: 'CY', name: 'Cyprus', artist: 'C', song: 'D' }]);
    const last = run('b', [{ iso: 'GR', name: 'Greece', artist: 'New', song: 'S' }, { iso: 'SE', name: 'Sweden', artist: '', song: 'T' }],
      'blocked', '2 countries parsed; a grand final has 20-27 (line-up not final yet?)');
    render(<ParseReport kind="participants" year={2027} runs={[last, prev]} />);

    expect(screen.getByText(/Parse report · 2 countries/)).toBeTruthy();
    expect(screen.getByText(/not written \(blocked\)/)).toBeTruthy();
    expect(screen.getByText(/Blocked: 2 countries parsed/)).toBeTruthy();
    expect(screen.getByText(/No artist or song: SE\./)).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('missing')).toBeTruthy();
    expect(screen.getByText(/\(SE\)/)).toBeTruthy(); // added
    expect(screen.getByText(/\(CY\)/)).toBeTruthy(); // removed
  });

  it('renders nothing for runs logged before 080 (no rows)', () => {
    const { container } = render(<ParseReport kind="participants" year={2027} runs={[run('x', null)]} />);
    expect(container.innerHTML).toBe('');
  });
});
