export default function LockedBadge({ label }: { label: string }) {
  return (
    <span
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-white/40 cursor-not-allowed select-none"
      title="Available before the show starts"
      aria-disabled="true"
    >
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {label}
    </span>
  );
}
