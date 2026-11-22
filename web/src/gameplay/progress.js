/**
 * Runtime progression layer: achievement condition evaluation and local
 * player profile persistence (best score, wins, deaths, unlocked badges).
 *
 * Shared by the studio preview and the exported single-file build.
 * Storage is guarded so the module also runs in Node during tests.
 */

export const PROGRESS_METRICS = ['score', 'wins', 'deaths', 'level'];

const STORAGE_PREFIX = 'genplay:profile:';

/** Parse a condition such as "score >= 1000" or "deaths == 0". */
export function parseCondition(condition) {
  const m = String(condition || '').match(
    /^(score|wins|deaths|level)\s*(>=|<=|>|<|==|!=)\s*(\d+(?:\.\d+)?)/i,
  );
  if (!m) return null;
  return { metric: m[1].toLowerCase(), op: m[2], value: Number(m[3]) };
}

/** Evaluate one parsed condition against a stats object. */
export function testCondition(condition, stats = {}) {
  const parsed = typeof condition === 'string' ? parseCondition(condition) : condition;
  if (!parsed || !PROGRESS_METRICS.includes(parsed.metric)) return false;
  const actual = Number(stats[parsed.metric]);
  if (!Number.isFinite(actual)) return false;
  switch (parsed.op) {
    case '>=': return actual >= parsed.value;
    case '<=': return actual <= parsed.value;
    case '>': return actual > parsed.value;
    case '<': return actual < parsed.value;
    case '==': return actual === parsed.value;
    case '!=': return actual !== parsed.value;
    default: return false;
  }
}

/**
 * Return achievements whose condition passes and that are not already
 * unlocked. Result preserves the original achievement records.
 */
export function evaluateAchievements(achievements, stats = {}, unlockedIds = []) {
  const seen = new Set(Array.isArray(unlockedIds) ? unlockedIds : []);
  const unlocked = [];
  for (const ach of Array.isArray(achievements) ? achievements : []) {
    if (!ach || !ach.id || seen.has(ach.id)) continue;
    const condition = ach.condition || 'score >= 100';
    if (testCondition(condition, stats)) {
      unlocked.push(ach);
      seen.add(ach.id);
    }
  }
  return unlocked;
}

/** Fold a single session's results into a cumulative profile. */
export function mergeStats(profile = {}, session = {}) {
  const base = {
    best: Number(profile.best) || 0,
    wins: Number(profile.wins) || 0,
    deaths: Number(profile.deaths) || 0,
    level: Number(profile.level) || 0,
    plays: Number(profile.plays) || 0,
  };
  const score = Number(session.score) || 0;
  return {
    best: Math.max(base.best, score),
    wins: base.wins + (Number(session.wins) || 0),
    deaths: base.deaths + (Number(session.deaths) || 0),
    level: Math.max(base.level, Number(session.level) || 0),
    plays: base.plays + 1,
    achievements: Array.isArray(profile.achievements) ? profile.achievements.slice() : [],
  };
}

function storage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (_) { /* storage blocked */ }
  return null;
}

/** Read the persisted profile for a game (empty object when unavailable). */
export function readProfile(gameId) {
  if (!gameId) return { best: 0, wins: 0, deaths: 0, level: 0, plays: 0, achievements: [] };
  const store = storage();
  if (!store) return { best: 0, wins: 0, deaths: 0, level: 0, plays: 0, achievements: [] };
  try {
    const raw = store.getItem(STORAGE_PREFIX + gameId);
    if (!raw) return { best: 0, wins: 0, deaths: 0, level: 0, plays: 0, achievements: [] };
    const parsed = JSON.parse(raw);
    return {
      best: Number(parsed.best) || 0,
      wins: Number(parsed.wins) || 0,
      deaths: Number(parsed.deaths) || 0,
      level: Number(parsed.level) || 0,
      plays: Number(parsed.plays) || 0,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    };
  } catch (_) {
    return { best: 0, wins: 0, deaths: 0, level: 0, plays: 0, achievements: [] };
  }
}

/** Persist the profile for a game. Returns the normalized profile. */
export function writeProfile(gameId, profile = {}) {
  const normalized = {
    best: Number(profile.best) || 0,
    wins: Number(profile.wins) || 0,
    deaths: Number(profile.deaths) || 0,
    level: Number(profile.level) || 0,
    plays: Number(profile.plays) || 0,
    achievements: Array.isArray(profile.achievements) ? profile.achievements.slice() : [],
  };
  const store = storage();
  if (store && gameId) {
    try { store.setItem(STORAGE_PREFIX + gameId, JSON.stringify(normalized)); } catch (_) { /* quota */ }
  }
  return normalized;
}

/** Reset a game's local profile (used by the presentation reset command). */
export function clearProfile(gameId) {
  const store = storage();
  if (store && gameId) {
    try { store.removeItem(STORAGE_PREFIX + gameId); } catch (_) { /* ignore */ }
  }
}
