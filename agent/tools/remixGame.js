/**
 * remix_game - fork a published community game into a fresh editable copy.
 * Pulls the canonical snapshot (genre/config/scripts/theme/scenario) from the
 * published record (or a live game) and seeds a brand-new draft so the user
 * can iterate on a community creation without touching the original.
 *
 * The new game keeps the source genre + logic but is tagged as a remix:
 *   name = "<sourceTitle> · 复刻" (or a user-supplied name)
 *   config.remixOf = shareCode / source gameId
 * This keeps community attribution intact while giving full edit freedom.
 */
export function remixGameTool({ gameService }) {
  return {
    name: 'remix_game',
    description: 'Remix (fork) a published community game into a new editable draft, preserving genre/logic while opening full edit freedom.',
    parameters: {
      type: 'object',
      properties: {
        shareCode: { type: 'string', description: 'Share code of the published game to remix' },
        sourceGameId: { type: 'string', description: 'Alternatively, the live game id to remix from' },
        name: { type: 'string', description: 'Optional new title for the remixed copy' },
        tweak: { type: 'string', description: 'Optional one-line tweak instruction applied to the remix (e.g. "改难度地狱")' },
      },
    },
    async execute({ shareCode, sourceGameId, gameId, name, tweak } = {}) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      // gameId (from history/inline) is treated as the live source to fork.
      if (!shareCode && !sourceGameId) sourceGameId = gameId;
      if (!shareCode && !sourceGameId) {
        return { ok: false, error: '需要 shareCode 或 sourceGameId 才能复刻' };
      }

      // Resolve the source snapshot. Prefer the published record so community
      // remixes work even after the original author edits their draft.
      let source = null;
      let origin = '';
      if (shareCode) {
        source = await gameService.getPublished(shareCode);
        origin = `share:${shareCode}`;
        if (!source && sourceGameId) {
          const g = await gameService.getById(sourceGameId);
          if (g) { source = _snapshotFromGame(g); origin = `game:${sourceGameId}`; }
        }
      } else if (sourceGameId) {
        const g = await gameService.getById(sourceGameId);
        if (g) { source = _snapshotFromGame(g); origin = `game:${sourceGameId}`; }
      }
      if (!source) {
        return { ok: false, error: shareCode ? `未找到分享码 ${shareCode} 的作品` : `未找到源游戏 ${sourceGameId}` };
      }

      const genre = source.genre || source.data?.genre || 'adventure';
      const data = source.data || {};
      const baseName = source.title || source.name || '未命名';
      const newName = (name || `${baseName} · 复刻`).slice(0, 60);

      // Apply an optional inline tweak to the remixed config (difficulty only,
      // keeps remix frictionless; deeper edits go through tweak_params later).
      let config = structuredClone(data.config || {});
      if (tweak) config = _applyInlineTweak(config, tweak);
      config.remixOf = origin;

      const game = await gameService.create({
        name: newName,
        genre,
        description: source.description || data.description || `复刻自「${baseName}」`,
        platform: 'web',
        status: 'draft',
        config,
        scripts: data.scripts || source.scripts || '',
        theme: data.theme || source.theme || null,
        scenario: data.scenario || source.scenario || null,
      });

      const editorActions = [
        { type: 'studio:select-game', payload: { gameId: game.id, name: game.name, genre: game.genre } },
        { type: 'studio:patch-config', gameId: game.id, payload: config },
        { type: 'sidebar:refresh-list', payload: { reason: 'remix' } },
      ];

      return {
        ok: true,
        game,
        gameId: game.id,
        remixOf: origin,
        sourceTitle: baseName,
        editorActions,
        summary: `已复刻「${baseName}」为新作品「${newName}」（ID：${game.id}），可自由编辑后再发布。`,
      };
    },
  };
}

function _snapshotFromGame(g) {
  return {
    title: g.name,
    description: g.description,
    genre: g.genre,
    scripts: g.scripts,
    data: { genre: g.genre, config: g.config, scripts: g.scripts, theme: g.theme, scenario: g.scenario },
  };
}

// Lightweight inline difficulty tweak so a remix can ship a different feel
// without a second round-trip. Mirrors the difficulty presets used elsewhere.
function _applyInlineTweak(config, tweak) {
  const t = String(tweak || '').toLowerCase();
  const presets = {
    easy:   { difficulty: 'easy',   playerHp: 1.4, playerSpeed: 1.15 },
    normal: { difficulty: 'normal', playerHp: 1.0, playerSpeed: 1.0 },
    hard:   { difficulty: 'hard',   playerHp: 0.8, playerSpeed: 1.0, enemyHp: 1.25 },
    hell:   { difficulty: 'hell',   playerHp: 0.6, enemyHp: 1.6, enemySpeed: 1.2 },
  };
  let preset = null;
  if (/简单|easy/i.test(t)) preset = presets.easy;
  else if (/普通|normal/i.test(t)) preset = presets.normal;
  else if (/困难|hard/i.test(t)) preset = presets.hard;
  else if (/地狱|hell|极难/i.test(t)) preset = presets.hell;
  if (!preset) return config;
  const out = structuredClone(config);
  out.difficulty = preset.difficulty;
  if (out.player) {
    if (preset.playerHp != null) out.player.hp = Math.round((out.player.hp || 3) * preset.playerHp);
    if (preset.playerSpeed != null) out.player.speed = Math.round((out.player.speed || 4) * preset.playerSpeed * 10) / 10;
  }
  if (out.enemy && preset.enemyHp != null) out.enemy.hp = Math.round((out.enemy.hp || 1) * preset.enemyHp);
  if (out.enemy && preset.enemySpeed != null) out.enemy.speed = Math.round((out.enemy.speed || 2) * preset.enemySpeed * 10) / 10;
  return out;
}

export default remixGameTool;
