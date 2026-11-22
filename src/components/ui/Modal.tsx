import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { FOCUSABLE, isTopDialog, useDialogFocus } from '../../hooks/useDialogFocus';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible name of the dialog. */
  label?: string;
}

/**
 * Centred modal card. Accessible dialog: focus moves to its first control,
 * Tab stays inside, Escape and the overlay close it, focus returns to the
 * opener.
 */
export default function Modal({ open, onClose, children, label }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  useDialogFocus(boxRef, open);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  // Runs once per open, so a parent re-render never moves focus back.
  useEffect(() => {
    if (!open) return;
    const box = boxRef.current;
    (box?.querySelector<HTMLElement>(FOCUSABLE) ?? box)?.focus();
    const onKey = (e: KeyboardEvent) => {
      // A dialog opened from this one (the avatar viewer) handles its own Escape.
      if (e.key === 'Escape' && isTopDialog(boxRef)) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* overlay */}
          <motion.div
            className="absolute inset-0 bg-black/80"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* content — solid dark card, no transparency bleed */}
          <motion.div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="relative z-10 w-full max-w-sm rounded-2xl p-6 bg-[#1a0a2e] border border-white/12 shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
