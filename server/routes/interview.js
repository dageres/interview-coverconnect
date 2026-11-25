import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../db.js';
import { generateQuestions, generateFollowUp, generateProfile, TOPICS } from '../services/ai.js';
import { sendProfileEmail } from '../services/email.js';

const router = Router();
const TOPIC_KEYS = TOPICS.map((t) => t.key);
const MAX_ANSWER_LENGTH = 2000;
const MAX_ANSWERS_PER_INTERVIEW = 60;

// Rate limiter: 10 starts per hour per IP
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Answer rate limiter: 30 per minute per IP
const answerLimitMap = new Map();
const ANSWER_LIMIT = 30;
const ANSWER_WINDOW_MS = 60 * 1000;

// Generate rate limiter: 3 per hour per interview
const generateLimitMap = new Map();
const GENERATE_LIMIT = 3;
const GENERATE_WINDOW_MS = 60 * 60 * 1000;

function checkLimit(map, key, limit, windowMs) {
  const now = Date.now();
  const timestamps = (map.get(key) || []).filter((t) => now - t < windowMs);
  map.set(key, timestamps);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  return true;
}

function verifyResumeToken(req, interview) {
  const token = req.headers['x-resume-token'];
  if (!token || token !== interview.resume_token) {
    return false;
  }
  return true;
}

// POST /api/interview/start
router.post('/start', async (req, res) => {
  if (!checkLimit(rateLimitMap, req.ip, RATE_LIMIT, RATE_WINDOW_MS)) {
    return res.status(429).json({ error: 'Too many interviews started. Try again later.' });
  }

  try {
    const id = uuidv4();
    const language = req.body.language === 'en' ? 'en' : 'lv';
    const resumeToken = crypto.randomBytes(32).toString('hex');

    db.prepare('INSERT INTO interviews (id, language, resume_token) VALUES (?, ?, ?)').run(
      id, language, resumeToken
    );

    const questions = await generateQuestions('intro', [], language);

    db.prepare(
      'INSERT INTO chat_messages (interview_id, role, content, topic) VALUES (?, ?, ?, ?)'
    ).run(id, 'assistant', JSON.stringify(questions), 'intro');

    res.json({
      interviewId: id,
      resumeToken,
      firstQuestions: questions,
      currentTopic: 'intro',
      progress: 0,
    });
  } catch (err) {
    console.error('Error starting interview:', err.message);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// POST /api/interview/:id/answer
router.post('/:id/answer', async (req, res) => {
  const { id } = req.params;
  const { answer, topic, source } = req.body;

  if (!answer || typeof answer !== 'string') {
    return res.status(400).json({ error: 'answer is required' });
  }
  if (!topic || !TOPIC_KEYS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }

  const cleanAnswer = answer.slice(0, MAX_ANSWER_LENGTH).trim();
  if (!cleanAnswer) return res.status(400).json({ error: 'Answer is empty' });

  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (!verifyResumeToken(req, interview)) {
    return res.status(403).json({ error: 'Invalid resume token' });
  }
  if (interview.status !== 'in_progress') {
    return res.status(400).json({ error: 'Interview is not in progress' });
  }

  if (!checkLimit(answerLimitMap, req.ip, ANSWER_LIMIT, ANSWER_WINDOW_MS)) {
    return res.status(429).json({ error: 'Too many answers. Slow down.' });
  }

  const totalAnswers = db.prepare('SELECT COUNT(*) as c FROM answers WHERE interview_id = ?').get(id).c;
  if (totalAnswers >= MAX_ANSWERS_PER_INTERVIEW) {
    return res.status(400).json({ error: 'Maximum answers reached for this interview' });
  }

  const answerSource = source === 'voice' ? 'voice' : 'text';

  // Get the last assistant question for this topic (don't trust client's question field)
  const lastAssistantMsg = db.prepare(
    "SELECT content FROM chat_messages WHERE interview_id = ? AND role = 'assistant' AND topic = ? ORDER BY id DESC LIMIT 1"
  ).get(id, topic);
  const question = lastAssistantMsg ? '(from AI)' : '(first answer)';

  try {
    db.prepare(
      'INSERT INTO answers (interview_id, topic, question, answer, answer_source) VALUES (?, ?, ?, ?, ?)'
    ).run(id, topic, question, cleanAnswer, answerSource);

    db.prepare(
      'INSERT INTO chat_messages (interview_id, role, content, topic) VALUES (?, ?, ?, ?)'
    ).run(id, 'user', cleanAnswer, topic);

    db.prepare("UPDATE interviews SET updated_at = datetime('now') WHERE id = ?").run(id);

    const allAnswers = db.prepare('SELECT * FROM answers WHERE interview_id = ? ORDER BY id').all(id);
    const coveredTopics = new Set(allAnswers.map((a) => a.topic));
    const currentTopicIndex = TOPIC_KEYS.indexOf(topic);
    const answersForTopic = allAnswers.filter((a) => a.topic === topic);

    let nextQuestions;
    let nextTopic = topic;

    if (cleanAnswer.length < 20 && answersForTopic.length < 3) {
      nextQuestions = await generateFollowUp(topic, cleanAnswer, allAnswers);
    } else if (answersForTopic.length >= 2 && currentTopicIndex < TOPIC_KEYS.length - 1) {
      nextTopic = TOPIC_KEYS[currentTopicIndex + 1];
      nextQuestions = await generateQuestions(nextTopic, allAnswers, interview.language);
    } else {
      nextQuestions = await generateQuestions(topic, allAnswers, interview.language);
    }

    db.prepare(
      'INSERT INTO chat_messages (interview_id, role, content, topic) VALUES (?, ?, ?, ?)'
    ).run(id, 'assistant', JSON.stringify(nextQuestions), nextTopic);

    const progress = Math.round((coveredTopics.size / TOPICS.length) * 100);
    const allTopicsCovered = TOPIC_KEYS.every((t) => coveredTopics.has(t));

    res.json({ nextQuestions, currentTopic: nextTopic, progress, allTopicsCovered });
  } catch (err) {
    console.error('Error processing answer:', err.message);
    res.status(500).json({ error: 'Failed to process answer' });
  }
});

// GET /api/interview/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (!verifyResumeToken(req, interview)) {
    return res.status(403).json({ error: 'Invalid resume token' });
  }

  const answers = db.prepare('SELECT * FROM answers WHERE interview_id = ? ORDER BY id').all(id);
  const coveredTopics = new Set(answers.map((a) => a.topic));
  const progress = Math.round((coveredTopics.size / TOPICS.length) * 100);
  const allTopicsCovered = TOPIC_KEYS.every((t) => coveredTopics.has(t));

  let currentTopic = 'intro';
  if (answers.length > 0) {
    const lastAnswerTopic = answers[answers.length - 1].topic;
    const lastTopicIndex = TOPIC_KEYS.indexOf(lastAnswerTopic);
    currentTopic = lastTopicIndex < TOPIC_KEYS.length - 1
      ? TOPIC_KEYS[lastTopicIndex + 1]
      : lastAnswerTopic;
  }

  const lastAssistantMsg = db.prepare(
    "SELECT content FROM chat_messages WHERE interview_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1"
  ).get(id);
  let lastQuestions = [];
  if (lastAssistantMsg) {
    try { lastQuestions = JSON.parse(lastAssistantMsg.content); } catch {}
  }

  res.json({
    id: interview.id,
    participantName: interview.participant_name,
    status: interview.status,
    language: interview.language,
    answersCount: answers.length,
    currentTopic,
    progress,
    allTopicsCovered,
    questions: lastQuestions,
    createdAt: interview.created_at,
    updatedAt: interview.updated_at,
  });
});

