import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getProfile } from '../lib/api';

function Section({ number, title, emoji, children, accent }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold tracking-widest ${accent ? 'text-accent' : 'text-primary'}`}>
          {number}
        </span>
        <h2 className="text-lg font-bold">
          {title} {emoji}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Tag({ children, variant }) {
  const base = 'inline-block px-3 py-1 rounded-full text-sm font-medium mr-2 mb-2';
  const styles = {
    blue: `${base} bg-primary/20 text-primary`,
    pink: `${base} bg-accent/20 text-accent`,
    muted: `${base} bg-white/10 text-white/70`,
  };
  return <span className={styles[variant] || styles.muted}>{children}</span>;
}

export default function HumanMap() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getProfile(id);
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      alert('Saite nokopēta!');
    } catch {
      prompt('Kopē saiti:', url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 text-primary animate-spin mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
          </svg>
          <p className="text-white/60">Ielādē profilu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <p className="text-red-300 mb-2">Neizdevās ielādēt profilu</p>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="fixed top-0 right-0 z-50 p-4 flex gap-2 print:hidden">
        <button onClick={handleShare} className="bg-navy-light/80 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white transition-colors" aria-label="Kopēt saiti">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline mr-1">
            <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
            <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
          </svg>
          Dalīties
        </button>
        <button onClick={handlePrint} className="bg-navy-light/80 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white transition-colors" aria-label="Drukāt">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline mr-1">
            <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0 1 18 8.653v4.097A2.25 2.25 0 0 1 15.75 15h-.75v3.25c0 .966-.784 1.75-1.75 1.75h-6.5A1.75 1.75 0 0 1 5 18.25V15h-.75A2.25 2.25 0 0 1 2 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.126-.153V2.75ZM6.5 15v3.25c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V15h-7Zm7-11.25a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25v3.401c.456-.023.914-.035 1.375-.035h4.25c.46 0 .919.012 1.375.035V3.75Z" clipRule="evenodd" />
          </svg>
          Drukāt
        </button>
      </div>

      {/* Profile content */}
      <div className="max-w-3xl mx-auto px-4 py-12 print:py-4 print:max-w-none">
        {/* Header */}
        <div className="relative mb-10">
          <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-3xl blur-xl" />
          <div className="relative">
            {/* Photo placeholder */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold mb-6">
              {profile.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-3">{profile.name}</h1>
            {profile.intro && (
              <p className="text-lg text-white/70 max-w-xl">{profile.intro}</p>
            )}
          </div>
        </div>

        {/* Motto */}
        {profile.motto && (
          <div className="mb-10 pl-4 border-l-2 border-accent">
            <p className="text-xl italic text-accent/90">"{profile.motto}"</p>
          </div>
        )}

        {/* 01 / Did You Know */}
        {profile.did_you_know?.length > 0 && (
          <Section number="01" title="DID YOU KNOW?" emoji="" accent>
            <div className="grid gap-3">
              {profile.did_you_know.map((item, i) => (
                <div key={i} className="bg-accent/10 border border-accent/20 rounded-xl px-5 py-4">
                  <p className="text-white/80">{item}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 02 / Ask Me About */}
        {profile.ask_me_about?.length > 0 && (
          <Section number="02" title="ASK ME ABOUT..." emoji="">
            <div className="flex flex-wrap">
              {profile.ask_me_about.map((tag, i) => (
                <Tag key={i} variant="blue">{tag}</Tag>
              ))}
            </div>
          </Section>
        )}

        {/* 03 / My Superpower */}
        {profile.superpower_title && (
          <Section number="03" title="MY SUPERPOWER" emoji="">
            <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-r from-primary to-accent">
              <div className="bg-navy-light rounded-2xl px-6 py-5">
                <h3 className="text-xl font-bold mb-2">{profile.superpower_title}</h3>
                {profile.superpower_description && (
                  <p className="text-white/70">{profile.superpower_description}</p>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Experience & Achievements */}
        {profile.experience?.length > 0 && (
          <Section number="04" title="EXPERIENCE & ACHIEVEMENTS" emoji="">
            <div className="space-y-3">
              {profile.experience.map((item, i) => (
                <div key={i} className="card flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    {typeof item === 'string' ? (
                      <p className="text-white/80">{item}</p>
                    ) : (
                      <>
                        <p className="font-semibold">{item.title}</p>
                        {item.description && <p className="text-white/60 text-sm mt-1">{item.description}</p>}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Life at a Glance */}
        {profile.life_at_glance?.length > 0 && (
          <Section number="05" title="LIFE AT A GLANCE" emoji="">
            <div className="flex flex-wrap gap-3">
              {profile.life_at_glance.map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                  {typeof item === 'string' ? (
                    <span className="text-white/70 text-sm">{item}</span>
                  ) : (
                    <>
                      <span className="text-white/40 text-xs block">{item.label}</span>
                      <span className="text-white font-medium text-sm">{item.value}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Dreams & Wishes */}
        {profile.dreams?.length > 0 && (
          <Section number="06" title="DREAMS & WISHES" emoji="">
            <div className="grid sm:grid-cols-2 gap-3">
              {profile.dreams.map((dream, i) => (
                <div key={i} className="card">
                  <p className="text-white/80">{typeof dream === 'string' ? dream : dream.text}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* What Inspires Me */}
        {profile.inspirations?.length > 0 && (
          <Section number="07" title="WHAT INSPIRES ME" emoji="">
            <div className="space-y-3">
              {profile.inspirations.map((item, i) => (
                <div key={i} className="bg-navy-light/50 rounded-2xl px-6 py-5 border-l-2 border-primary">
                  <p className="text-white/70 italic">{item}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 text-center print:hidden">
          <p className="text-white/30 text-sm">StartSchool Human Map</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .card { background: #f8f8f8 !important; border: 1px solid #ddd !important; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
