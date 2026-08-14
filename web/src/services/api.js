// API 客户端 - 统一封装后端请求
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

export const api = {
  // 对话
  chat: (message, sessionId) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ message, sessionId }) }),
  listSessions: () => request('/chat/sessions'),
  getSession: (id) => request(`/chat/sessions/${id}`),
  resetSession: (id) => request(`/chat/sessions/${id}/reset`, { method: 'POST' }),

  // 游戏
  listGames: () => request('/games'),
  getGame: (id) => request(`/games/${id}`),
  createGame: (data) => request('/games', { method: 'POST', body: JSON.stringify(data) }),
  updateGame: (id, data) => request(`/games/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  runGame: (id) => request(`/games/${id}/run`, { method: 'POST' }),
  deleteGame: (id) => request(`/games/${id}`, { method: 'DELETE' }),
};

export default api;
