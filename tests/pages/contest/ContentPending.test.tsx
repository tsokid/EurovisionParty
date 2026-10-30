import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentPending } from '@/pages/contest/ContentPending';

describe('ContentPending', () => {
  it('shows a loading status', () => {
    render(<ContentPending locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('the error state has a Try again button that retries', () => {
    const retry = vi.fn();
    render(<ContentPending locale="en" retry={retry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('is Greek in el', () => {
    render(<ContentPending locale="el" retry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Δοκίμασε ξανά' })).toBeInTheDocument();
    // Same informal register as the button.
    expect(screen.getByRole('alert')).toHaveTextContent('Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.');
  });
});
