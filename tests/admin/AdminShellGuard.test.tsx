import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));

// Two stand-in modules: "Editor" can be made dirty, "Other" is plain.
vi.mock('../../src/admin/modules', async () => {
  const { useUnsavedGuard } = await import('../../src/admin/unsavedGuard');
  function Editor() {
    const [dirty, setDirty] = useState(false);
    useUnsavedGuard(dirty);
    return (
      <label>
        Dirty
        <input type="checkbox" checked={dirty} onChange={(e) => setDirty(e.target.checked)} />
      </label>
    );
  }
  const Other = () => <p>Other module</p>;
  return {
    MODULES: [
      { id: 'editor', label: 'Editor', emoji: 'E', Component: Editor },
      { id: 'other', label: 'Other', emoji: 'O', Component: Other },
    ],
  };
});

import AdminShell from '../../src/admin/AdminShell';
import { UNSAVED_TEXT } from '../../src/admin/unsavedGuard';
import type { AdminAuth } from '../../src/admin/useAdminAuth';

const auth = { email: 'a@b.c', logout: vi.fn(), status: 'authenticated' } as unknown as AdminAuth;

const beforeUnload = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminShell unsaved-edits guard', () => {
  it('switches modules freely while nothing is dirty', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<AdminShell auth={auth} />);
    fireEvent.click(screen.getByRole('button', { name: /Other/ }));
    expect(screen.getByText('Other module')).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before leaving a dirty module, and stays when cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminShell auth={auth} />);
    fireEvent.click(screen.getByLabelText('Dirty'));
    fireEvent.click(screen.getByRole('button', { name: /Other/ }));
    expect(confirm).toHaveBeenCalledWith(UNSAVED_TEXT);
    expect(screen.queryByText('Other module')).toBeNull();
    expect((screen.getByLabelText('Dirty') as HTMLInputElement).checked).toBe(true);
  });

  it('leaves when confirmed, and the guard is released with the module', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminShell auth={auth} />);
    fireEvent.click(screen.getByLabelText('Dirty'));
    fireEvent.click(screen.getByRole('button', { name: /Other/ }));
    expect(screen.getByText('Other module')).toBeTruthy();
    expect(beforeUnload()).toBe(false);
    confirm.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Editor/ }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('sign out asks too', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminShell auth={auth} />);
    fireEvent.click(screen.getByLabelText('Dirty'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('blocks a page unload only while dirty', () => {
    render(<AdminShell auth={auth} />);
    expect(beforeUnload()).toBe(false);
    fireEvent.click(screen.getByLabelText('Dirty'));
    expect(beforeUnload()).toBe(true);
    fireEvent.click(screen.getByLabelText('Dirty'));
    expect(beforeUnload()).toBe(false);
  });
});
