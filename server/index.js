import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import interviewRoutes from './routes/interview.js';
import profileRoutes from './routes/profiles.js';
import adminRoutes from './routes/admin.js';

import './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://interview.coverconnect.co'
    : ['http://localhost:5173', 'http://localhost:3100'],
}));
app.use(express.json({ limit: '20kb' }));

app.use('/api/interview', interviewRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/admin', adminRoutes);

const frontendPath = join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(join(frontendPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not built. Use the dev server on :5173.' });
    }
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT, 10) || 3100;
app.listen(PORT, () => {
  console.log(`Interview server listening on http://localhost:${PORT}`);
});
