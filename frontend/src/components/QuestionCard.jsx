export default function QuestionCard({ question, value, onChange, onSubmit, submitting }) {
  return (
    <div className="card mb-4">
      <p className="text-lg font-medium mb-3">{question}</p>
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
