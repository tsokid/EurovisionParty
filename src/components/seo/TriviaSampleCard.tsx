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
    <div className="card card-pad">
      <div className="flex items-start gap-3 mb-4">
        <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--stage-gradient)' }} aria-hidden>i</span>
        <h3 className="t-h3 text-base text-stage-text">{question}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map((o) => {
          const correct = revealed && o === answer;
          const wrong = revealed && o !== answer;
          return (
            <div
              key={o}
              className={`px-4 min-h-[48px] flex items-center rounded-xl border text-[15px] transition-colors ${
                correct
                  ? 'border-stage-ok/60 bg-stage-ok/10 text-stage-text font-semibold'
                  : wrong
                  ? 'border-stage-line bg-stage-surface text-stage-text-3'
                  : 'border-stage-line-2 bg-stage-surface-2 text-stage-text'
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
        className="mt-3 inline-flex items-center min-h-[44px] text-stage-pink-2 hover:text-stage-text font-semibold text-sm cursor-pointer"
      >
        {revealed ? 'Hide answer' : 'Reveal answer →'}
      </button>
      {revealed && explanation && (
        <p className="t-small mt-1">{explanation}</p>
      )}
    </div>
  );
}
