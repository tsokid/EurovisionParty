import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

type ConfettiVariant = 'correct' | 'win' | 'champion';

interface ConfettiOverlayProps {
  trigger: boolean;
  variant?: ConfettiVariant;
}

function fireCorrect() {
  confetti({
    particleCount: 40,
    spread: 55,
    origin: { y: 0.6 },
    colors: ['#fbbf24', '#fde68a', '#f59e0b'],
  });
}

function fireWin() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.5 },
    colors: ['#6b21a8', '#a855f7', '#ec4899', '#f9a8d4'],
  });
}

function fireChampion() {
  const duration = 3000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#6b21a8', '#ec4899', '#fbbf24', '#22d3ee'],
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#6b21a8', '#ec4899', '#fbbf24', '#22d3ee'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
}

const variantFn: Record<ConfettiVariant, () => void> = {
  correct: fireCorrect,
  win: fireWin,
  champion: fireChampion,
};

export default function ConfettiOverlay({ trigger, variant = 'correct' }: ConfettiOverlayProps) {
  const prevTrigger = useRef(false);

  useEffect(() => {
    if (trigger && !prevTrigger.current) {
      variantFn[variant]();
    }
    prevTrigger.current = trigger;
  }, [trigger, variant]);

  return null;
}
