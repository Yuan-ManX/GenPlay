/**
 * manage_achievements - Add, update, remove or list achievements stored on
 * game.meta.achievements. Replaces the previously hardcoded frontend defaults
 * with a persisted, agent-controllable achievement system.
 * Each achievement has: id, name, desc, condition, icon, unlocked.
 */

const DEFAULT_ACHIEVEMENTS = [
  { id: 'ach_first_win', name: '初次胜利', desc: '完成第一局游戏', condition: 'wins >= 1', icon: '🏆', unlocked: false },
  { id: 'ach_high_score', name: '高分猎手', desc: '单局得分超过 1000', condition: 'score >= 1000', icon: '🎯', unlocked: false },
  { id: 'ach_perfect', name: '完美通关', desc: '不损失一命通过', condition: 'deaths == 0', icon: '⭐', unlocked: false },
];

export function manageAchievementsTool({ gameService }) {
  return {
    name: 'manage_achievements',
    description: 'Add, update, remove or list game achievements. Each achievement tracks name, description, unlock condition, icon and unlock state.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'add | update | remove | list' },
        achievementId: { type: 'string', description: 'Required for update/remove' },
        name: { type: 'string' },
        desc: { type: 'string' },
        condition: { type: 'string', description: 'e.g. "score >= 1000" or "wins >= 5"' },
        icon: { type: 'string' },
        unlocked: { type: 'boolean' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, achievementId, name, desc, condition, icon, unlocked, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'remove', 'list'].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove | list' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      // Achievements live on game.meta.achievements for frontend parity.
      const meta = structuredClone(game.meta || {});
      const achievements = Array.isArray(meta.achievements)
        ? structuredClone(meta.achievements)
        : structuredClone(DEFAULT_ACHIEVEMENTS);

      let target = null;
      let changed = false;
      let summary = '';

      if (act === 'list') {
        return {
          ok: true,
          achievements,
          summary: `当前共 ${achievements.length} 个成就`,
          editorActions: [{
            type: 'studio:patch-achievements',
            gameId,
            payload: { action: 'list', achievements },
          }],
        };
      }

      if (act === 'add') {
        target = {
          id: achievementId || `ach_${Date.now().toString(36)}`,
          name: name || '新成就',
          desc: desc || '达成特定条件解锁',
          condition: condition || 'score >= 100',
          icon: icon || '🏅',
          unlocked: unlocked ?? false,
        };
        achievements.push(target);
        changed = true;
        summary = `已添加成就「${target.name}」`;
      } else {
        const idx = achievements.findIndex((a) => a.id === achievementId || a.name === achievementId);
        if (idx === -1) return { ok: false, error: `Achievement not found: ${achievementId}` };
        target = achievements[idx];
        if (act === 'update') {
          if (name) target.name = name;
          if (desc) target.desc = desc;
          if (condition) target.condition = condition;
          if (icon) target.icon = icon;
          if (unlocked !== undefined) target.unlocked = unlocked;
          changed = true;
          summary = `已更新成就「${target.name}」`;
        } else { // remove
          achievements.splice(idx, 1);
          changed = true;
          summary = `已移除成就「${target.name}」`;
        }
      }

      let updated = game;
      if (changed) {
        meta.achievements = achievements;
        updated = await gameService.update(gameId, { meta });
      }

      return {
        ok: true,
        game: updated,
        achievements,
        achievement: target,
        summary,
        editorActions: [{
          type: 'studio:patch-achievements',
          gameId,
          payload: { action: act, achievement: target, achievements },
        }],
      };
    },
  };
}
