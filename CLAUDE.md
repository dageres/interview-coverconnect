# interview.coverconnect.co — StartSchool Human Map

## What this is

Voice-enabled AI interview platform that creates magazine-style personal profiles for StartSchool participants. The AI asks questions in Latvian, generates profiles in English, and emails results to sintija.markus@startschool.org.

## Layout

| Path | What it is |
|------|-----------|
| `server/` | Express backend — API routes, SQLite, OpenAI, Deepgram WS proxy |
| `server/services/ai.js` | OpenAI GPT-4o interview engine |
| `server/services/email.js` | Nodemailer — sends profiles to StartSchool |
| `server/routes/deepgram-ws.js` | WebSocket proxy for real-time Latvian STT |
| `frontend/` | React (Vite) SPA — interview flow, Human Map viewer, admin panel |
| `mcp-server/` | MCP server for Claude Code admin access |
| `interview.db` | SQLite database (gitignored) |

## Stack

- Node.js + Express + express-ws
- SQLite via better-sqlite3 (WAL mode)
- OpenAI GPT-4o for interview AI
- Deepgram nova-2 for Latvian speech-to-text
- React 18 + Vite + Tailwind CSS
- Nodemailer for SMTP email
- JWT for admin auth

## Common commands

```bash
npm run dev          # Start backend on :3100
cd frontend && npx vite  # Start frontend dev on :5173
npm run build        # Build frontend for production
npm start            # Production: serves built frontend from dist/
npm run mcp          # Start MCP server (stdio)
```

## Deployment

Target: VPS 192.168.0.22 (or 212.192.2.148), PM2 process, nginx reverse proxy for interview.coverconnect.co with Let's Encrypt SSL.

## Environment

Copy `.env.example` to `.env` and fill in:
- `OPENAI_API_KEY` — GPT-4o for the interview engine
- `DEEPGRAM_API_KEY` — Latvian speech-to-text
- `ADMIN_PASSWORD` — admin panel login
- `JWT_SECRET` — token signing
- `SMTP_*` — email to sintija.markus@startschool.org

## Interview flow

7 topics in order: intro → experience → did_you_know → ask_me_about → superpower → beyond_work → dreams. AI asks 3-5 questions per topic in Latvian, moves on after 2+ answers per topic. After all topics, generates a structured English profile and emails it.
