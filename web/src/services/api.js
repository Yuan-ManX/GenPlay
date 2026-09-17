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
};

export default api;
