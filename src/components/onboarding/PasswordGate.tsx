import { type FormEvent, type ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GATE_KEY = 'europarty-unlocked';
const CORRECT = 'dumtektek';

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try { return localStorage.getItem(GATE_KEY) === '1'; } catch { return false; }
  });
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);

  if (isUnlocked) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim().toLowerCase() === CORRECT) {
      try { localStorage.setItem(GATE_KEY, '1'); } catch { /* ignore */ }
      setIsUnlocked(true);
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="min-h-svh bg-euro-gradient flex items-center justify-center px-4">
      {/* Floating sparkles */}
      {[
        { top: '10%', left: '8%', delay: 0, size: 20, color: 'rgba(249,168,212,0.8)' },
        { top: '15%', right: '10%', delay: 0.5, size: 14, color: 'rgba(253,230,138,0.8)' },
        { bottom: '20%', left: '5%', delay: 1, size: 18, color: 'rgba(168,85,247,0.8)' },
        { bottom: '25%', right: '7%', delay: 0.3, size: 16, color: 'rgba(34,211,238,0.75)' },
      ].map((s, i) => (
        <motion.span
          key={i}
          className="absolute pointer-events-none select-none"
          style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 3, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        >
          <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2L13.6 9.4L21 11L13.6 12.6L12 20L10.4 12.6L3 11L10.4 9.4Z" fill={s.color} />
          </svg>
        </motion.span>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎤</div>
          <h1 className="text-2xl font-extrabold text-white">Eurovision Games</h1>
          <p className="text-white/50 text-sm mt-1">Enter the access password to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            <motion.div
              key={shake ? 'shake' : 'still'}
              animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Password"
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl bg-white/[0.07] border border-white/15 text-white placeholder-white/30 text-base font-medium focus:outline-none focus:border-euro-purple-light focus:bg-white/[0.10] transition"
              />
            </motion.div>
          </AnimatePresence>

          {shake && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm text-center mt-2"
            >
              Wrong password
            </motion.p>
          )}

          <button
            type="submit"
            className="mt-4 w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-euro-purple-light to-euro-pink hover:brightness-110 transition text-base"
          >
            Enter
          </button>
        </form>
      </motion.div>
    </div>
  );
}
