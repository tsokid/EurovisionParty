import { useState } from 'react';

interface Props {
  question: string;
  options: string[];
  answer: string;
  // Optional 1-line context shown after reveal
  explanation?: string;
}

export default function TriviaSampleCard({ question, options, answer, explanation }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-euro-purple-light to-euro-pink flex items-center justify-center text-white text-sm font-bold" aria-hidden>i</span>
        <h3 className="font-semibold text-white">{question}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map((o) => {
          const correct = revealed && o === answer;
          const wrong = revealed && o !== answer;
          return (
            <div
              key={o}
              className={`px-4 py-2.5 rounded-lg border text-sm transition ${
                correct
                  ? 'border-euro-green/60 bg-euro-green/10 text-white font-medium'
                  : wrong
                  ? 'border-white/10 bg-white/[0.02] text-white/40'
                  : 'border-white/15 bg-white/[0.03] text-white/85'
              }`}
            >
              {o}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="mt-4 text-euro-pink-light hover:text-euro-pink font-semibold text-sm transition"
      >
        {revealed ? 'Hide answer' : 'Reveal answer →'}
      </button>
      {revealed && explanation && (
        <p className="mt-3 text-white/60 text-sm leading-relaxed">{explanation}</p>
      )}
    </div>
  );
}
