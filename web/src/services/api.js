// API client - unified wrapper around GenPlay backend endpoints
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

/**
 * SSE streaming chat. Opens a POST /chat/stream connection and parses the
 * Server-Sent Events stream, dispatching typed lifecycle callbacks as the
 * agent reasons (plan -> tool_start -> tool_end -> reply -> done).
 * Falls back to a plain JSON request if the stream is unavailable.
 */
async function chatStream(message, sessionId, { onEvent } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ message, sessionId }),
    });
  } catch (err) {
    // Network failure: fall back to non-streaming chat.
    if (onEvent) onEvent({ type: 'error', error: err.message });
    return request('/chat', { method: 'POST', body: JSON.stringify({ message, sessionId }) });
  }
  if (!res.ok || !res.body) {
    // Endpoint rejected: fall back to non-streaming chat.
    return request('/chat', { method: 'POST', body: JSON.stringify({ message, sessionId }) });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by \n\n
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const evt = _parseSseFrame(frame);
      if (evt && onEvent) onEvent(evt);
      if (evt?.type === 'result' && evt.data) finalResult = { ok: true, ...evt.data };
    }
  }
  // Flush any trailing frame
  if (buffer) {
    const evt = _parseSseFrame(buffer);
    if (evt && onEvent) onEvent(evt);
    if (evt?.type === 'result' && evt.data) finalResult = { ok: true, ...evt.data };
  }
  return finalResult || { ok: false, error: 'stream ended without result' };
}

function _parseSseFrame(frame) {
  let type = 'message';
  const dataLines = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    const data = JSON.parse(dataLines.join('\n'));
    return { type, data };
  } catch (_) {
    return { type, data: { raw: dataLines.join('\n') } };
  }
}

