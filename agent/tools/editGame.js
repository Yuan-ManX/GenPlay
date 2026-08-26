export function editGameTool({ gameService }) {
  return {
    name: 'edit_game',
    description: '编辑/修改现有游戏的内容、玩法或逻辑。支持 patch 字段级修改。',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '要编辑的游戏 ID' },
        change: { type: 'string', description: '要执行的修改描述（自然语言）' },
        patch: { type: 'object', description: '字段级修改：{ name?, description?, config?, scripts? }' },
      },
    },
    async execute({ gameId, change, patch }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const updates = patch ? structuredClone(patch) : {};
      const before = {
        name: game.name,
        description: game.description,
        config: structuredClone(game.config || {}),
        scripts: game.scripts,
      };

      // Heuristic edits from natural-language change description
      if (change) {
        game.editLog = game.editLog || [];
        game.editLog.push({ at: new Date().toISOString(), change });
        const derived = heuristicEdit(game, change);
        Object.assign(updates, derived.patch);
      }

      const finalPatch = {
        ...updates,
        editLog: game.editLog,
        updatedAt: new Date().toISOString(),
      };
      const updated = await gameService.update(gameId, finalPatch);

      const after = {
        name: updated.name,
        description: updated.description,
        config: structuredClone(updated.config || {}),
        scripts: updated.scripts,
      };

      const editorActions = [
        {
          type: 'studio:refresh-game',
          gameId,
          payload: { before, after, change },
        },
      ];

      return {
        ok: true,
        game: updated,
        gameId,
        before,
        after,
        editorActions,
        summary: `已编辑游戏「${updated.name}」${change ? `：${change}` : ''}`,
      };
    },
  };
}

function heuristicEdit(game, change) {
  const patch = {};
  const text = String(change || '').toLowerCase();
  const cfg = structuredClone(game.config || {});
  let touched = false;

  // Speed modifiers
  const speedMatch = text.match(/(?:玩家|速度).{0,10}?(\d+(?:\.\d+)?)/);
  if (speedMatch && cfg.player) {
    cfg.player.speed = Math.round(Number(speedMatch[1]) * 100) / 100;
    touched = true;
  }
  if (/速度.{0,6}(调高|提高|加快|更快|加速)/.test(text) && cfg.player) {
    cfg.player.speed = Math.round((cfg.player.speed || 4) * 1.3 * 100) / 100;
    touched = true;
  }
  if (/速度.{0,6}(调低|降低|减慢|变慢|减速)/.test(text) && cfg.player) {
    cfg.player.speed = Math.round((cfg.player.speed || 4) * 0.75 * 100) / 100;
    touched = true;
  }

  // HP / difficulty modifiers
  if (/(难度.{0,6}(调高|提高|加难|地狱|hard|hell))/.test(text)) {
    if (cfg.enemy) {
      cfg.enemy.speed = Math.round((cfg.enemy.speed || 1) * 1.3 * 100) / 100;
      cfg.enemy.hp = Math.max(1, Math.round((cfg.enemy.hp || 1) * 1.4));
    }
    touched = true;
  }
  if (/(难度.{0,6}(调低|降低|简单|easy))/.test(text)) {
    if (cfg.enemy) {
      cfg.enemy.speed = Math.round((cfg.enemy.speed || 1) * 0.75 * 100) / 100;
    }
    if (cfg.player) {
      cfg.player.hp = Math.max(1, Math.round((cfg.player.hp || 1) * 1.5));
    }
    touched = true;
  }
  const hpMatch = text.match(/(?:血量|生命|hp).{0,10}?(\d+(?:\.\d+)?)/i);
  if (hpMatch && cfg.player) {
    cfg.player.hp = Math.max(1, Math.round(Number(hpMatch[1])));
    touched = true;
  }

  // Narrative / description tweaks
  if (/描述.{0,20}(?:为|改为|变成)["'「]?(.{1,80}?)(?:。|」|["']|$)/.test(text)) {
    const m = text.match(/描述.{0,20}(?:为|改为|变成)["'「]?(.{1,80}?)(?:。|」|["']|$)/);
    if (m) patch.description = m[1].trim();
  }

  if (touched) patch.config = cfg;
  return { patch };
}
