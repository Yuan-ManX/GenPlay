/**
 * UndoManager - Per-game snapshot stack for undo/redo support.
 * Holds a bounded stack of game state snapshots. The orchestrator pushes a
 * snapshot BEFORE executing any modifying tool so the user can revert.
 *
 * Snapshots are deep clones of the game object at the moment before a change.
 * The manager keeps `past` and `future` stacks; undo moves current → future,
 * redo moves future → current. Storing the "current" state is the caller's
 * job (gameService holds it); the manager only tracks historical snapshots.
 */

const MAX_STACK = 50;

export class UndoManager {
  constructor() {
    // Map<gameId, { past: Array<snapshot>, future: Array<snapshot> }>
    this.stacks = new Map();
  }

  _get(gameId) {
    let s = this.stacks.get(gameId);
    if (!s) {
      s = { past: [], future: [] };
      this.stacks.set(gameId, s);
    }
    return s;
  }

  /**
   * Push a pre-change snapshot onto the past stack and clear the future
   * (any new action invalidates the redo branch). Called by the orchestrator
   * right before a modifying tool runs.
   */
  pushSnapshot(gameId, snapshot) {
    if (!gameId || !snapshot) return;
    const s = this._get(gameId);
    s.past.push(snapshot);
    if (s.past.length > MAX_STACK) s.past.shift();
    s.future = [];
  }

  /**
   * Pop the last snapshot from `past`. The caller restores the game to this
   * snapshot and pushes the current (pre-undo) state onto `future`.
   * Returns the snapshot to restore, or null if nothing to undo.
   */
  undo(gameId) {
    const s = this._get(gameId);
    if (!s.past.length) return null;
    return s.past.pop();
  }

  /**
   * Pop the last snapshot from `future`. Caller restores the game to this
   * snapshot and pushes the current (pre-redo) state onto `past`.
   * Returns the snapshot to restore, or null if nothing to redo.
   */
  redo(gameId) {
    const s = this._get(gameId);
    if (!s.future.length) return null;
    return s.future.pop();
  }

  /**
   * Push a state onto `future` (called by the tool after restoring an undo
   * snapshot so the redo branch stays valid).
   */
  pushFuture(gameId, snapshot) {
    if (!gameId || !snapshot) return;
    const s = this._get(gameId);
    s.future.push(snapshot);
    if (s.future.length > MAX_STACK) s.future.shift();
  }

  /**
   * Push a state onto `past` (called by the tool after restoring a redo
   * snapshot so the undo branch stays valid).
   */
  pushPast(gameId, snapshot) {
    this.pushSnapshot(gameId, snapshot);
  }

  peek(gameId) {
    const s = this._get(gameId);
    return {
      canUndo: s.past.length > 0,
      canRedo: s.future.length > 0,
      pastCount: s.past.length,
      futureCount: s.future.length,
      lastLabel: s.past.length ? s.past[s.past.length - 1]?.__label || null : null,
    };
  }

  /**
   * Return a lightweight history listing for UI display.
   * Each entry: { label, timestamp, action } extracted from snapshot metadata.
   */
  history(gameId) {
    const s = this._get(gameId);
    const past = s.past.map((snap, i) => ({
      position: i,
      label: snap?.__label || `动作 #${i + 1}`,
      action: snap?.__action || 'unknown',
      timestamp: snap?.__ts || null,
    }));
    const future = s.future.map((snap, i) => ({
      position: -(i + 1),
      label: snap?.__label || `重做 #${i + 1}`,
      action: snap?.__action || 'unknown',
      timestamp: snap?.__ts || null,
    }));
    return { past, future };
  }

  clear(gameId) {
    if (gameId) this.stacks.delete(gameId);
    else this.stacks.clear();
  }
}

/**
 * The set of tool names that modify game state and should trigger an undo
 * snapshot before execution. Read-only tools (list, describe, view_code,
 * analytics, etc.) are excluded.
 */
export const MODIFYING_TOOLS = new Set([
  'create_game', 'edit_game', 'edit_config_field', 'edit_script',
  'tweak_params', 'apply_style_theme', 'apply_scenario',
  'configure_game_meta', 'update_basic_info', 'manage_npc',
  'manage_asset', 'manage_audio', 'manage_achievements',
  'manage_scenes', 'manage_leaderboard', 'edit_node_graph',
  'install_snippet', 'rapid_iterate', 'debug_with_diffs',
  'balance_game', 'translate_game', 'generate_story',
  'design_progression', 'generate_game_template', 'generate_tutorial',
  'compose_music', 'generate_dialogue_tree',
]);
