import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

function tryParseJson(val, fallback = []) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function parseProfileJson(profile) {
  if (!profile) return null;
  return {
    ...profile,
    did_you_know: tryParseJson(profile.did_you_know),
    ask_me_about: tryParseJson(profile.ask_me_about),
    experience: tryParseJson(profile.experience),
    life_at_glance: tryParseJson(profile.life_at_glance),
    dreams: tryParseJson(profile.dreams),
    inspirations: tryParseJson(profile.inspirations),
  };
}

const PUBLIC_FIELDS = [
  'id', 'name', 'intro', 'motto', 'did_you_know', 'ask_me_about',
  'superpower_title', 'superpower_description', 'experience',
  'life_at_glance', 'dreams', 'inspirations', 'photo_url',
];

function publicProfile(profile) {
  if (!profile) return null;
  const parsed = parseProfileJson(profile);
  const result = {};
  for (const f of PUBLIC_FIELDS) result[f] = parsed[f];
  return result;
}

// GET /api/profiles — public: only published profiles
router.get('/', (req, res) => {
  const profiles = db.prepare(
    'SELECT * FROM profiles WHERE published = 1 ORDER BY created_at DESC'
  ).all();
  res.json(profiles.map(publicProfile));
});

// GET /api/profiles/:id — public: only published, by numeric id only
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile id' });

  const profile = db.prepare(
    'SELECT * FROM profiles WHERE id = ? AND published = 1'
  ).get(id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(publicProfile(profile));
});

// === Admin routes (all require JWT) ===

// GET /api/profiles/admin/all — admin: all profiles including drafts
router.get('/admin/all', requireAdmin, (req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all();
  res.json(profiles.map(parseProfileJson));
});

// GET /api/profiles/admin/:id — admin: any profile by id
router.get('/admin/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile id' });

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(parseProfileJson(profile));
});

// PUT /api/profiles/:id — Admin only
router.put('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile id' });

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const allowedFields = [
    'name', 'intro', 'motto', 'did_you_know', 'ask_me_about',
    'superpower_title', 'superpower_description', 'experience',
    'life_at_glance', 'dreams', 'inspirations', 'photo_url',
  ];

  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      const val = req.body[field];
      values.push(typeof val === 'object' ? JSON.stringify(val) : String(val).slice(0, 5000));
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.push("updated_at = datetime('now')");
  values.push(profile.id);

  db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile.id);
  res.json(parseProfileJson(updated));
});

// DELETE /api/profiles/:id — Admin only
router.delete('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile id' });

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  db.prepare('DELETE FROM profiles WHERE id = ?').run(profile.id);
  res.json({ deleted: true });
});

// POST /api/profiles/:id/publish — Admin only
router.post('/:id/publish', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid profile id' });

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const newStatus = profile.published ? 0 : 1;
  db.prepare("UPDATE profiles SET published = ?, updated_at = datetime('now') WHERE id = ?").run(
    newStatus, profile.id
  );

  if (newStatus) {
    db.prepare("UPDATE interviews SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(
      profile.interview_id
    );
  } else {
    db.prepare("UPDATE interviews SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(
      profile.interview_id
    );
  }

  res.json({ published: !!newStatus });
});

export default router;
