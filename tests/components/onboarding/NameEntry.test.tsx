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
    expect(screen.getByText('Αρκεί το μικρό σου ή όπως σε ξέρει η παρέα. Μένει μυστικό μέχρι το τέλος και αποκαλύπτεται στο «Ποιος ήταν ποιος;»')).toBeInTheDocument();
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

  describe('join from the lobby QR', () => {
    const qr = (extra: Partial<React.ComponentProps<typeof NameEntry>> = {}) => (
      <NameEntry mode="join" onSubmit={vi.fn()} initialRoomCode="abcd" qrPassword="from-qr 1" {...extra} />
    );

    it('locks the room code, hides the password and says it came from the QR', () => {
      render(qr());
      expect(screen.getByTestId('qr-room')).toHaveTextContent('ΔωμάτιοABCD');
      expect(screen.queryByLabelText('Κωδικός Δωματίου')).toBeNull();
      expect(screen.queryByLabelText(PASSWORD)).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('Ο κωδικός πρόσβασης συμπληρώθηκε από το QR');
      expect(screen.getByRole('button', { name: 'Αλλαγή' })).toBeInTheDocument();
    });

    it('needs only avatar, stage name and real name, then submits the QR password', () => {
      const onSubmit = vi.fn();
      render(qr({ onSubmit }));
      expect(submitBtn()).toBeDisabled();
      fill('Καλλιτεχνικό όνομα', 'Πούλια');
      fill('Πραγματικό όνομα', 'Άλεξ');
      fireEvent.click(submitBtn());
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ roomCode: 'ABCD', password: 'from-qr 1', name: 'Πούλια', realName: 'Άλεξ' });
    });

    it('«Αλλαγή» reveals the password field, filled in', () => {
      render(qr());
      fireEvent.click(screen.getByRole('button', { name: 'Αλλαγή' }));
      const input = screen.getByLabelText(PASSWORD) as HTMLInputElement;
      expect(input.value).toBe('from-qr 1');
      expect(input).toHaveFocus();
      expect(screen.queryByText('Ο κωδικός πρόσβασης συμπληρώθηκε από το QR')).toBeNull();
    });

    it('a wrong password shows the error and reveals the field', () => {
      const { rerender } = render(qr());
      expect(screen.queryByLabelText(PASSWORD)).toBeNull();
      rerender(qr({ error: 'Wrong password. Try again.', passwordRejected: true }));
      expect(screen.getByRole('alert')).toHaveTextContent('Λάθος κωδικός. Δοκίμασε ξανά.'); // shown in the reader's language (095)
      expect(screen.getByLabelText(PASSWORD)).toBeInTheDocument();
      rerender(qr({ error: null, passwordRejected: false }));
      expect(screen.getByLabelText(PASSWORD)).toBeInTheDocument(); // stays open
    });

    it('without a QR password the join form is unchanged', () => {
      render(<NameEntry mode="join" onSubmit={vi.fn()} initialRoomCode="ABCD" />);
      expect((screen.getByLabelText('Κωδικός Δωματίου') as HTMLInputElement).value).toBe('ABCD');
      expect(screen.getByLabelText(PASSWORD)).toBeInTheDocument();
      expect(screen.queryByTestId('qr-room')).toBeNull();
    });
  });
});

// The form is a modal over the home page (24 Nov 2026): it closes only with
// ✕, Esc or «Πίσω»; a click on the backdrop keeps it, and what was typed.
describe('<NameEntry> as a modal', () => {
  it('✕ and Esc close it, the backdrop does not', () => {
    const onBack = vi.fn();
    render(<NameEntry mode="join" onSubmit={vi.fn()} onBack={onBack} initialRoomCode="ABCD" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const name = screen.getByLabelText('Καλλιτεχνικό όνομα') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Ντίσκο' } });
    fireEvent.click(screen.getByTestId('onb-backdrop'));
    expect(onBack).not.toHaveBeenCalled();
    expect(name.value).toBe('Ντίσκο');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Κλείσιμο' }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('locks the page behind while open and releases it on close', () => {
    const topbar = document.createElement('div');
    topbar.className = 'topbar';
    document.body.appendChild(topbar);
    const { unmount } = render(<NameEntry mode="create" onSubmit={vi.fn()} onBack={vi.fn()} />);
    expect(topbar.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(topbar.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    topbar.remove();
  });
});
