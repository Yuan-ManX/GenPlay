/**
 * manage_quests - Add, update, complete, remove or list quests stored on
 * game.quests. A quest has: id, name, desc, status, objectives[] and
 * rewards[]. Objectives track { text, done }; rewards track
 * { type, amount } (e.g. { type: 'coin', amount: 100 }).
 */

const STATUS = ['active', 'done', 'locked'];

export function manageQuestsTool({ gameService }) {
  return {
    name: 'manage_quests',
    description: 'Add, update, complete, remove or list game quests with objectives and rewards. Quests persist on game.quests and show in the studio systems panel.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'add | update | complete | remove | list' },
        questId: { type: 'string', description: 'Required for update/complete/remove' },
        name: { type: 'string' },
        desc: { type: 'string' },
        status: { type: 'string', description: `one of: ${STATUS.join(', ')}` },
        objectives: { type: 'array', items: { type: 'string' }, description: 'objective text list' },
        rewards: { type: 'array', description: 'e.g. [{ type: "coin", amount: 100 }]' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, questId, name, desc, status, objectives, rewards }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'complete', 'remove', 'list'].includes(act)) {
        return { ok: false, error: 'action must be add | update | complete | remove | list' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const quests = Array.isArray(game.quests) ? structuredClone(game.quests) : [];

      if (act === 'list') {
        return {
          ok: true,
          quests,
          summary: `当前共 ${quests.length} 个任务（${quests.filter((q) => q.status === 'done').length} 个已完成）`,
          editorActions: [{ type: 'studio:patch-quests', gameId, payload: { action: 'list', quests } }],
        };
      }

      let target = null;
      let summary = '';

      if (act === 'add') {
        target = {
          id: questId || `quest_${Date.now().toString(36)}`,
          name: name || '新任务',
          desc: desc || '完成任务目标获取奖励',
          status: STATUS.includes(status) ? status : 'active',
          objectives: normalizeObjectives(objectives),
          rewards: normalizeRewards(rewards),
        };
        quests.push(target);
        summary = `已添加任务「${target.name}」（${target.objectives.length} 个目标）`;
      } else {
        const idx = quests.findIndex((q) => q.id === questId || q.name === questId);
        if (idx === -1) return { ok: false, error: `Quest not found: ${questId}` };
        target = quests[idx];
        if (act === 'update') {
          if (name) target.name = name;
          if (desc) target.desc = desc;
          if (STATUS.includes(status)) target.status = status;
          if (objectives) target.objectives = normalizeObjectives(objectives);
          if (rewards) target.rewards = normalizeRewards(rewards);
          summary = `已更新任务「${target.name}」`;
        } else if (act === 'complete') {
          target.status = 'done';
          target.objectives = (target.objectives || []).map((o) => ({ ...o, done: true }));
          summary = `任务「${target.name}」已标记完成，奖励待发放`;
        } else { // remove
          quests.splice(idx, 1);
          summary = `已移除任务「${target.name}」`;
        }
      }

      const updated = await gameService.update(gameId, { quests });
      return {
        ok: true,
        game: updated,
        quests,
        quest: target,
        summary,
        editorActions: [{
          type: 'studio:patch-quests',
          gameId,
          payload: { action: act, quest: target, quests },
        }],
      };
    },
  };
}

function normalizeObjectives(list) {
  if (!Array.isArray(list) || !list.length) return [{ text: '完成一局游戏', done: false }];
  return list.map((o) => (typeof o === 'string' ? { text: o, done: false } : { text: o.text || '目标', done: !!o.done }));
}

function normalizeRewards(list) {
  if (!Array.isArray(list) || !list.length) return [{ type: 'coin', amount: 100 }];
  return list.map((r) => ({ type: r.type || 'coin', amount: Number(r.amount) || 0 }));
}
