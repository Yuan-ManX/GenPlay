/**
 * version_history - Game state snapshot & timeline tool.
 *
 * Captures deterministic snapshots of a game's mutable state (config,
 * scripts, theme, scenario, meta, npcs, nodeGraph, assets) so the user
 * can browse history, diff against the current version, or restore a
 * prior snapshot. Snapshots live in game.meta.versions (capped) and
 * each carries a concise change-digest so the timeline panel can render
 * without reloading the full payload.
 *
 * Actions:
 *   - snapshot  : capture current state into a new version
 *   - list      : return the timeline (id, label, capturedAt, digest)
 *   - restore   : restore a snapshot by id (current state is auto-snapshotted)
 *   - diff      : compute a field-level diff between a snapshot and current
 */

const VERSION_CAP = 30;
const SNAPSHOT_FIELDS = ['config', 'scripts', 'theme', 'scenario', 'meta', 'npcs', 'nodeGraph', 'assets'];

function shallowDiff(prev, curr) {
  const out = {};
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})]);
  for (const k of keys) {
    const a = prev?.[k];
    const b = curr?.[k];
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b);
    if (sa !== sb) {
      out[k] = {
        changed: true,
        beforeBytes: sa ? sa.length : 0,
        afterBytes: sb ? sb.length : 0,
      };
    }
  }
  return out;
}

function buildDigest(snapshot, prevSnapshot) {
  const fields = {};
  for (const f of SNAPSHOT_FIELDS) {
    const v = snapshot[f];
    fields[f] = v ? JSON.stringify(v).length : 0;
  }
  let changes = null;
  if (prevSnapshot) {
    changes = shallowDiff(prevSnapshot.state, snapshot.state);
  }
  return { fields, changes };
}

function captureSnapshot(game, label) {
  const state = {};
  for (const f of SNAPSHOT_FIELDS) {
    const v = game[f];
    if (v != null) state[f] = JSON.parse(JSON.stringify(v));
  }
  return {
    id: 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    label: label || `版本 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    capturedAt: new Date().toISOString(),
    state,
  };
}

export function versionHistoryTool(services = {}) {
  const { gameService } = services;
  return {
    name: 'version_history',
    description:
      'Capture, browse, diff, and restore game state snapshots. Supports actions: snapshot, list, restore, diff. Snapshots are stored in game.meta.versions.',
    parameters: {
      type: 'object',
      required: ['gameId', 'action'],
      properties: {
        gameId: { type: 'string', description: 'Target game ID' },
        action: { type: 'string', enum: ['snapshot', 'list', 'restore', 'diff'], description: 'Snapshot action to perform' },
        snapshotId: { type: 'string', description: 'Required for restore / diff; snapshot id from list' },
        label: { type: 'string', description: 'Optional label when creating a snapshot' },
      },
    },
    async execute({ gameId, action, snapshotId, label }) {
      if (!gameService) return { ok: false, error: 'Game service unavailable' };
      if (!gameId) return { ok: false, error: 'gameId required' };
      if (!action) return { ok: false, error: 'action required (snapshot|list|restore|diff)' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: 'Game not found', summary: '版本操作失败：游戏不存在' };

      const meta = { ...(game.meta || {}) };
      const versions = Array.isArray(meta.versions) ? meta.versions : [];

      if (action === 'snapshot') {
        const snap = captureSnapshot(game, label);
        const prev = versions.length ? versions[versions.length - 1] : null;
        snap.digest = buildDigest(snap, prev);
        versions.push(snap);
        if (versions.length > VERSION_CAP) versions.splice(0, versions.length - VERSION_CAP);
        meta.versions = versions;
        const updated = await gameService.update(gameId, { meta });
        return {
          ok: true,
          summary: `已为《${game.name}》创建快照「${snap.label}」（共 ${versions.length} 个版本）`,
          snapshot: snap,
          totalVersions: versions.length,
          game: updated,
          editorActions: [
            { type: 'studio:version-snapshotted', payload: { gameId, snapshot: snap } },
            { type: 'studio:open-tab', payload: { tab: 'history' } },
          ],
        };
      }

      if (action === 'list') {
        const timeline = versions.map((v) => ({
          id: v.id,
          label: v.label,
          capturedAt: v.capturedAt,
          digest: v.digest || null,
        }));
        return {
          ok: true,
          summary: `《${game.name}》共有 ${timeline.length} 个历史版本`,
          timeline,
          totalVersions: timeline.length,
          editorActions: [
            { type: 'studio:version-list', payload: { gameId, timeline } },
          ],
        };
      }

      if (action === 'restore') {
        if (!snapshotId) return { ok: false, error: 'snapshotId required for restore' };
        const target = versions.find((v) => v.id === snapshotId);
        if (!target) return { ok: false, error: 'Snapshot not found', summary: '回滚失败：找不到该版本' };
        // Auto-snapshot the current state before restore so the action is reversible.
        const autoSnap = captureSnapshot(game, `恢复前自动快照 @ ${new Date().toLocaleString('zh-CN', { hour12: false })}`);
        autoSnap.digest = buildDigest(autoSnap, versions.length ? versions[versions.length - 1] : null);
        versions.push(autoSnap);
        if (versions.length > VERSION_CAP) versions.splice(0, versions.length - VERSION_CAP);
        meta.versions = versions;
        // Apply snapshot state back to the game record.
        // Config uses replace semantics (GameStore deep-merges by default,
        // which would leave stale keys behind when rolling back to an older
        // snapshot). The _configReplace flag tells the store to overwrite.
        const patch = { meta };
        for (const f of SNAPSHOT_FIELDS) {
          if (target.state?.[f] != null) {
            patch[f] = JSON.parse(JSON.stringify(target.state[f]));
          }
        }
        if (patch.config !== undefined) patch._configReplace = true;
        const restored = await gameService.update(gameId, patch);
        return {
          ok: true,
          summary: `已将《${game.name}》回滚至「${target.label}」（当前状态已自动存为新版本）`,
          restoredTo: { id: target.id, label: target.label, capturedAt: target.capturedAt },
          autoSnapshotId: autoSnap.id,
          game: restored,
          editorActions: [
            { type: 'studio:version-restored', payload: { gameId, snapshotId: target.id, autoSnapshotId: autoSnap.id } },
            { type: 'studio:load-game', payload: { gameId } },
            { type: 'studio:open-tab', payload: { tab: 'history' } },
          ],
        };
      }

      if (action === 'diff') {
        if (!snapshotId) return { ok: false, error: 'snapshotId required for diff' };
        const target = versions.find((v) => v.id === snapshotId);
        if (!target) return { ok: false, error: 'Snapshot not found', summary: '对比失败：找不到该版本' };
        const currentState = {};
        for (const f of SNAPSHOT_FIELDS) currentState[f] = game[f] != null ? JSON.parse(JSON.stringify(game[f])) : null;
        const changes = shallowDiff(target.state, currentState);
        const changedFields = Object.keys(changes);
        return {
          ok: true,
          summary: `快照「${target.label}」与当前状态对比：${changedFields.length} 个字段变化`,
          diff: changes,
          changedFields,
          snapshot: { id: target.id, label: target.label, capturedAt: target.capturedAt },
          editorActions: [
            { type: 'studio:version-diff', payload: { gameId, snapshotId: target.id, diff: changes } },
          ],
        };
      }

      return { ok: false, error: `Unknown action: ${action}` };
    },
  };
}
