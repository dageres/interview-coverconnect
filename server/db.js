import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'interview.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    participant_name TEXT,
    resume_token TEXT,
    status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress','content_ready','approved','published')),
    language TEXT DEFAULT 'lv',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id TEXT NOT NULL REFERENCES interviews(id),
    topic TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    answer_source TEXT DEFAULT 'text',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id TEXT UNIQUE NOT NULL REFERENCES interviews(id),
    name TEXT NOT NULL,
    intro TEXT,
    motto TEXT,
    did_you_know TEXT,
    ask_me_about TEXT,
    superpower_title TEXT,
    superpower_description TEXT,
    experience TEXT,
    life_at_glance TEXT,
    dreams TEXT,
    inspirations TEXT,
    photo_url TEXT,
    published BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id TEXT NOT NULL REFERENCES interviews(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    topic TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_answers_interview ON answers(interview_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_interview ON chat_messages(interview_id);
  CREATE INDEX IF NOT EXISTS idx_profiles_published ON profiles(published);
  CREATE INDEX IF NOT EXISTS idx_profiles_interview ON profiles(interview_id);
`);

export default db;
