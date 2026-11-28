// The admin menu opens and closes by section (28 Nov 2026): only the section
// of the open screen starts open, and the owner's choice is remembered.
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSidebar from '../../src/admin/AdminSidebar';

const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><AdminSidebar /></MemoryRouter>);

describe('admin menu sections', () => {
  beforeEach(() => { localStorage.clear(); cleanup(); });

  it('only the section of the open screen starts open', () => {
    renderAt('/admin/game/questions');
    expect(screen.getByRole('button', { name: 'Παιχνίδι' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Ερωτήσεις' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ιστότοπος' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /Κεφαλίδα/ })).toBeNull();
  });

  it('a section and the Pages list open and close, and stay so after a reload', () => {
    renderAt('/admin/pages');
    const pages = screen.getByRole('button', { name: 'Σελίδες' });
    expect(pages).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(pages);
    expect(pages).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Ρυθμίσεις' }));
    expect(screen.getByRole('link', { name: /Διαχειριστές/ })).toBeTruthy();

    cleanup();
    renderAt('/admin/pages');
    expect(screen.getByRole('button', { name: 'Σελίδες' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Ρυθμίσεις' })).toHaveAttribute('aria-expanded', 'true');
  });
});
