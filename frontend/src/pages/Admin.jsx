import { useState, useEffect, useCallback } from 'react';
import { adminLogin, getProfiles, updateProfile, deleteProfile, publishProfile } from '../lib/api';

function LoginForm({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await adminLogin(password);
      localStorage.setItem('admin_token', data.token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-sm w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin</h1>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parole"
            className="w-full bg-navy border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
            autoFocus
            required
            aria-label="Administratora parole"
          />
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Ieiet...' : 'Ieiet'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditModal({ profile, onSave, onClose }) {
  const [form, setForm] = useState({
    name: profile.name || '',
    intro: profile.intro || '',
    motto: profile.motto || '',
    did_you_know: (profile.did_you_know || []).join('\n'),
    ask_me_about: (profile.ask_me_about || []).join(', '),
    superpower_title: profile.superpower_title || '',
    superpower_description: profile.superpower_description || '',
    life_at_glance: (profile.life_at_glance || []).join('\n'),
    inspirations: (profile.inspirations || []).join('\n'),
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        name: form.name,
        intro: form.intro,
        motto: form.motto,
        did_you_know: form.did_you_know.split('\n').map((s) => s.trim()).filter(Boolean),
        ask_me_about: form.ask_me_about.split(',').map((s) => s.trim()).filter(Boolean),
        superpower_title: form.superpower_title,
        superpower_description: form.superpower_description,
        life_at_glance: form.life_at_glance.split('\n').map((s) => s.trim()).filter(Boolean),
        inspirations: form.inspirations.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      await onSave(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="card max-w-xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Rediģēt profilu</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Aizvērt">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Vārds" value={form.name} onChange={handleChange('name')} />
          <Field label="Intro" value={form.intro} onChange={handleChange('intro')} multiline />
          <Field label="Motto" value={form.motto} onChange={handleChange('motto')} />
          <Field label="Did You Know (katru jaunā rindā)" value={form.did_you_know} onChange={handleChange('did_you_know')} multiline />
          <Field label="Ask Me About (ar komatu)" value={form.ask_me_about} onChange={handleChange('ask_me_about')} />
          <Field label="Superpower title" value={form.superpower_title} onChange={handleChange('superpower_title')} />
          <Field label="Superpower description" value={form.superpower_description} onChange={handleChange('superpower_description')} multiline />
          <Field label="Life at a Glance (katru jaunā rindā)" value={form.life_at_glance} onChange={handleChange('life_at_glance')} multiline />
          <Field label="Inspirations (katru jaunā rindā)" value={form.inspirations} onChange={handleChange('inspirations')} multiline />
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-white/60 hover:text-white transition-colors">
              Atcelt
            </button>
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? 'Saglabā...' : 'Saglabāt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }) {
  const cls = 'w-full bg-navy border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm';
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={onChange} rows={3} className={cls} />
      ) : (
        <input type="text" value={value} onChange={onChange} className={cls} />
      )}
    </div>
  );
}

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('admin_token'));
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProfiles();
      setProfiles(Array.isArray(data) ? data : data.profiles || []);
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem('admin_token');
        setLoggedIn(false);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) loadProfiles();
  }, [loggedIn, loadProfiles]);

  const handleLogin = () => {
    setLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setLoggedIn(false);
  };

  const handlePublishToggle = async (p) => {
    try {
      await publishProfile(p.id || p._id);
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (p) => {
    try {
      await deleteProfile(p.id || p._id);
      setConfirmDelete(null);
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async (data) => {
    const pid = editing.id || editing._id;
    try {
      await updateProfile(pid, data);
      setEditing(null);
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportCSV = () => {
    if (!profiles.length) return;
    const headers = ['name', 'motto', 'intro', 'published', 'created_at'];
    const rows = profiles.map((p) =>
      headers.map((h) => {
        const val = p[h] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profiles.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loggedIn) return <LoginForm onLogin={handleLogin} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 py-4">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <div className="flex items-center gap-3">
            <button onClick={handleExportCSV} className="text-sm text-white/60 hover:text-white transition-colors">
              Eksportēt CSV
            </button>
            <button onClick={handleLogout} className="text-sm text-white/40 hover:text-red-400 transition-colors">
              Iziet
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {loading && !profiles.length ? (
          <p className="text-white/40 text-center py-20">Ielādē...</p>
        ) : profiles.length === 0 ? (
          <p className="text-white/40 text-center py-20">Nav profilu</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/40">
                  <th className="pb-3 pr-4 font-medium">Vārds</th>
                  <th className="pb-3 pr-4 font-medium">Motto</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Darbības</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const pid = p.id || p._id;
                  return (
                    <tr key={pid} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 pr-4 font-medium">
                        <a href={`/map/${pid}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                          {p.name}
                        </a>
                      </td>
                      <td className="py-3 pr-4 text-white/60 max-w-xs truncate">{p.motto || '—'}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${p.published ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/50'}`}>
                          {p.published ? 'Publicēts' : 'Melnraksts'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing(p)}
                            className="text-white/40 hover:text-primary transition-colors"
                            aria-label={`Rediģēt ${p.name}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handlePublishToggle(p)}
                            className="text-white/40 hover:text-green-400 transition-colors"
                            aria-label={p.published ? 'Noņemt publicēšanu' : 'Publicēt'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {confirmDelete === pid ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(p)}
                                className="text-red-400 text-xs font-medium hover:text-red-300"
                              >
                                Apstiprināt
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-white/40 text-xs hover:text-white"
                              >
                                Atcelt
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(pid)}
                              className="text-white/40 hover:text-red-400 transition-colors"
                              aria-label={`Dzēst ${p.name}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022 1.005 11.07A2.75 2.75 0 0 0 7.763 19.5h4.474a2.75 2.75 0 0 0 2.744-2.479l1.005-11.07.149.022a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.5 5.5a.75.75 0 0 1-1.496-.136l.5-5.5a.75.75 0 0 1 .796-.664Zm2.84 0a.75.75 0 0 1 .796.664l.5 5.5a.75.75 0 1 1-1.496.136l-.5-5.5a.75.75 0 0 1 .7-.8Z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && (
        <EditModal profile={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
