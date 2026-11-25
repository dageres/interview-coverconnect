import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import interviewRoutes from './routes/interview.js';
import profileRoutes from './routes/profiles.js';
import adminRoutes from './routes/admin.js';
import { setupDeepgramWs } from './routes/deepgram-ws.js';

// Import db to ensure tables are created on startup
import './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Enable WebSocket support
expressWs(app);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://interview.coverconnect.co'
    : ['http://localhost:5173', 'http://localhost:3100'],
}));
app.use(express.json({ limit: '20kb' }));

// API routes
app.use('/api/interview', interviewRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/admin', adminRoutes);

// WebSocket route for Deepgram STT proxy
setupDeepgramWs(app);

// Serve frontend in production
const frontendPath = join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
    return next();
  }
  res.sendFile(join(frontendPath, 'index.html'), (err) => {
    if (err) {
      // Frontend not built yet — that is fine during development
      res.status(404).json({ error: 'Frontend not built. Use the dev server on :5173.' });
    }
  });
});

// JSON 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT, 10) || 3100;
app.listen(PORT, () => {
  console.log(`Interview server listening on http://localhost:${PORT}`);
});
