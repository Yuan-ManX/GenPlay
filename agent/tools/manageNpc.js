/**
 * manage_npc - Add, update, or remove a single NPC in game.npcs.
 * Granular counterpart to generate_npc (which bulk-creates NPCs).
 * Returns the updated NPC list and emits a live editor action.
 */

const ARCHETYPES = ['merchant', 'blacksmith', 'guide', 'healer', 'rival', 'bard', 'guard', 'child', 'elder', 'innkeeper'];
const PERSONALITIES = ['cheerful', 'grumpy', 'mysterious', 'shy', 'arrogant', 'wise', 'nervous', 'jolly', 'cunning', 'noble'];

export function manageNpcTool({ gameService }) {
  return {
    name: 'manage_npc',
    description: 'Add, update, or remove a single NPC by id. Controls name, role, dialog, personality and traits.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'add | update | remove' },
        npcId: { type: 'string', description: 'Required for update/remove' },
        name: { type: 'string' },
        role: { type: 'string' },
        dialog: { type: 'string' },
        personality: { type: 'string' },
        traits: { type: 'object' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, npcId, name, role, dialog, personality, traits, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'remove'].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const npcs = Array.isArray(game.npcs) ? structuredClone(game.npcs) : [];
      let changed = false;
      let target = null;

      if (act === 'add') {
        target = {
          id: npcId || `npc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          name: name || '无名旅人',
          role: role || 'Villager',
          personality: personality || PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
          dialog: dialog || '你好，旅行者。',
          traits: traits || {},
          affinity: 0,
        };
        npcs.push(target);
        changed = true;
      } else {
        const idx = npcs.findIndex((n) => n.id === npcId || n.name === npcId);
        if (idx === -1) return { ok: false, error: `NPC not found: ${npcId}` };
        target = npcs[idx];
        if (act === 'update') {
          if (name) target.name = name;
          if (role) target.role = role;
          if (dialog) target.dialog = dialog;
          if (personality) target.personality = personality;
          if (traits) target.traits = { ...(target.traits || {}), ...traits };
          changed = true;
        } else { // remove
          npcs.splice(idx, 1);
          changed = true;
        }
      }

      let updated = game;
      if (changed) {
        updated = await gameService.update(gameId, { npcs });
      }

      const editorActions = [{
        type: 'studio:patch-npcs',
        gameId,
        payload: { action: act, npc: target, npcs },
      }];

      const summary = act === 'add'
        ? `已添加 NPC「${target.name}」（${target.role}）`
        : act === 'update'
          ? `已更新 NPC「${target.name}」`
          : `已移除 NPC「${target.name}」`;

      return {
        ok: true,
        game: updated,
        npcs,
        npc: target,
        editorActions,
        summary,
      };
    },
  };
}
