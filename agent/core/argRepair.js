/**
 * Tool-call self-healing layer.
 *
 * LLM tool calls routinely drift from the declared schema: keys arrive in
 * snake_case (`game_id`), carry a colloquial name (`themeName` instead of
 * `theme`), pass numbers as strings (`"12"`), or name the tool slightly off
 * (`apply_theme` vs `apply_style_theme`). Previously every one of these gaps
 * surfaced as a hard failure, forcing the user to restate the request.
 *
 * This module repairs a call *against the tool's declared schema* before
 * execution. Repairs are conservative: a key is only renamed when the target
 * property actually exists and the original key does not, so ambiguous tools
 * that legitimately accept both spellings are never rewritten.
 */

// Canonical property -> colloquial aliases LLM calls tend to emit.
const KEY_ALIASES = {
  gameId: ['game_id', 'gid', 'game', 'gameID', 'targetGameId', 'target_game_id', 'id'],
  theme: ['themeKey', 'theme_key', 'themeName', 'theme_name', 'styleKey', 'style_key', 'style'],
  scenario: ['scenarioKey', 'scenario_key', 'storyKey', 'story_key'],
  genre: ['genre_key', 'gameGenre', 'game_genre', 'gameType', 'game_type'],
  name: ['gameName', 'game_name', 'title'],
  brief: ['briefText', 'brief_text', 'idea', 'prompt'],
  count: ['counts', 'num', 'qty'],
  steps: ['stepCount', 'step_count', 'numSteps', 'num_steps'],
  maxJumps: ['max_jumps', 'jumps'],
  jumpForce: ['jump_force', 'jumpPower', 'jump_power'],
  moveSpeed: ['move_speed', 'speed'],
  newName: ['new_name', 'renameTo', 'rename_to'],
  author: ['writer', 'username'],
  text: ['content', 'body'],
};

// Direct tool-name synonyms that are unambiguous in the GenPlay catalog.
const TOOL_ALIASES = {
  apply_theme: 'apply_style_theme',
  set_theme: 'apply_style_theme',
  apply_style: 'apply_style_theme',
  create: 'create_game',
  new_game: 'create_game',
  make_game: 'create_game',
  list: 'list_games',
  ls_games: 'list_games',
  edit: 'edit_game',
  modify_game: 'edit_game',
  publish: 'publish_game',
  release_game: 'publish_game',
  run: 'run_game',
  play: 'run_game',
  test_run: 'run_game',
  save: 'save_game',
  delete: 'delete_game',
  remove_game: 'delete_game',
  export: 'export_game',
  import: 'import_game',
  remix: 'remix_game',
  clone_game: 'remix_game',
  help: 'help',
};

const camelToSnake = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const snakeToCamel = (s) => String(s).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

/** Levenshtein distance, capped for short tool names. */
function distance(a, b) {
  if (a === b) return 0;
  const m = a.length; const n = b.length;
  if (Math.abs(m - n) > 3) return 4;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[n];
}

/**
 * Resolve a possibly misspelled tool name to a registered one.
 * Returns { name, repaired } where name is the best known match.
 */
export function repairToolName(name, registry) {
  const raw = String(name || '').trim();
  if (!raw) return { name: raw, repaired: false };
  if (registry.has(raw)) return { name: raw, repaired: false };

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const candidates = [normalized, camelToSnake(raw)];

  // Strip common namespace noise the model sometimes prefixes.
  for (const c of [...candidates]) {
    candidates.push(c.replace(/^(genplay_|tool_|fn_)/, ''));
    candidates.push(c.replace(/_tool$/, ''));
  }

  for (const c of candidates) {
    if (registry.has(c)) return { name: c, repaired: true };
    if (TOOL_ALIASES[c] && registry.has(TOOL_ALIASES[c])) {
      return { name: TOOL_ALIASES[c], repaired: true };
    }
  }

  // Last resort: closest registered name within edit distance 2.
  let best = null;
  let bestDist = 3;
  for (const known of registry.listNames()) {
    for (const c of candidates) {
      const d = distance(c, known);
      if (d < bestDist) { bestDist = d; best = known; }
    }
  }
  if (best) return { name: best, repaired: true };
  return { name: raw, repaired: false };
}

function coerce(value, type) {
  if (value === null || value === undefined) return value;
  if (type === 'number' && typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (type === 'boolean' && typeof value === 'string' && /^(true|false)$/i.test(value.trim())) {
    return value.trim().toLowerCase() === 'true';
  }
  if (type === 'string' && (typeof value === 'number' || typeof value === 'boolean')) {
    return String(value);
  }
  if (type === 'array' && typeof value === 'string' && value.trim().startsWith('[')) {
    try { return JSON.parse(value); } catch (_) { return value; }
  }
  if (type === 'object' && typeof value === 'string' && value.trim().startsWith('{')) {
    try { return JSON.parse(value); } catch (_) { return value; }
  }
  return value;
}

/**
 * Repair an argument bag against a tool's JSON-schema `parameters`.
 * Returns { args, repairs } where repairs lists every applied change.
 */
export function repairArgs(toolName, parameters, args = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return { args, repairs: [] };
  const props = parameters?.properties || {};
  const known = new Set(Object.keys(props));
  const repaired = {};
  const repairs = [];

  // Pass 1: keep known keys (with type coercion) and collect the rest.
  const leftovers = [];
  for (const [key, value] of Object.entries(args)) {
    if (known.has(key)) {
      const expected = props[key]?.type;
      const coerced = coerce(value, expected);
      if (coerced !== value) repairs.push({ kind: 'type', from: key, to: key, value: coerced });
      repaired[key] = coerced;
    } else {
      leftovers.push([key, value]);
    }
  }

  // Pass 2: rename leftover keys onto schema properties.
  for (const [key, value] of leftovers) {
    const camel = snakeToCamel(key);
    let target = null;
    if (known.has(camel) && !known.has(key)) target = camel;
    if (!target) {
      for (const [canonical, aliases] of Object.entries(KEY_ALIASES)) {
        if (!known.has(canonical) || known.has(key)) continue;
        if (aliases.includes(key)) { target = canonical; break; }
      }
    }
    if (target && repaired[target] === undefined) {
      repaired[target] = coerce(value, props[target]?.type);
      repairs.push({ kind: 'rename', from: key, to: target });
    } else if (target && repaired[target] !== undefined) {
      // Canonical key already supplied; the alias is redundant.
      repairs.push({ kind: 'drop', from: key, to: target });
    } else {
      // Unknown keys are preserved so tools with extra context still work.
      repaired[key] = value;
    }
  }

  return { args: repaired, repairs };
}

/**
 * One-shot repair of a complete tool call. Safe to apply twice (idempotent).
 * `registry` must expose has(), listNames(), and get().
 */
export function repairToolCall(name, args, registry) {
  const nameFix = repairToolName(name, registry);
  const tool = registry.get?.(nameFix.name) || null;
  const argFix = tool ? repairArgs(nameFix.name, tool.parameters, args) : { args, repairs: [] };
  const repairs = [];
  if (nameFix.repaired) repairs.push({ kind: 'tool', from: name, to: nameFix.name });
  repairs.push(...argFix.repairs);
  return { name: nameFix.name, args: argFix.args, repairs };
}

export default repairToolCall;
