import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider, useLocale } from '@/lib/seo/LocaleContext';

function Probe() {
  const locale = useLocale();
  return <span data-testid="locale">{locale}</span>;
}

describe('LocaleProvider', () => {
  it('exposes locale via hook', () => {
    render(
      <LocaleProvider locale="el">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('el');
  });

  it('falls back to a valid Locale outside provider (does not throw)', () => {
    // useLocale used to throw outside a Provider, which crashed
    // /room/:code and /admin where there's no LocaleRoot. New behaviour:
    // fall back to i18next current language ('en' or 'el'), never throw.
    expect(() => render(<Probe />)).not.toThrow();
    const value = screen.getByTestId('locale').textContent;
    expect(value === 'en' || value === 'el').toBe(true);
  });
});
