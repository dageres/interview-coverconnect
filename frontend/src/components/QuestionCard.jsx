import { useState, useCallback } from 'react';

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'lv-LV';
  utterance.rate = 0.95;
  return utterance;
}

export default function QuestionCard({ question, value, onChange, onSubmit, submitting }) {
  const [speaking, setSpeaking] = useState(false);

  const toggleSpeak = useCallback(() => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = speak(question);
    if (!utterance) return;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [question, speaking]);

  return (
    <div className="card mb-4">
      <div className="flex items-start gap-2 mb-3">
        <p className="text-lg font-medium flex-1">{question}</p>
        <button
          type="button"
          onClick={toggleSpeak}
          className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
            speaking
              ? 'bg-primary/20 text-primary'
              : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
          }`}
          aria-label={speaking ? 'Apturēt' : 'Noklausīties jautājumu'}
          title={speaking ? 'Apturēt' : 'Noklausīties'}
        >
          {speaking ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5ZM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M10.5 3.75a.75.75 0 0 0-1.264-.546L5.203 7H2.667a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 1.5 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h2.535l4.033 3.796A.75.75 0 0 0 10.5 16.25V3.75ZM13.329 7.212a.75.75 0 0 1 1.06.028A4.991 4.991 0 0 1 15.5 10a4.99 4.99 0 0 1-1.111 2.76.75.75 0 0 1-1.088-1.032A3.49 3.49 0 0 0 14 10a3.49 3.49 0 0 0-.699-1.728.75.75 0 0 1 .028-1.06Z" />
            </svg>
          )}
        </button>
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ieraksti savu atbildi..."
          rows={3}
          className="w-full bg-navy border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          aria-label={`Atbilde: ${question}`}
        />
        <span className="absolute bottom-2 right-3 text-xs text-white/30">
          {value.length}
        </span>
      </div>
      {onSubmit && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => onSubmit('text')}
            disabled={submitting || !value.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? 'Nosūta...' : 'Sūtīt atbildi'}
          </button>
        </div>
      )}
    </div>
  );
}
