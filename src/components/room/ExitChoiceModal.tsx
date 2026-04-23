import { useTranslation } from 'react-i18next';

interface ExitChoiceModalProps {
  onVisitOtherRooms: () => void;
  onExitGame: () => void;
  onCancel: () => void;
}

export default function ExitChoiceModal({
  onVisitOtherRooms,
  onExitGame,
  onCancel,
}: ExitChoiceModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 pb-6 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-gradient-to-b from-[#1e0e3e] to-[#130828] border border-white/12 rounded-3xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-white/15 rounded-full mx-auto mb-5" />

        <h2 className="text-base font-black text-white text-center mb-1">
          {t('exitStrip.title', { defaultValue: 'Leave this room?' })}
        </h2>
        <p className="text-[12px] text-white/40 text-center mb-5">
          {t('exitStrip.subtitle', { defaultValue: 'Your progress is always saved.' })}
        </p>

        {/* Visit Other Rooms */}
        <button
          onClick={onVisitOtherRooms}
          className="w-full flex items-center gap-3 p-4 rounded-2xl mb-3
            bg-yellow-400/10 border border-yellow-400/25 active:scale-[0.98] transition-transform"
        >
          <span className="text-2xl">💤</span>
          <div className="text-left">
            <p className="text-sm font-bold text-yellow-400">
              {t('exitStrip.visitOtherRooms', { defaultValue: 'Visit Other Rooms' })}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {t('exitStrip.visitDesc', { defaultValue: 'Step away — rejoin any time from home' })}
            </p>
          </div>
        </button>

        {/* Exit Game */}
        <button
          onClick={onExitGame}
          className="w-full flex items-center gap-3 p-4 rounded-2xl mb-3
            bg-red-500/8 border border-red-500/20 active:scale-[0.98] transition-transform"
        >
          <span className="text-2xl">🚪</span>
          <div className="text-left">
            <p className="text-sm font-bold text-red-400">
              {t('exitStrip.exitGame', { defaultValue: 'Exit Game' })}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {t('exitStrip.exitDesc', { defaultValue: '2-hour window to recover your points' })}
            </p>
          </div>
        </button>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-2xl bg-white/5 border border-white/10
            text-white/40 text-[13px] font-semibold active:scale-[0.98] transition-transform"
        >
          {t('exitModal.cancel', { defaultValue: 'Cancel — Stay in Room' })}
        </button>
      </div>
    </div>
  );
}
