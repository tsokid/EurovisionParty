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

  it('throws if useLocale outside provider', () => {
    expect(() => render(<Probe />)).toThrow();
  });
});
