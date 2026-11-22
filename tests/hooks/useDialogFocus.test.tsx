// useDialogFocus: Tab stays inside the innermost open dialog, and focus goes
// back to the opener when the dialog closes. Also covers the shared Modal.
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useDialogFocus } from '../../src/hooks/useDialogFocus';
import Modal from '../../src/components/ui/Modal';

function tab(shift = false) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift });
}

function Dialog({ name, onClose, children }: { name: string; onClose: () => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  // Like the real dialogs: initial focus is moved in an effect (after the
  // hook has recorded the opener).
  useEffect(() => { ref.current?.querySelector<HTMLElement>('button')?.focus(); }, []);
  return (
    <div ref={ref} role="dialog" aria-label={name}>
      <button type="button">{name} first</button>
      <button type="button">{name} middle</button>
      <button type="button" onClick={onClose}>{name} close</button>
      {children}
    </div>
  );
}

function Page() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuter(true)}>open</button>
      <button type="button">behind</button>
      {outer && (
        <Dialog name="outer" onClose={() => setOuter(false)}>
          <button type="button" onClick={() => setInner(true)}>open inner</button>
        </Dialog>
      )}
      {inner && <Dialog name="inner" onClose={() => setInner(false)} />}
    </>
  );
}

describe('useDialogFocus', () => {
  it('cycles Tab and Shift+Tab inside the dialog and never reaches the page behind', () => {
    render(<Page />);
    const opener = screen.getByText('open');
    opener.focus();
    fireEvent.click(opener);

    const first = screen.getByText('outer first');
    const last = screen.getByText('open inner');
    first.focus();

    // Shift+Tab on the first wraps to the last.
    tab(true);
    expect(document.activeElement).toBe(last);
    // Tab on the last wraps to the first.
    tab();
    expect(document.activeElement).toBe(first);

    // Focus that escaped to the page is pulled back in on Tab.
    screen.getByText('behind').focus();
    tab();
    expect(document.activeElement).toBe(first);
  });

  it('only the innermost dialog traps, and each close returns focus to its opener', async () => {
    render(<Page />);
    const opener = screen.getByText('open');
    opener.focus();
    fireEvent.click(opener);

    const openInner = screen.getByText('open inner');
    openInner.focus();
    fireEvent.click(openInner);

    const innerFirst = screen.getByText('inner first');
    const innerLast = screen.getByText('inner close');
    innerLast.focus();
    tab();
    expect(document.activeElement).toBe(innerFirst);

    // Close inner → focus back on "open inner"; the outer dialog traps again.
    fireEvent.click(innerLast);
    await waitFor(() => expect(document.activeElement).toBe(openInner));
    tab();
    expect(document.activeElement).toBe(screen.getByText('outer first'));

    // Close outer → focus back on the page's opener.
    fireEvent.click(screen.getByText('outer close'));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe('Modal', () => {
  it('is a labelled dialog that takes focus, traps Tab and closes on Escape', async () => {
    const onClose = vi.fn();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>trigger</button>
          <Modal open={open} onClose={() => { onClose(); setOpen(false); }} label="Challenge">
            <button type="button">one</button>
            <button type="button">two</button>
          </Modal>
        </>
      );
    }
    render(<Host />);
    const trigger = screen.getByText('trigger');
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Challenge' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByText('one'));

    screen.getByText('two').focus();
    tab();
    expect(document.activeElement).toBe(screen.getByText('one'));

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // The close commits after the native keydown; the exit animation then runs.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
