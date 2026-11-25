import WebSocket from 'ws';

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';
const MAX_CONNECTIONS_PER_IP = 2;
const MAX_TOTAL_CONNECTIONS = 20;
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_TIMEOUT_MS = 15 * 1000;

const connectionCounts = new Map();
let totalConnections = 0;

export function setupDeepgramWs(app) {
  app.ws('/ws/deepgram', (clientWs, req) => {
    const dgApiKey = process.env.DEEPGRAM_API_KEY;
    if (!dgApiKey) {
      clientWs.close(1008, 'Deepgram API key not configured');
      return;
    }

    const clientIp = req.ip;
    const ipCount = connectionCounts.get(clientIp) || 0;
    if (ipCount >= MAX_CONNECTIONS_PER_IP) {
      clientWs.close(1008, 'Too many connections');
      return;
    }
    if (totalConnections >= MAX_TOTAL_CONNECTIONS) {
      clientWs.close(1008, 'Server at capacity');
      return;
    }

    connectionCounts.set(clientIp, ipCount + 1);
    totalConnections++;

    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'lv',
      smart_format: 'true',
      interim_results: 'true',
    });

    let dgWs;
    try {
      dgWs = new WebSocket(`${DEEPGRAM_URL}?${params.toString()}`, {
        headers: { Authorization: `Token ${dgApiKey}` },
      });
    } catch (err) {
      console.error('Failed to create Deepgram WebSocket:', err.message);
      cleanup();
      clientWs.close(1011, 'Failed to connect to Deepgram');
      return;
    }

    let dgReady = false;
    let lastActivity = Date.now();

    const sessionTimer = setTimeout(() => {
      clientWs.close(1000, 'Session time limit reached');
    }, SESSION_TIMEOUT_MS);

    const idleChecker = setInterval(() => {
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        clientWs.close(1000, 'Idle timeout');
      }
    }, 5000);

    function cleanup() {
      clearTimeout(sessionTimer);
      clearInterval(idleChecker);
      const count = connectionCounts.get(clientIp) || 1;
      connectionCounts.set(clientIp, Math.max(0, count - 1));
      totalConnections = Math.max(0, totalConnections - 1);
    }

    dgWs.on('open', () => { dgReady = true; });

    dgWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    dgWs.on('error', (err) => {
      console.error('Deepgram WebSocket error:', err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: 'Deepgram connection error' }));
      }
    });

    dgWs.on('close', () => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1000, 'Deepgram connection closed');
      }
      cleanup();
    });

    clientWs.on('message', (msg) => {
      lastActivity = Date.now();
      if (Buffer.isBuffer(msg) && dgReady && dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(msg);
      }
    });

    clientWs.on('close', () => {
      if (dgWs.readyState === WebSocket.OPEN || dgWs.readyState === WebSocket.CONNECTING) {
        try { dgWs.send(JSON.stringify({ type: 'CloseStream' })); } catch {}
        dgWs.close();
      }
      cleanup();
    });

    clientWs.on('error', (err) => {
      console.error('Client WebSocket error:', err.message);
      if (dgWs.readyState === WebSocket.OPEN) dgWs.close();
      cleanup();
    });
  });
}
