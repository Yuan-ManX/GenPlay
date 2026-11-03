/**
 * manage_audio - Manage background music playlist and sound effects.
 * Stores an ordered music playlist and a sound-effect bank on game.audio.
 * Each playlist entry has: id, name, mood, url (optional), volume, loop.
 * Each SFX entry has: id, name, trigger, url (optional), volume.
 * AI-native: the agent can describe desired music mood and the tool records
 * it as a prompt field for later asset generation.
 * Runtime actions (mute / unmute / volume / stop / play) emit live audio
 * commands so the studio preview responds without reloading the page.
 */

export function manageAudioTool({ gameService }) {
  return {
    name: 'manage_audio',
    description: 'Manage background music playlist and sound effects, and control live playback. Add, update, remove, reorder or list music tracks and SFX. Runtime actions mute/unmute/volume/stop/play command the studio preview audio engine directly.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        kind: { type: 'string', description: 'music | sfx' },
        action: { type: 'string', description: 'add | update | remove | list | reorder | play | mute | unmute | volume | stop' },
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
      const RUN_ACTIONS = ['mute', 'unmute', 'volume', 'stop'];
      if (!['add', 'update', 'remove', 'list', 'reorder', 'play', ...RUN_ACTIONS].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove | list | reorder | play | mute | unmute | volume | stop' };
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

      // Live playback controls: persist master state so the setting survives
      // reloads, and emit a runtime command the preview consumes immediately.
      if (RUN_ACTIONS.includes(act)) {
        const master = { ...(audio.master || {}) };
        if (act === 'mute') master.muted = true;
        else if (act === 'unmute') master.muted = false;
        else if (act === 'volume') {
          let v = Number(volume);
          if (!Number.isFinite(v)) return { ok: false, error: 'volume must be a number between 0 and 1' };
          if (v > 1) v /= 100;
          master.volume = Math.max(0, Math.min(1, v));
        } else master.stopped = true;
        if (act !== 'stop') master.stopped = false;
        audio.master = master;
        const updated = await gameService.update(gameId, { audio });
        const labels = { mute: '已静音', unmute: '已取消静音', volume: `音量已设为 ${Math.round((master.volume ?? 0) * 100)}%`, stop: '已停止播放' };
        return {
          ok: true,
          game: updated,
          master,
          summary: labels[act],
          editorActions: [{
            type: 'studio:audio-command',
            gameId,
            payload: { command: act === 'volume' ? 'volume' : act, value: master.volume, muted: !!master.muted },
          }],
        };
      }

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
        const composed = Array.isArray(audio.composed) ? audio.composed : [];
        // Resolve the requested entry; when the user just says "播放背景音乐"
        // fall back to the first playlist item, then to the first composed track.
        const entry = entryId
          ? list.find((e) => e.id === entryId || e.name === entryId)
          : list[0];
        if (entry) {
          // Prefer a composed track matching the entry mood so the live preview
          // has concrete note data to schedule.
          const track = composed.find((t) => t && t.mood === entry.mood) || composed[0] || null;
          return {
            ok: true,
            playing: entry,
            track,
            summary: `正在播放「${entry.name}」`,
            editorActions: [{ type: 'studio:audio-command', gameId, payload: { command: 'play', entry, track } }],
          };
        }
        if (composed.length) {
          const track = composed[0];
          return {
            ok: true,
            playing: track,
            track,
            summary: `正在播放作曲「${track.name || track.mood}」`,
            editorActions: [{
              type: 'studio:audio-command',
              gameId,
              payload: { command: 'play', entry: { id: track.id || track.mood, name: track.name || track.mood, mood: track.mood }, track },
            }],
          };
        }
        return { ok: false, error: `${k} entry not found: ${entryId || '(empty playlist)'}` };
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
