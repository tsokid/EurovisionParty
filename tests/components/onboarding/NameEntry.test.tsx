import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from '../../../src/i18n';
import NameEntry from '../../../src/components/onboarding/NameEntry';
import { AVATAR_IDS, AVATARS } from '../../../src/components/stage/avatars';

beforeAll(async () => {
  await i18n.changeLanguage('el');
});

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
const submitBtn = () => screen.getByRole('button', { name: /Πάμε/ });
const PASSWORD = /Κωδικός Πρόσβασης/;

describe('<NameEntry>', () => {
  it('shows the Stage identity labels, the secret hint and a preselected avatar', () => {
    render(<NameEntry mode="create" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Καλλιτεχνικό όνομα')).toBeInTheDocument();
    expect(screen.getByLabelText('Πραγματικό όνομα')).toBeInTheDocument();
    expect(screen.getByText('Μένει μυστικό μέχρι το τέλος. Θα αποκαλυφθεί στο «Ποιος ήταν ποιος;»')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(AVATARS.length);
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('requires stage name, real name and a 6+ character password', () => {
    const onSubmit = vi.fn();
    render(<NameEntry mode="create" onSubmit={onSubmit} />);
    expect(submitBtn()).toBeDisabled();
    fill('Καλλιτεχνικό όνομα', 'Ντίσκο Μπάλα');
    fill(PASSWORD, 'secret1');
    expect(submitBtn()).toBeDisabled(); // no real name yet
    fill('Πραγματικό όνομα', 'Νίκη');
    expect(submitBtn()).toBeEnabled();
    fill(PASSWORD, '12345');
    expect(submitBtn()).toBeDisabled();
    fill(PASSWORD, '123456');
    fill('Καλλιτεχνικό όνομα', 'Χ');
    expect(submitBtn()).toBeDisabled();
    fireEvent.submit(submitBtn().closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags a blocked real name', () => {
    render(<NameEntry mode="create" onSubmit={vi.fn()} />);
    fill('Πραγματικό όνομα', 'fuck');
    expect(screen.getByText('Διάλεξε κάτι άλλο')).toBeInTheDocument();
    expect(screen.getByLabelText('Πραγματικό όνομα')).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits { name, realName, avatarId, emoji, password } on create', () => {
    const onSubmit = vi.fn();
    render(<NameEntry mode="create" onSubmit={onSubmit} />);
    fill('Καλλιτεχνικό όνομα', '  Ντίσκο Μπάλα ');
    fill('Πραγματικό όνομα', ' Νίκη Π. ');
    fill(PASSWORD, 'secret1');
    fireEvent.click(screen.getByRole('radio', { name: AVATARS[4].title.el }));
    fireEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Ντίσκο Μπάλα',
      realName: 'Νίκη Π.',
      avatarId: AVATARS[4].id,
      emoji: '🎤',
      password: 'secret1',
    });
  });

  it('join mode needs the room code and sends it upper-cased', () => {
    const onSubmit = vi.fn();
    render(<NameEntry mode="join" onSubmit={onSubmit} />);
    fill('Καλλιτεχνικό όνομα', 'Πούλια');
    fill('Πραγματικό όνομα', 'Άλεξ');
    fill(PASSWORD, 'secret1');
    expect(submitBtn()).toBeDisabled();
    fill('Κωδικός Δωματίου', 'abcd');
    fireEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const data = onSubmit.mock.calls[0][0];
    expect(data).toMatchObject({ name: 'Πούλια', realName: 'Άλεξ', roomCode: 'ABCD', password: 'secret1' });
    expect(AVATAR_IDS).toContain(data.avatarId);
  });

  it('«Τυχαίο» picks another avatar', () => {
    render(<NameEntry mode="create" onSubmit={vi.fn()} />);
    const checked = () => screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')!.getAttribute('data-id');
    const before = checked();
    fireEvent.click(screen.getByRole('button', { name: 'Τυχαίο' }));
    expect(checked()).not.toBe(before);
  });

  it('keeps back, error and loading behaviour', () => {
    const onBack = vi.fn();
    const { rerender } = render(<NameEntry mode="create" onSubmit={vi.fn()} onBack={onBack} error="Room is full." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Room is full.');
    fireEvent.click(screen.getByRole('button', { name: 'Πίσω' }));
    expect(onBack).toHaveBeenCalled();
    rerender(<NameEntry mode="create" onSubmit={vi.fn()} isLoading />);
    expect(submitBtn()).toBeDisabled();
  });

  it('after a failed real-name save, the button retries only that', () => {
    const onRetry = vi.fn();
    const onSubmit = vi.fn();
    render(<NameEntry mode="create" onSubmit={onSubmit} onRetrySecret={onRetry} error="x" />);
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση ξανά' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Πίσω' })).toBeNull();
  });
});
