import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../src/hooks/useInvite', () => ({
  useInvite: () => ({ code: 'ABC123', shareInvite: vi.fn(), copyCode: vi.fn(), codeCopied: false }),
}));
vi.mock('../../../src/components/layout/BottomNav', () => ({ default: () => null }));

import GameRail from '../../../src/components/layout/GameRail';

describe('GameRail logo', () => {
  it('shows the text wordmark (owner option A), not the image logo, and is not a link out of the game', () => {
    const { container } = render(<MemoryRouter><GameRail phase="lobby" /></MemoryRouter>);
    expect(container.querySelector('img[src="/logo.png"]')).toBeNull();
    const logo = screen.getByRole('img', { name: 'eurovision.games' });
    expect(logo.closest('a')).toBeNull();
    expect(logo.textContent).toBe('eurovision.games');
    expect(logo.querySelector('.wordmark-grad')?.textContent).toBe('vision');
  });
});
