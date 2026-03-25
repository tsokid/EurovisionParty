import { motion } from 'framer-motion';
import { useThemeStore } from '../../stores/themeStore';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-8 rounded-full bg-white/10 border border-white/15 flex items-center px-1 cursor-pointer active:scale-95 transition-transform"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.div
        className="w-6 h-6 rounded-full flex items-center justify-center text-sm"
        animate={{ x: isDark ? 0 : 22 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #6b21a8, #ec4899)'
            : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        }}
      >
        {isDark ? '🌙' : '☀️'}
      </motion.div>
    </button>
  );
}
