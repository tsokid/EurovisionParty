import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isGreek = i18n.language === 'el';

  return (
    <button
      onClick={() => i18n.changeLanguage(isGreek ? 'en' : 'el')}
      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full active:scale-95 transition-transform"
      aria-label={isGreek ? 'Switch to English' : 'Αλλαγή σε Ελληνικά'}
    >
      <span className="text-sm font-bold">{isGreek ? 'EN' : 'ΕΛ'}</span>
    </button>
  );
}
