import express from 'express';
import cors from 'cors';
import http from 'node:http';
import config from './config/index.js';
import { requestLogger } from './middlewares/logger.js';
import { authGuard } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/validate.js';
import { GameService } from './services/GameService.js';
import { AgentService } from './services/AgentService.js';
import { gameRoutes } from './routes/games.js';
import { chatRoutes } from './routes/chat.js';
import { editorRoutes } from './routes/editor.js';

const app = express();
const server = http.createServer(app);

// Global middlewares
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(requestLogger);

// In-memory rate limiter (simple sliding window per IP)
const RL_WINDOW_MS = 60_000;
const RL_LIMIT = 240;
const rl = new Map();
app.use((req, res, next) => {
  const ip = req.ip || 'anon';
  const now = Date.now();
  const arr = (rl.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_LIMIT) {
    res.set('Retry-After', Math.ceil(RL_WINDOW_MS / 1000));
    return res.status(429).json({ ok: false, error: 'Rate limited' });
  }
  arr.push(now);
  rl.set(ip, arr);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'GenPlay Backend', ts: new Date().toISOString() });
});

// Instantiate service layer
const gameService = new GameService(config.dataDir);
const agentService = new AgentService(gameService);

// Routes (specific before :id params)
app.use('/api/games', authGuard, gameRoutes(gameService));
app.use('/api/chat', authGuard, chatRoutes(agentService));
app.use('/api/editor', authGuard, editorRoutes(agentService));

// Simple quota summary endpoint
app.get('/api/meta', authGuard, async (_req, res) => {
  const stats = await gameService.stats();
  res.json({
    ok: true,
    stats,
    llm: { mode: config.llm.apiKey ? 'online' : 'fallback', model: config.llm.model },
    tools: agentService.listTools().length,
    features: {
      community: true,
      assetLibrary: true,
      nodeGraph: true,
      multiplayerMeta: true,
      websocket: wsEnabled,
    },
  });
});

// ---- WebSocket realtime ----
// Lightweight in-process broadcast: every client subscribes to
// "session:<id>" and "global" channels. Agent tool execution pushes
// events through here so studio can update live without polling.
const clients = new Map();
let wsEnabled = false;
try {
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ server, path: '/api/ws' });
  wss.on('connection', (ws, req) => {
    const clientId = 'cli_' + Math.random().toString(36).slice(2, 10);
    const subs = new Set(['global']);
    clients.set(clientId, { ws, subs });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe') subs.add(String(msg.channel || 'global'));
        if (msg.type === 'unsubscribe') subs.delete(String(msg.channel));
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      } catch { /* ignore */ }
    });
    ws.on('close', () => clients.delete(clientId));
    ws.send(JSON.stringify({ type: 'welcome', clientId }));
  });
  wsEnabled = true;
} catch {
  // ws package optional; degrade gracefully
  wsEnabled = false;
}

export function broadcast(channel, payload) {
  if (!wsEnabled) return;
  const msg = JSON.stringify({ type: 'event', channel, ts: Date.now(), payload });
  for (const { ws, subs } of clients.values()) {
    if (subs.has(channel)) {
      try { ws.send(msg); } catch { /* ignore */ }
    }
  }
}

// Expose broadcast hook to AgentService so tools can push live events
agentService.broadcast = broadcast;

// 404 + error
app.use(notFound);
app.use(errorHandler);

server.listen(config.port, () => {
  const toolsCount = agentService.agent.tools?.describe()?.length || 0;
  console.log('\n  GenPlay Backend running at:  http://localhost:' + config.port + '\n');
  console.log('  Frontend origin: ' + config.frontendOrigin);
  console.log('  LLM mode:      ' + (config.llm.apiKey ? config.llm.model + ' (online)' : 'fallback (no API key, rule-based)'));
  console.log('  Agent tools:   ' + toolsCount + ' registered');
  console.log('  WebSocket:     ' + (wsEnabled ? 'wss on /api/ws' : 'unavailable (install ws package to enable)'));
  console.log('  Health check:  http://localhost:' + config.port + '/api/health');
  console.log('  Meta summary:  http://localhost:' + config.port + '/api/meta\n');
});
