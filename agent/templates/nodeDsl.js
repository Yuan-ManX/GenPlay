/**
 * Node DSL Engine - Small visual-scripting runtime for GenPlay game logic.
 * Games can declare logic as a graph of nodes (events, conditions, actions)
 * instead of or alongside the DSL scripts string.
 *
 * Node types:
 *   - Event nodes: on_frame, on_input, on_hit, on_timer, on_turn_start
 *   - Condition nodes: if, random_chance, compare, has_flag
 *   - Action nodes: spawn, despawn, move, damage, heal, score, gameover, victory, set_flag, play_sfx, change_scene
 *
 * Each game may store a node graph on config.nodeGraph.
 */
const EVENT_TYPES = [
  'on_frame', 'on_input', 'on_hit', 'on_timer', 'on_turn_start',
  'on_enter_room', 'on_level_loaded', 'on_death', 'on_pickup', 'on_dialogue',
];

const CONDITION_TYPES = ['if', 'random_chance', 'compare', 'has_flag', 'has_item', 'in_range'];

const ACTION_TYPES = [
  'spawn', 'despawn', 'move', 'jump', 'damage', 'heal', 'score',
  'gameover', 'victory', 'set_flag', 'clear_flag', 'play_sfx', 'play_bgm',
  'change_scene', 'spawn_particles', 'shake_camera', 'grant_item',
  'remove_item', 'gain_xp', 'level_up', 'cast_skill', 'apply_buff',
];

export class NodeDSLEngine {
  constructor(game = {}) {
    this.graph = game.config?.nodeGraph || { nodes: [], edges: [] };
    this.state = {
      flags: {},
      variables: {},
      events: [],
      timer: 0,
    };
    this._nodeMap = new Map(this.graph.nodes.map((n) => [n.id, n]));
  }

  /**
   * Compile the graph into executable event → action pipelines.
   * Returns { [eventType]: [{conditions, actions}] }
   */
  compile() {
    const eventNodes = this.graph.nodes.filter((n) => EVENT_TYPES.includes(n.type));
    const out = {};
    for (const en of eventNodes) {
      const pipeline = this._traceFrom(en.id);
      if (!out[en.type]) out[en.type] = [];
      out[en.type].push(pipeline);
    }
    return out;
  }

  _traceFrom(nodeId) {
    const conditions = [];
    const actions = [];
    const visited = new Set([nodeId]);
    const queue = [nodeId];
    while (queue.length) {
      const id = queue.shift();
      const outs = this.graph.edges.filter((e) => e.from === id);
      for (const edge of outs) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        const target = this._nodeMap.get(edge.to);
        if (!target) continue;
        if (CONDITION_TYPES.includes(target.type)) conditions.push(target);
        else if (ACTION_TYPES.includes(target.type)) actions.push(target);
        queue.push(edge.to);
      }
    }
    return { conditions, actions };
  }

  /**
   * Validate a node graph. Returns array of { severity, message }.
   */
  static validate(graph) {
    const issues = [];
    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];
    const ids = new Set(nodes.map((n) => n.id));
    if (!nodes.length) issues.push({ severity: 'low', message: 'Node graph is empty' });
    for (const e of edges) {
      if (!ids.has(e.from)) issues.push({ severity: 'high', message: `Edge source missing: ${e.from}` });
      if (!ids.has(e.to)) issues.push({ severity: 'high', message: `Edge target missing: ${e.to}` });
    }
    const orphans = nodes.filter((n) => !edges.some((e) => e.from === n.id || e.to === n.id));
    for (const o of orphans) {
      if (!EVENT_TYPES.includes(o.type)) issues.push({ severity: 'low', message: `Node ${o.id} (${o.type}) not connected` });
    }
    return issues;
  }

  /**
   * Create a node graph fragment from a template script string.
   * Bridges the text DSL world to the visual node world.
   */
  static fromDslScript(scriptText, baseId = 'auto') {
    const lines = String(scriptText || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const nodes = [];
    const edges = [];
    let idx = 0;
    for (const line of lines) {
      if (line.startsWith('//')) continue;
      let eventType = null;
      const onMatch = line.match(/^on\s+(.+?):\s*(.+)$/);
      if (onMatch) {
        const ev = onMatch[1].trim();
        const actions = onMatch[2].split(',').map((a) => a.trim());
        eventType = `on_${ev.split(/[\s(]/)[0].replace(/\W+/g, '_')}`;
        if (!EVENT_TYPES.includes(eventType)) eventType = 'on_frame';
        const eventNode = { id: `${baseId}_n${idx++}`, type: eventType, data: { raw: ev } };
        nodes.push(eventNode);
        let lastId = eventNode.id;
        for (const act of actions) {
          const aType = classifyAction(act);
          const actionNode = { id: `${baseId}_n${idx++}`, type: aType, data: { raw: act } };
          nodes.push(actionNode);
          edges.push({ from: lastId, to: actionNode.id });
          lastId = actionNode.id;
        }
      } else if (/^genplay::/.test(line)) {
        const initNode = { id: `${baseId}_n${idx++}`, type: 'on_level_loaded', data: {} };
        nodes.push(initNode);
        const aType = classifyAction(line.replace('genplay::', ''));
        const actionNode = { id: `${baseId}_n${idx++}`, type: aType, data: { raw: line } };
        nodes.push(actionNode);
        edges.push({ from: initNode.id, to: actionNode.id });
      }
    }
    return { nodes, edges };
  }
}

function classifyAction(text) {
  const t = String(text).toLowerCase();
  if (/\bspawn\b/.test(t)) return 'spawn';
  if (/\bdespawn\b/.test(t)) return 'despawn';
  if (/\bmove\b/.test(t)) return 'move';
  if (/\bjump\b/.test(t)) return 'jump';
  if (/\bdamage\b/.test(t)) return 'damage';
  if (/\bheal\b/.test(t)) return 'heal';
  if (/\bscore\b/.test(t)) return 'score';
  if (/\bgameover\b/.test(t)) return 'gameover';
  if (/\bvictory\b/.test(t)) return 'victory';
  if (/\bflag\b/.test(t)) return /clear|unset/.test(t) ? 'clear_flag' : 'set_flag';
  if (/\bsfx|sound\b/.test(t)) return 'play_sfx';
  if (/\bbgm|music\b/.test(t)) return 'play_bgm';
  if (/\bscene\b/.test(t)) return 'change_scene';
  if (/\bparticle\b/.test(t)) return 'spawn_particles';
  if (/\bcamera|shake\b/.test(t)) return 'shake_camera';
  if (/\bitem\b/.test(t)) return /remove|lose|consume/.test(t) ? 'remove_item' : 'grant_item';
  if (/\bxp|experience\b/.test(t)) return 'gain_xp';
  if (/\blevel.?up\b/.test(t)) return 'level_up';
  if (/\bskill|cast\b/.test(t)) return 'cast_skill';
  if (/\bbuff\b/.test(t)) return 'apply_buff';
  return 'spawn';
}

export const DSL_META = {
  eventTypes: EVENT_TYPES,
  conditionTypes: CONDITION_TYPES,
  actionTypes: ACTION_TYPES,
};

export default NodeDSLEngine;
