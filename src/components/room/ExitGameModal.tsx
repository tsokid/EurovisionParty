import { useTranslation } from 'react-i18next';

interface ExitGameModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ExitGameModal({ onConfirm, onCancel }: ExitGameModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 pb-6 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-gradient-to-b from-[#1e0e3e] to-[#130828] border border-red-500/25 rounded-3xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-white/15 rounded-full mx-auto mb-5" />
        <div className="text-4xl text-center mb-3">🚪</div>
        <h2 className="text-lg font-black text-white text-center mb-2">
          {t('exitModal.title')}
        </h2>
        <p className="text-[13px] text-white/55 text-center leading-relaxed mb-5">
          {t('exitModal.body')}
        </p>
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 mb-5 space-y-2">
          <p className="text-[12px] text-white/50">❌ {t('exitModal.warn1')}</p>
          <p className="text-[12px] text-white/50">❌ {t('exitModal.warn2')}</p>
          <p className="text-[12px] text-white/50">❌ {t('exitModal.warn3')}</p>
        </div>
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white font-extrabold text-sm mb-2 shadow-[0_4px_20px_rgba(220,38,38,0.35)]"
        >
          {t('exitModal.confirm')}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-2xl bg-white/6 border border-white/10 text-white/55 font-bold text-[13px]"
        >
          {t('exitModal.cancel')}
        </button>
      </div>
    </div>
  );
}
