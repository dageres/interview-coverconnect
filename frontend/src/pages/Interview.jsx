import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import {
  startInterview,
  submitAnswer,
  getInterview,
  generateProfile,
  approveProfile,
  getStoredInterview,
  clearStoredInterview,
} from '../lib/api';

const TOPIC_KEYS = ['intro', 'experience', 'did_you_know', 'ask_me_about', 'superpower', 'beyond_work', 'dreams'];
const TOPIC_LABELS = {
  intro: 'Iepazīšanās',
  experience: 'Pieredze un sasniegumi',
  did_you_know: 'Vai tu zināji?',
  ask_me_about: 'Pajautā man par...',
  superpower: 'Superspēja',
  beyond_work: 'Dzīve ārpus darba',
  dreams: 'Sapņi',
};

export default function Interview() {
  const { id: urlId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState('intro'); // 'intro' | 'questions' | 'name' | 'generating' | 'review' | 'done'
  const [name, setName] = useState('');
  const [interviewId, setInterviewId] = useState(null);
  const [currentTopic, setCurrentTopic] = useState(TOPIC_KEYS[0]);
  const [progress, setProgress] = useState(0);
  const [allTopicsCovered, setAllTopicsCovered] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resume an existing interview from the stored interviewId + resumeToken
  useEffect(() => {
    const stored = getStoredInterview();
    const id = urlId || stored.interviewId;
    if (!id) return;
    if (!stored.resumeToken) {
      clearStoredInterview();
      return;
    }
    let cancelled = false;

    async function resume() {
      setLoading(true);
      setError(null);
      try {
        const data = await getInterview(id);
        if (cancelled) return;
        setInterviewId(id);
        setName(data.participantName || '');
        setCurrentTopic(data.currentTopic);
        setProgress(data.progress);
        setAllTopicsCovered(data.allTopicsCovered);
        if (data.questions?.length) setQuestions(data.questions);

        if (data.status === 'approved' || data.status === 'published') {
          setStep('done');
        } else if (data.status === 'content_ready') {
          setStep('name');
        } else {
          setStep('questions');
        }
        if (!urlId) navigate(`/interview/${id}`, { replace: true });
      } catch (err) {
        if (cancelled) return;
        if (err.status === 403 || err.status === 404) {
          clearStoredInterview();
          if (urlId) navigate('/interview', { replace: true });
        } else {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resume();
    return () => { cancelled = true; };
  }, [urlId, navigate]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await startInterview();
      setInterviewId(data.interviewId);
      setQuestions(data.firstQuestions || []);
      setCurrentTopic(data.currentTopic);
      setProgress(data.progress);
      setAllTopicsCovered(false);
      setAnswers({});
      setStep('questions');
      navigate(`/interview/${data.interviewId}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = useCallback((qIndex) => {
    return (valueOrFn) => {
      setAnswers((prev) => {
        const current = prev[qIndex] || '';
        const next = typeof valueOrFn === 'function' ? valueOrFn(current) : valueOrFn;
        return { ...prev, [qIndex]: next };
      });
    };
  }, []);

  // Sends ONE answer; the response replaces the question list.
  const handleSubmitAnswer = async (qIndex, source) => {
    const answer = (answers[qIndex] || '').trim();
    if (!answer) return;
    setLoading(true);
    setError(null);
    try {
      const data = await submitAnswer(interviewId, { answer, topic: currentTopic, source });
      setQuestions(data.nextQuestions || []);
      setCurrentTopic(data.currentTopic);
      setProgress(data.progress);
      setAllTopicsCovered(data.allTopicsCovered);
      setAnswers({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStep('generating');
    setLoading(true);
    setError(null);
    try {
      const data = await generateProfile(interviewId, name.trim());
      setProfile(data.profile);
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('name');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await approveProfile(interviewId);
      clearStoredInterview();
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const topicIndex = Math.max(0, TOPIC_KEYS.indexOf(currentTopic));
  const topicLabel = TOPIC_LABELS[currentTopic] || '';
  // Resumed interviews have no stored questions; offer one open prompt for the current topic.
  const shownQuestions = questions.length
    ? questions
    : [`Turpini stāstīt par tēmu "${topicLabel}"`];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/10 py-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors"
            aria-label="Atpakaļ uz sākumu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 inline mr-1">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 0 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Sākums
          </button>
          <span className="text-white/40 text-sm">StartSchool Human Map</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Step: Intro */}
        {step === 'intro' && (
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-3xl font-bold mb-2">Sveiki!</h1>
            <p className="text-white/60 mb-8">Atbildi uz dažiem jautājumiem, lai izveidotu savu Human Map</p>
            <button
              onClick={handleStart}
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Lūdzu uzgaidiet...' : 'Sākt interviju'}
            </button>
          </div>
        )}

        {/* Step: Questions */}
        {step === 'questions' && (
          <div>
            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">
                  Tēma {topicIndex + 1} / {TOPIC_KEYS.length}
                </span>
                <span className="text-sm font-medium text-primary">{topicLabel}</span>
              </div>
              <div className="w-full bg-navy-light rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {allTopicsCovered && (
              <div className="card mb-6 text-center">
                <p className="text-white/70 mb-4">Visas tēmas ir aptvertas. Vari izveidot profilu vai turpināt atbildēt.</p>
                <button onClick={() => setStep('name')} className="btn-accent">
                  Izveidot profilu
                </button>
              </div>
            )}

            <p className="text-sm text-white/50 mb-3">Atbildi uz jebkuru jautājumu, lai turpinātu.</p>
            {shownQuestions.map((q, i) => (
              <QuestionCard
                key={`${currentTopic}-${i}-${q}`}
                question={q}
                value={answers[i] || ''}
                onChange={handleAnswerChange(i)}
                onSubmit={(source) => handleSubmitAnswer(i, source)}
                submitting={loading}
              />
            ))}
          </div>
        )}

        {/* Step: Name (asked before generating) */}
        {step === 'name' && (
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-3xl font-bold mb-2">Gandrīz gatavs!</h1>
            <p className="text-white/60 mb-8">Ievadi savu vārdu, lai izveidotu profilu</p>
            <form onSubmit={handleGenerate}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tavs vārds"
                className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
                autoFocus
                required
                aria-label="Tavs vārds"
              />
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="btn-primary w-full disabled:opacity-50"
              >
                Izveidot profilu
              </button>
            </form>
            {!allTopicsCovered && (
              <button
                onClick={() => setStep('questions')}
                className="mt-4 text-sm text-white/50 hover:text-white transition-colors"
              >
                Atpakaļ pie jautājumiem
              </button>
            )}
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <svg className="w-8 h-8 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Veidojam tavu profilu...</h2>
            <p className="text-white/60">AI analizē tavas atbildes un veido Human Map</p>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && profile && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Tavs Human Map ir gatavs!</h2>
              <p className="text-white/60">Pārskati un apstiprini savu profilu</p>
            </div>

            <div className="card mb-6">
              <h3 className="text-xl font-bold mb-1">{profile.name}</h3>
              {profile.motto && (
                <p className="text-accent italic mb-4">"{profile.motto}"</p>
              )}
              {profile.intro && (
                <p className="text-white/70 mb-4">{profile.intro}</p>
              )}

              {profile.did_you_know?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">Did You Know?</h4>
                  <ul className="space-y-1">
                    {profile.did_you_know.map((item, i) => (
                      <li key={i} className="text-white/70 text-sm">- {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.superpower_title && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">Superpower</h4>
                  <p className="text-white/70 text-sm">
                    <strong>{profile.superpower_title}</strong>
                    {profile.superpower_description && ` — ${profile.superpower_description}`}
                  </p>
                </div>
              )}

              {profile.life_at_glance?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">Life at a Glance</h4>
                  <ul className="space-y-1">
                    {profile.life_at_glance.map((item, i) => (
                      <li key={i} className="text-white/70 text-sm">- {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.inspirations?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">What Inspires Me</h4>
                  <ul className="space-y-1">
                    {profile.inspirations.map((item, i) => (
                      <li key={i} className="text-white/70 text-sm">- {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={handleApprove} disabled={loading} className="btn-accent disabled:opacity-50">
                {loading ? 'Apstiprina...' : 'Apstiprināt un publicēt'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="max-w-md mx-auto text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Paldies!</h2>
            <p className="text-white/60">Tavs profils ir apstiprināts. Pēc administratora pārbaudes tas tiks publicēts.</p>
          </div>
        )}
      </main>
    </div>
  );
}
