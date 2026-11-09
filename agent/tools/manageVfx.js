/**
 * manage_vfx - Add, update, remove or list ambient particle effects stored on
 * game.vfx. Effects are rendered live by the studio preview and are embedded
 * into the standalone playable build via the shared runtime FX layer.
 * Each effect has: id, name, preset, intensity, color, speed, enabled.
 */

// Preset keys must stay in sync with FX_PRESETS in web/src/gameplay/engine.js.
const PRESETS = ['rain', 'snow', 'petals', 'sparks', 'bubbles', 'stars', 'embers', 'confetti'];
const PRESET_LABELS = {
  rain: '下雨', snow: '下雪', petals: '花瓣', sparks: '火花',
  bubbles: '气泡', stars: '星光', embers: '余烬', confetti: '彩带',
};

export function manageVfxTool({ gameService }) {
  return {
    name: 'manage_vfx',
    description: 'Add, update, remove or list ambient particle effects (rain, snow, petals, sparks, bubbles, stars, embers, confetti). Effects render live in the preview and in exported playable builds.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'add | update | remove | list' },
        vfxId: { type: 'string', description: 'Required for update/remove' },
        preset: { type: 'string', description: `one of: ${PRESETS.join(', ')}` },
        name: { type: 'string' },
        intensity: { type: 'number', description: 'particle density scale 0.2 - 2' },
        color: { type: 'string', description: 'hex color override, e.g. #fbbf24' },
        speed: { type: 'number', description: 'velocity scale 0.2 - 3' },
        enabled: { type: 'boolean' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, vfxId, preset, name, intensity, color, speed, enabled }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'remove', 'list'].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove | list' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const effects = Array.isArray(game.vfx) ? structuredClone(game.vfx) : [];

      if (act === 'list') {
        return {
          ok: true,
          vfx: effects,
          summary: `当前共 ${effects.length} 个粒子特效`,
          editorActions: [{ type: 'studio:patch-vfx', gameId, payload: { action: 'list', vfx: effects } }],
        };
      }

      let target = null;
      let summary = '';

      if (act === 'add') {
        const key = PRESETS.includes(preset) ? preset : 'stars';
        target = {
          id: vfxId || `vfx_${Date.now().toString(36)}`,
          name: name || `${PRESET_LABELS[key]}氛围`,
          preset: key,
          intensity: clampNum(intensity, 0.2, 2, 1),
          color: color || null,
          speed: clampNum(speed, 0.2, 3, 1),
          enabled: enabled ?? true,
        };
        effects.push(target);
        summary = `已添加粒子特效「${target.name}」（${PRESET_LABELS[target.preset]}），预览与导出游戏都会实时渲染`;
      } else {
        const idx = effects.findIndex((e) => e.id === vfxId || e.name === vfxId || e.preset === vfxId);
        if (idx === -1) return { ok: false, error: `VFX not found: ${vfxId}` };
        target = effects[idx];
        if (act === 'update') {
          if (preset && PRESETS.includes(preset)) target.preset = preset;
          if (name) target.name = name;
          if (intensity !== undefined) target.intensity = clampNum(intensity, 0.2, 2, target.intensity);
          if (color !== undefined) target.color = color;
          if (speed !== undefined) target.speed = clampNum(speed, 0.2, 3, target.speed);
          if (enabled !== undefined) target.enabled = enabled;
          summary = `已更新粒子特效「${target.name}」`;
        } else { // remove
          effects.splice(idx, 1);
          summary = `已移除粒子特效「${target.name}」`;
        }
      }

      const updated = await gameService.update(gameId, { vfx: effects });
      return {
        ok: true,
        game: updated,
        vfx: effects,
        effect: target,
        summary,
        editorActions: [{
          type: 'studio:patch-vfx',
          gameId,
          payload: { action: act, effect: target, vfx: effects },
        }],
      };
    },
  };
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
