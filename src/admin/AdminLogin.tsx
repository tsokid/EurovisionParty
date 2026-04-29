import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth';

export default function AdminLogin() {
  const { status, sendOtp, verifyOtp, error } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [cooldown, setCooldown] = useState(0);

  async function send() {
    await sendOtp(email);
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-[rgb(10,5,25)] text-white p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
          autoComplete="email"
        />
        <button
          onClick={send}
          disabled={!email || cooldown > 0}
          className="w-full bg-euro-gold text-black rounded py-2 font-bold disabled:opacity-40"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send OTP'}
        </button>

        {status === 'pending_otp' && (
          <>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 tracking-widest text-center"
            />
            <button
              onClick={() => verifyOtp(email, token)}
              disabled={token.length !== 6}
              className="w-full bg-white/10 rounded py-2 font-bold disabled:opacity-40"
            >
              Verify
            </button>
          </>
        )}

        {error && <p className="text-red-400 text-sm">Invalid or expired code.</p>}
        <p className="text-xs text-white/40">If your email is not authorized, no code is sent.</p>
      </div>
    </div>
  );
}
