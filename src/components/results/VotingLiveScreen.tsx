// src/components/results/VotingLiveScreen.tsx
// Player-facing screen during the voting_live phase.
// Eurovision is broadcasting points right now; predictions are
// already locked. Players just wait for finalization.

import { motion } from 'framer-motion';
import { Radio, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ScreenContainer from '../layout/ScreenContainer';
import Card from '../ui/Card';

export default function VotingLiveScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <Card className="py-7 sm:py-9 text-center">
          {/* Pulsing live dot */}
          <div className="flex justify-center mb-4">
            <motion.div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-euro-pink to-euro-purple flex items-center justify-center shadow-[0_0_40px_rgba(236,72,153,0.55)]"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            >
              <Radio className="w-10 h-10 text-white" strokeWidth={2.4} />
            </motion.div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-euro-pink/15 border border-euro-pink/40 px-3 py-1 text-xs sm:text-sm font-bold tracking-[0.18em] text-euro-pink">
            <span className="w-1.5 h-1.5 rounded-full bg-euro-pink animate-pulse" aria-hidden />
            {t('voting.livePill', { defaultValue: 'VOTING LIVE' })}
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold mt-3 text-white">
            {t('voting.heading', { defaultValue: 'Eurovision is voting…' })}
          </h2>
          <p className="text-sm sm:text-base text-white/65 mt-2 max-w-md mx-auto">
            {t('voting.body', {
              defaultValue:
                'Predictions are locked. Sit tight while the jury and televote points come in. Final results land here as soon as scoring wraps.',
            })}
          </p>
        </Card>

        <Card className="py-4 px-4 text-center">
          <Sparkles className="w-5 h-5 mx-auto text-euro-gold mb-2" strokeWidth={2.4} />
          <p className="text-sm sm:text-base text-white/75">
            {t('voting.footer', {
              defaultValue: "Watch the show. We'll show you who won, who got it right, and your final score.",
            })}
          </p>
        </Card>
      </motion.div>
    </ScreenContainer>
  );
}