export const api = {
  // ---------- Chat / Agent conversation ----------
  chat: (message, sessionId) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ message, sessionId }) }),
  // SSE streaming chat with realtime lifecycle events.
  chatStream: (message, sessionId, handlers) => chatStream(message, sessionId, handlers),
  listChatTools: () => request('/chat/tools'),
  listSessions: () => request('/chat/sessions'),
  getSession: (id) => request(`/chat/sessions/${id}`),
  resetSession: (id) => request(`/chat/sessions/${id}/reset`, { method: 'POST' }),
  deleteSession: (id) => request(`/chat/sessions/${id}`, { method: 'DELETE' }),

  // ---------- Games CRUD ----------
  listGames: () => request('/games'),
  getGame: (id) => request(`/games/${id}`),
  getGameStats: () => request('/games/stats'),
  createGame: (data) => request('/games', { method: 'POST', body: JSON.stringify(data) }),
  updateGame: (id, data) => request(`/games/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  runGame: (id) => request(`/games/${id}/run`, { method: 'POST' }),
  publishGame: (id) => request(`/games/${id}/publish`, { method: 'POST' }),
  deleteGame: (id) => request(`/games/${id}`, { method: 'DELETE' }),

  // ---------- Editor actions (proxy to Agent tools, share semantics with chat) ----------
  listEditorTools: () => request('/editor/tools'),
  editorAction: (tool, args = {}, sessionId) =>
    request('/editor/action', {
      method: 'POST',
      body: JSON.stringify({ tool, args, sessionId }),
    }),
  // SSE streaming editor action: returns start + result events.
  editorActionStream: async (tool, args = {}, sessionId, { onEvent } = {}) => {
    const res = await fetch(`${BASE}/editor/action/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ tool, args, sessionId }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `请求失败 (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalResult = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const evt = _parseSseFrame(frame);
        if (evt && onEvent) onEvent(evt);
        if (evt?.type === 'result' && evt.data) finalResult = evt.data;
      }
    }
    return finalResult || { ok: false, error: 'stream ended without result' };
  },
  // Batch editor actions: execute multiple tools sequentially.
  editorBatch: (actions = [], sessionId) =>
    request('/editor/batch', {
      method: 'POST',
      body: JSON.stringify({ actions, sessionId }),
    }),
  // AI suggestions for a game.
  getSuggestions: (gameId) => request(`/editor/suggestions/${gameId}`),

  // ---------- Version history ----------
  listVersions: (gameId) => request(`/versions/${gameId}`),
  createSnapshot: (gameId, label) =>
    request(`/versions/${gameId}/snapshot`, { method: 'POST', body: JSON.stringify({ label }) }),
  restoreSnapshot: (gameId, snapshotId) =>
    request(`/versions/${gameId}/${snapshotId}/restore`, { method: 'POST' }),
  diffSnapshot: (gameId, snapshotId) =>
    request(`/versions/${gameId}/${snapshotId}/diff`),

  // ---------- Analytics ----------
  getAnalytics: (gameId) => request(`/analytics/${gameId}`),
  simulateAnalytics: (gameId, { seed, useLlm } = {}) =>
    request(`/analytics/${gameId}/simulate`, { method: 'POST', body: JSON.stringify({ seed, useLlm }) }),

  // ---------- Preferences ----------
  getPreferences: () => request('/preferences'),

  // ---------- Community ----------
  listCommunity: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/community${q ? '?' + q : ''}`);
  },
  likeCommunityGame: (id) => request(`/community/${id}/like`, { method: 'POST' }),
  remixCommunityGame: (id, { name, tweak } = {}) =>
    request(`/community/${id}/remix`, { method: 'POST', body: JSON.stringify({ name, tweak }) }),

  // ---------- Templates ----------
  listTemplates: () => request('/templates'),
  applyTemplate: (genre, { name, difficulty } = {}) =>
    request(`/templates/${genre}/apply`, { method: 'POST', body: JSON.stringify({ name, difficulty }) }),

  // ---------- Crew ----------
  dispatchCrew: ({ brief, genre, autoApply } = {}) =>
    request('/crew/dispatch', { method: 'POST', body: JSON.stringify({ brief, genre, autoApply }) }),

  // ---------- Direct tool-backed game endpoints (REST, no /editor/action proxy) ----------
  exportGame: (id) => request(`/games/${id}/export`, { method: 'POST' }),
  screenshotGame: (id, label) => request(`/games/${id}/screenshot`, { method: 'POST', body: JSON.stringify({ label }) }),
  remixGame: (id, { name, tweak } = {}) => request(`/games/${id}/remix`, { method: 'POST', body: JSON.stringify({ name, tweak }) }),
  profileGame: (id, duration) => request(`/games/${id}/profile`, { method: 'POST', body: JSON.stringify({ duration }) }),
  playtestGame: (id, { duration, seed } = {}) => request(`/games/${id}/playtest`, { method: 'POST', body: JSON.stringify({ duration, seed }) }),
  lintGame: (id, scope) => request(`/games/${id}/lint`, { method: 'POST', body: JSON.stringify({ scope }) }),
  translateGame: (id, { targetLang, sourceLang, scope } = {}) => request(`/games/${id}/translate`, { method: 'POST', body: JSON.stringify({ targetLang, sourceLang, scope }) }),
  balanceGame: (id, { targetDifficulty, duration, seed } = {}) => request(`/games/${id}/balance`, { method: 'POST', body: JSON.stringify({ targetDifficulty, duration, seed }) }),
  analyzeFunFactor: (id) => request(`/games/${id}/fun-factor`, { method: 'POST' }),
  generateTutorial: (id, { steps, style } = {}) => request(`/games/${id}/tutorial`, { method: 'POST', body: JSON.stringify({ steps, style }) }),
  generateDialogueTree: (id, { character, topic, branches, depth, title } = {}) =>
    request(`/games/${id}/dialogue-tree`, { method: 'POST', body: JSON.stringify({ character, topic, branches, depth, title }) }),
  composeMusic: (id, { moods, mood, seed, bars } = {}) =>
    request(`/games/${id}/compose-music`, { method: 'POST', body: JSON.stringify({ moods, mood, seed, bars }) }),
  undoGame: (id) => request(`/games/${id}/undo`, { method: 'POST' }),
  redoGame: (id) => request(`/games/${id}/redo`, { method: 'POST' }),
  getHistory: (id) => request(`/games/${id}/history`),
  // Build a standalone HTML5 game file (returns the HTML source).
  buildPlayable: (id) => request(`/games/${id}/build`, { method: 'POST', body: JSON.stringify({ inline: true }) }),
  // Direct URL of the playable build, usable in a new tab or an iframe.
  playableUrl: (id) => `${BASE}/games/${id}/playable`,

  // ---------- Long-term memory ----------
  recallMemory: (query, scope = 'all', limit = 6) =>
    request(`/chat/memory/recall?q=${encodeURIComponent(query || '')}&scope=${encodeURIComponent(scope)}&limit=${limit}`),
};

export default api;
