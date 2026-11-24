// Back to top on long public pages (owner, 24 Nov 2026): hidden on short pages
// and near the top, shown after 1.2 screens on pages at least 3 screens tall.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../src/i18n';
import BackToTop, { shouldShowBackToTop } from '../../../src/components/seo/BackToTop';

beforeAll(async () => { await i18n.changeLanguage('el'); });

function setPage(scrollY: number, viewport: number, height: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewport });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: height });
}

afterEach(() => { vi.restoreAllMocks(); });

describe('shouldShowBackToTop', () => {
  it('stays hidden on short pages, even scrolled down', () => {
    expect(shouldShowBackToTop(1500, 800, 2000)).toBe(false);
  });
  it('stays hidden near the top of a long page', () => {
    expect(shouldShowBackToTop(900, 800, 6000)).toBe(false);
  });
  it('shows after 1.2 screens on a page 3+ screens tall', () => {
    expect(shouldShowBackToTop(960, 800, 2400)).toBe(true);
  });
});

describe('<BackToTop />', () => {
  it('renders nothing at load, appears on scroll, and scrolls to the top', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 1; });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setPage(0, 800, 6000);
    render(<BackToTop />);
    expect(screen.queryByRole('button')).toBeNull();

    setPage(2000, 800, 6000);
    act(() => { window.dispatchEvent(new Event('scroll')); });
    const btn = screen.getByRole('button', { name: 'Επιστροφή στην αρχή' });
    fireEvent.click(btn);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });
});
