// Lightweight pub/sub event bus for cross-component sync.
// Used by ChatPanel -> StudioPanel -> Sidebar agent-driven live updates.
const listeners = new Map();

function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => off(event, cb);
}

function off(event, cb) {
  listeners.get(event)?.delete(cb);
}

function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const cb of set) {
    try { cb(payload); } catch (err) { console.error('[GenPlay event]', event, err); }
  }
}

// ---- GenPlay semantic events ----
// studio:select-game { gameId, name, genre }
// studio:refresh-game { gameId, before, after, change }
// studio:patch-config { gameId, before, after, changes }
// studio:set-scenario { gameId, payload }
// studio:set-theme { gameId, payload }
// studio:focus-code { gameId, payload }
// studio:apply-diff { gameId, before, after, diff, diagnostics }
// sidebar:refresh-list { reason }
// chat:append-suggestions { items: [{label, message}] }

export const events = { on, off, emit };
export default events;
