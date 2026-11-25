import { useState, useCallback, useRef } from 'react';
import VoiceButton from './VoiceButton';

export default function QuestionCard({ question, value, onChange, onSubmit, submitting }) {
  const [interimText, setInterimText] = useState('');
  const usedVoiceRef = useRef(false);

  const handleTranscript = useCallback(
    (text, isFinal) => {
      if (isFinal) {
        usedVoiceRef.current = true;
        onChange((prev) => (prev ? `${prev} ${text}` : text));
        setInterimText('');
      } else {
        setInterimText(text);
      }
    },
    [onChange]
  );

  const handleError = useCallback((msg) => {
    console.warn('Voice error:', msg);
  }, []);

  const displayValue = interimText ? `${value} ${interimText}`.trim() : value;
  const charCount = value.length;

  return (
    <div className="card mb-4">
      <p className="text-lg font-medium mb-3">{question}</p>
      <div className="flex gap-3 items-start">
        <div className="flex-1 relative">
          <textarea
            value={displayValue}
            onChange={(e) => {
              onChange(e.target.value);
              setInterimText('');
            }}
            placeholder="Ieraksti atbildi vai izmanto mikrofonu..."
            rows={3}
            className="w-full bg-navy border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            aria-label={`Atbilde: ${question}`}
          />
          <span className="absolute bottom-2 right-3 text-xs text-white/30">
            {charCount}
          </span>
        </div>
        <VoiceButton onTranscript={handleTranscript} onError={handleError} />
      </div>
      {onSubmit && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => onSubmit(usedVoiceRef.current ? 'voice' : 'text')}
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
