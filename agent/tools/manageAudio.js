/**
 * manage_audio - Manage background music playlist and sound effects.
 * Stores an ordered music playlist and a sound-effect bank on game.audio.
 * Each playlist entry has: id, name, mood, url (optional), volume, loop.
 * Each SFX entry has: id, name, trigger, url (optional), volume.
 * AI-native: the agent can describe desired music mood and the tool records
 * it as a prompt field for later asset generation.
 */

export function manageAudioTool({ gameService }) {
  return {
    name: 'manage_audio',
    description: 'Manage background music playlist and sound effects. Add, update, remove, reorder or list music tracks and SFX. Each track has name, mood, volume, loop; each SFX has name and trigger.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        kind: { type: 'string', description: 'music | sfx' },
        action: { type: 'string', description: 'add | update | remove | list | reorder | play' },
        entryId: { type: 'string', description: 'Required for update/remove/play' },
        name: { type: 'string' },
        mood: { type: 'string', description: 'Music mood: epic | calm | tense | happy | sad | mysterious | battle' },
        trigger: { type: 'string', description: 'SFX trigger event: onHit | onShoot | onJump | onPickup | onWin | onLose | onButton' },
        volume: { type: 'number', description: '0.0 - 1.0' },
        loop: { type: 'boolean' },
        prompt: { type: 'string', description: 'AI generation prompt for the audio asset' },
        order: { type: 'array', description: 'Array of entry ids in desired order (reorder action)' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, kind, action, entryId, name, mood, trigger, volume, loop, prompt, order, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'remove', 'list', 'reorder', 'play'].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove | list | reorder | play' };
      }
      const k = (kind || 'music').toLowerCase();
      if (!['music', 'sfx'].includes(k)) return { ok: false, error: 'kind must be music | sfx' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const audio = structuredClone(game.audio || {});
      const playlist = Array.isArray(audio.playlist) ? structuredClone(audio.playlist) : [];
      const sfxBank = Array.isArray(audio.sfx) ? structuredClone(audio.sfx) : [];
      const list = k === 'music' ? playlist : sfxBank;
      const field = k === 'music' ? 'playlist' : 'sfx';

      if (act === 'list') {
        return {
          ok: true,
          [field]: list,
          summary: `当前共 ${list.length} 个${k === 'music' ? '音乐' : '音效'}`,
          editorActions: [{ type: 'studio:patch-audio', gameId, payload: { kind: k, action: 'list', [field]: list } }],
        };
      }

      if (act === 'reorder') {
        if (!Array.isArray(order) || !order.length) return { ok: false, error: 'order must be a non-empty array of ids' };
        const idMap = new Map(list.map((e) => [e.id, e]));
        const reordered = order.map((id) => idMap.get(id)).filter(Boolean);
        const mentioned = new Set(order);
        for (const e of list) if (!mentioned.has(e.id)) reordered.push(e);
        audio[field] = reordered;
        const updated = await gameService.update(gameId, { audio });
        return {
          ok: true, game: updated, [field]: reordered,
          summary: `已重排 ${reordered.length} 个${k === 'music' ? '音乐' : '音效'}`,
          editorActions: [{ type: 'studio:patch-audio', gameId, payload: { kind: k, action: 'reorder', [field]: reordered } }],
        };
      }

      if (act === 'play') {
        const entry = list.find((e) => e.id === entryId || e.name === entryId);
        if (!entry) return { ok: false, error: `${k} entry not found: ${entryId}` };
        return {
          ok: true,
          playing: entry,
          summary: `正在播放「${entry.name}」`,
          editorActions: [{ type: 'studio:play-audio', gameId, payload: { kind: k, entry } }],
        };
      }

      let target = null;
      let changed = false;
      let summary = '';

      if (act === 'add') {
        target = {
          id: entryId || `${k}_${Date.now().toString(36)}`,
          name: name || (k === 'music' ? '新音乐' : '新音效'),
          volume: typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 0.8,
          ...(k === 'music'
            ? { mood: mood || 'calm', loop: loop ?? true, prompt: prompt || '' }
            : { trigger: trigger || 'onButton', prompt: prompt || '' }),
        };
        list.push(target);
        changed = true;
        summary = `已添加${k === 'music' ? '音乐' : '音效'}「${target.name}」`;
      } else {
        const idx = list.findIndex((e) => e.id === entryId || e.name === entryId);
        if (idx === -1) return { ok: false, error: `${k} entry not found: ${entryId}` };
        target = list[idx];
        if (act === 'update') {
          if (name) target.name = name;
          if (typeof volume === 'number') target.volume = Math.max(0, Math.min(1, volume));
          if (k === 'music') {
            if (mood) target.mood = mood;
            if (loop !== undefined) target.loop = loop;
          } else {
            if (trigger) target.trigger = trigger;
          }
          if (prompt !== undefined) target.prompt = prompt;
          changed = true;
          summary = `已更新${k === 'music' ? '音乐' : '音效'}「${target.name}」`;
        } else { // remove
          list.splice(idx, 1);
          changed = true;
          summary = `已移除${k === 'music' ? '音乐' : '音效'}「${target.name}」`;
        }
      }

      let updated = game;
      if (changed) {
        audio[field] = list;
        updated = await gameService.update(gameId, { audio });
      }

      return {
        ok: true, game: updated, [field]: list, entry: target, summary,
        editorActions: [{ type: 'studio:patch-audio', gameId, payload: { kind: k, action: act, entry: target, [field]: list } }],
      };
    },
  };
}
