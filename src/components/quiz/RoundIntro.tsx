import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MAX_ROUNDS, QUESTIONS_PER_ROUND } from '../../lib/constants';

interface RoundIntroProps {
  roundNumber: number;
  onDismiss: () => void;
  categoryHints?: string[];
}

const AUTO_DISMISS_MS = 3000;

export default function RoundIntro({
  roundNumber,
  onDismiss,
  categoryHints,
}: RoundIntroProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      // Small delay for exit animation
      setTimeout(onDismiss, 400);
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-euro-deep/90 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Decorative sparkles */}
          <motion.div
            className="text-4xl mb-4"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
          >
            {'\u2728'}
          </motion.div>

          {/* Round number */}
          <motion.h1
            className="glow-text text-5xl sm:text-6xl font-extrabold mb-2"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          >
            {t('roundIntro.round', { num: roundNumber })}
          </motion.h1>

          {/* Of N */}
          <motion.p
            className="text-euro-purple-light text-xl font-medium mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {t('roundIntro.ofMax', { max: MAX_ROUNDS })}
          </motion.p>

          {/* Question count */}
          <motion.div
            className="glass rounded-full px-6 py-2 mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span className="text-white font-semibold">
              {t('roundIntro.questions', { count: QUESTIONS_PER_ROUND })}
            </span>
          </motion.div>

          {/* Category hints */}
          {categoryHints && categoryHints.length > 0 && (
            <motion.div
              className="flex flex-wrap gap-2 justify-center max-w-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              {categoryHints.map((hint) => (
                <span
                  key={hint}
                  className="glass rounded-full px-3 py-1 text-sm text-euro-purple-light"
                >
                  {hint}
                </span>
              ))}
            </motion.div>
          )}

          {/* Tap to skip */}
          <motion.button
            className="mt-8 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors active:scale-95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            onClick={() => { setVisible(false); onDismiss(); }}
          >
            {t('roundIntro.tapStart')}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
