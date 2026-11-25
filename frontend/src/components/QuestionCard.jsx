import { useState, useRef, useCallback } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function QuestionCard({ question, value, onChange, onSubmit, submitting }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggleListen = useCallback(() => {
    if (!SpeechRecognition) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'lv-LV';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      if (final) {
        onChange((prev) => (prev ? prev + ' ' + final.trim() : final.trim()));
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    setListening(true);
    recognition.start();
  }, [listening, onChange]);

  return (
    <div className="card mb-4">
      <p className="text-lg font-medium mb-3">{question}</p>
      <div className="flex gap-3 items-start">
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ieraksti vai iesaki atbildi..."
            rows={3}
            className="w-full bg-navy border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            aria-label={`Atbilde: ${question}`}
          />
          <span className="absolute bottom-2 right-3 text-xs text-white/30">
            {value.length}
          </span>
        </div>
        {SpeechRecognition && (
          <button
            type="button"
            onClick={toggleListen}
            className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-colors ${
              listening
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
            }`}
            aria-label={listening ? 'Apturēt ierakstu' : 'Runāt atbildi'}
            title={listening ? 'Apturēt' : 'Mikrofons'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
              <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
              <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
            </svg>
          </button>
        )}
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