// POST /api/interview/:id/generate
router.post('/:id/generate', async (req, res) => {
  const { id } = req.params;
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (!verifyResumeToken(req, interview)) {
    return res.status(403).json({ error: 'Invalid resume token' });
  }

  // Only allow generation from in_progress or content_ready (re-generate)
  if (!['in_progress', 'content_ready'].includes(interview.status)) {
    return res.status(400).json({ error: 'Profile already approved or published. Contact admin to change.' });
  }

  if (!checkLimit(generateLimitMap, id, GENERATE_LIMIT, GENERATE_WINDOW_MS)) {
    return res.status(429).json({ error: 'Too many generate requests. Try again later.' });
  }

  const answers = db.prepare('SELECT * FROM answers WHERE interview_id = ? ORDER BY id').all(id);
  if (answers.length === 0) {
    return res.status(400).json({ error: 'No answers recorded yet' });
  }

  const participantName = interview.participant_name || req.body.participantName || 'Participant';

  try {
    if (req.body.participantName && !interview.participant_name) {
      db.prepare('UPDATE interviews SET participant_name = ? WHERE id = ?').run(
        String(req.body.participantName).slice(0, 200), id
      );
    }

    const profile = await generateProfile(answers, participantName);

    const existing = db.prepare('SELECT id FROM profiles WHERE interview_id = ?').get(id);
    if (existing) {
      db.prepare(`
        UPDATE profiles SET
          name = ?, intro = ?, motto = ?, did_you_know = ?, ask_me_about = ?,
          superpower_title = ?, superpower_description = ?, experience = ?,
          life_at_glance = ?, dreams = ?, inspirations = ?,
          updated_at = datetime('now')
        WHERE interview_id = ?
      `).run(
        profile.name, profile.intro, profile.motto,
        JSON.stringify(profile.did_you_know), JSON.stringify(profile.ask_me_about),
        profile.superpower_title, profile.superpower_description,
        JSON.stringify(profile.experience), JSON.stringify(profile.life_at_glance),
        JSON.stringify(profile.dreams), JSON.stringify(profile.inspirations), id
      );
    } else {
      db.prepare(`
        INSERT INTO profiles (
          interview_id, name, intro, motto, did_you_know, ask_me_about,
          superpower_title, superpower_description, experience,
          life_at_glance, dreams, inspirations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, profile.name, profile.intro, profile.motto,
        JSON.stringify(profile.did_you_know), JSON.stringify(profile.ask_me_about),
        profile.superpower_title, profile.superpower_description,
        JSON.stringify(profile.experience), JSON.stringify(profile.life_at_glance),
        JSON.stringify(profile.dreams), JSON.stringify(profile.inspirations)
      );
    }

    db.prepare("UPDATE interviews SET status = 'content_ready', updated_at = datetime('now') WHERE id = ?").run(id);

    const savedProfile = db.prepare('SELECT * FROM profiles WHERE interview_id = ?').get(id);

    try {
      await sendProfileEmail(savedProfile || { ...profile, id: 0 }, id);
    } catch (emailErr) {
      console.error('Failed to send profile email:', emailErr.message);
    }

    res.json({ profile });
  } catch (err) {
    console.error('Error generating profile:', err.message);
    res.status(500).json({ error: 'Failed to generate profile' });
  }
});

// POST /api/interview/:id/approve
router.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(id);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });
  if (!verifyResumeToken(req, interview)) {
    return res.status(403).json({ error: 'Invalid resume token' });
  }

  if (interview.status !== 'content_ready') {
    return res.status(400).json({ error: 'Profile must be in content_ready state to approve' });
  }

  db.prepare("UPDATE interviews SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ status: 'approved' });
});

export default router;
