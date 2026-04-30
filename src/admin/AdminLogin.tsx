import { useEffect, useRef, useState } from 'react';
import type { AdminAuth } from './useAdminAuth';

interface Props {
  auth: AdminAuth;
}

export default function AdminLogin({ auth }: Props) {
  const { status, sendOtp, verifyOtp, error } = auth;
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const token = digits.join('');
  const showOtp = status === 'pending_otp';
  const denied = status === 'denied';

  // Focus first OTP box when it appears
  useEffect(() => {
    if (showOtp) inputs.current[0]?.focus();
  }, [showOtp]);

  async function send() {
    if (!email || cooldown > 0 || sending) return;
    setSending(true);
    await sendOtp(email);
    setSending(false);
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function verify() {
    if (token.length !== 6 || verifying) return;
    setVerifying(true);
    await verifyOtp(email, token);
    setVerifying(false);
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, '').slice(0, 1);
    setDigits((d) => {
      const next = [...d];
      next[i] = clean;
      return next;
    });
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === 'Enter' && token.length === 6) verify();
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-[rgb(10,5,25)] text-white p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 30% 20%, rgba(236,72,153,0.18), transparent 60%), radial-gradient(ellipse 50% 35% at 75% 80%, rgba(124,58,237,0.18), transparent 60%)',
        }}
      />

      <div className="w-full max-w-md relative">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-7 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-euro-purple-light to-euro-pink grid place-items-center text-lg" aria-hidden>
              🛡️
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Admin access</h1>
              <p className="text-xs text-white/50">Restricted area · sign in with email code</p>
            </div>
          </div>

          {!showOtp && (
            <div className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="text-xs text-white/50 uppercase tracking-wider font-semibold block mb-1.5">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 focus:border-euro-pink/60 focus:bg-white/[0.07] rounded-lg px-3.5 py-2.5 text-white placeholder:text-white/30 outline-none transition"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <button
                onClick={send}
                disabled={!email || cooldown > 0 || sending}
                className="w-full bg-gradient-to-r from-euro-purple-light to-euro-pink text-white rounded-lg py-2.5 font-bold disabled:opacity-40 hover:brightness-110 transition shadow-lg shadow-euro-pink/20"
              >
                {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send 6-digit code'}
              </button>
              <p className="text-xs text-white/40 leading-relaxed">
                If your email isn't on the allowlist, no code is sent — but the response looks the same to keep the list private.
              </p>
            </div>
          )}

          {showOtp && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-white/70">
                  We sent a 6-digit code to{' '}
                  <span className="text-white font-semibold">{email}</span>.
                </p>
                <p className="text-xs text-white/40 mt-1">Check your inbox (and spam). Code expires in 60 minutes.</p>
              </div>

              <div className="flex gap-2 justify-between" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKey(e, i)}
                    className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold bg-white/5 border border-white/15 focus:border-euro-pink focus:bg-white/[0.08] rounded-lg outline-none transition"
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={verify}
                disabled={token.length !== 6 || verifying}
                className="w-full bg-gradient-to-r from-euro-purple-light to-euro-pink text-white rounded-lg py-2.5 font-bold disabled:opacity-40 hover:brightness-110 transition shadow-lg shadow-euro-pink/20"
              >
                {verifying ? 'Verifying…' : 'Verify and sign in'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => { setDigits(['', '', '', '', '', '']); }}
                  className="text-white/50 hover:text-white/80 transition"
                >
                  Clear code
                </button>
                <button
                  onClick={send}
                  disabled={cooldown > 0 || sending}
                  className="text-euro-pink-light hover:text-euro-pink disabled:text-white/30 disabled:cursor-not-allowed transition font-semibold"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          {error && !denied && (
            <p className="mt-4 text-red-400 text-sm">Invalid or expired code. Try again or resend.</p>
          )}
          {denied && (
            <p className="mt-4 text-red-400 text-sm">
              Your email isn't authorized for admin access.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-4">
          eurovision.games · admin
        </p>
      </div>
    </div>
  );
}
