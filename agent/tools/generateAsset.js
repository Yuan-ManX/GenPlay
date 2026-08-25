/**
 * generateAsset tool - Produce structured asset specs for sprites,
 * characters, items, tiles, music, SFX and UI. Couples with the frontend
 * asset generator panel. When LLM is enabled, the tool writes richer
 * visual prompts; otherwise it falls back to genre-driven presets.
 */
const ASSET_TYPES = ['sprite', 'character', 'item', 'tile', 'background', 'music', 'sfx', 'ui'];

const PRESETS = {
  cyberpunk: {
    sprite: { palette: ['#0ff0fc', '#ff2a6d', '#05d9e8', '#d1f7ff', '#01012b'], style: 'neon-glow', shape: 'angular' },
    character: { palette: ['#ff2a6d', '#05d9e8', '#2de2e6', '#f9f002'], outfit: 'jacket + neon visor' },
    background: { palette: ['#0d0221', '#0f0c29', '#302b63', '#24243e'], lighting: 'neon signs + rain' },
    music: { bpm: 118, mood: 'synthwave', instruments: ['synth_bass', 'lead_pluck', 'arpeggiator'] },
  },
  retro_pixel: {
    sprite: { palette: ['#fc5603', '#00d9ff', '#ffeb00', '#8bff00', '#2d1b00'], style: '8-bit', shape: 'rounded' },
    character: { palette: ['#ffe6c0', '#7a3e00', '#005f99', '#d03030'], outfit: 'tunic + boots' },
    background: { palette: ['#5bc0de', '#83c05c', '#a06a3a', '#2d2d2d'], lighting: 'flat daylight' },
    music: { bpm: 140, mood: 'chiptune', instruments: ['square_wave', 'triangle', 'noise_drum'] },
  },
  sakura: {
    sprite: { palette: ['#ffb7c5', '#ffd6e0', '#ffffff', '#c96b8a', '#6b4e71'], style: 'soft-pink', shape: 'floral' },
    character: { palette: ['#ffe4ec', '#ff9ebb', '#8b5e83', '#5a4a7a'], outfit: 'sakura kimono' },
    background: { palette: ['#ffe4ec', '#ffd3e0', '#8b5e83', '#5a4a7a'], lighting: 'sunset petals' },
    music: { bpm: 84, mood: 'ambient_japanese', instruments: ['koto', 'shakuhachi', 'soft_pad'] },
  },
  sunset: {
    sprite: { palette: ['#ff512f', '#f09819', '#dd2476', '#ff5858', '#ffc371'], style: 'warm-gradient', shape: 'silhouette' },
    background: { palette: ['#1a2a6c', '#b21f1f', '#fdbb2d', '#ff512f'], lighting: 'sunset horizon' },
    music: { bpm: 96, mood: 'chill_synth', instruments: ['warm_pad', 'rhodes', 'shaker'] },
  },
  ocean: {
    sprite: { palette: ['#00c9ff', '#0575e6', '#00f260', '#028090', '#00a8e8'], style: 'bubble-shine', shape: 'organic' },
    background: { palette: ['#000428', '#004e92', '#028090', '#00c9ff'], lighting: 'caustics + depth' },
    music: { bpm: 72, mood: 'ambient_ocean', instruments: ['pad', 'water_sfx', 'delayed_piano'] },
  },
  forest: {
    sprite: { palette: ['#134e5e', '#71b280', '#a8e063', '#56ab2f', '#3a1c71'], style: 'organic-green', shape: 'leafy' },
    background: { palette: ['#1d4350', '#a43931', '#134e5e', '#71b280'], lighting: 'sun rays through canopy' },
    music: { bpm: 90, mood: 'acoustic_folk', instruments: ['acoustic_guitar', 'flute', 'tambourine'] },
  },
  arcade: {
    sprite: { palette: ['#ff0080', '#00ffea', '#faff00', '#8338ec', '#3a86ff'], style: 'high-contrast', shape: 'sharp' },
    background: { palette: ['#000000', '#0a0a0a', '#1a0033', '#000033'], lighting: 'CRT scanlines' },
    music: { bpm: 156, mood: 'eurodance', instruments: ['saw_lead', 'four_to_floor', 'stab_horn'] },
  },
};

export function generateAssetTool(services = {}) {
  const { provider, artifactMemory } = services;
  return {
    name: 'generate_asset',
    description: 'Generate structured asset specifications (sprites, characters, items, tiles, backgrounds, music, SFX, UI). When paired with LLM, writes detailed visual prompts and procedural audio params.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        assetType: { type: 'string', description: 'One of: sprite, character, item, tile, background, music, sfx, ui' },
        themeKey: { type: 'string', description: 'Optional theme to align with' },
        name: { type: 'string', description: 'Asset name / identifier' },
        count: { type: 'integer', description: 'Number of variants to generate' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['assetType'],
    },
    async execute({ gameId, assetType, themeKey, name, count = 1, tags = [], sessionId }) {
      const type = String(assetType || '').toLowerCase();
      if (!ASSET_TYPES.includes(type)) {
        return { ok: false, error: `未知资源类型 ${assetType}，支持: ${ASSET_TYPES.join(', ')}` };
      }
      const theme = themeKey || PRESETS[themeKey] ? themeKey : 'retro_pixel';
      const preset = PRESETS[theme] || PRESETS.retro_pixel;
      const base = preset[type] || preset.sprite || { palette: ['#ffffff', '#000000'] };

      let variants = [];
      if (provider?.enabled && name) {
        variants = await llmVars(provider, type, name, count, theme, base);
      } else {
        variants = ruleVars(type, name || `asset_${Date.now()}`, count, base);
      }

      // Record in artifact memory
      const ids = [];
      for (const v of variants) {
        const id = `${type}_${v.key}_${Math.floor(Math.random() * 10000)}`;
        artifactMemory?.recordAsset?.(id, { type, name: v.name, theme, tags, spec: v });
        ids.push(id);
      }

      const actions = [{
        type: 'studio:receive-assets',
        payload: { gameId, assetType: type, assets: variants, ids },
      }];

      return {
        ok: true,
        summary: `生成 ${variants.length} 个 ${type} 资源（${theme} 主题）`,
        assetType: type,
        theme,
        assets: variants,
        asset: variants[0],
        assetIds: ids,
        editorActions: [
          {
            type: 'studio:add-asset',
            payload: { gameId, assetType: type, asset: variants[0], assets: variants, ids },
          },
          ...actions,
        ],
      };
    },
  };
}

function ruleVars(type, baseName, count, base) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const key = `${baseName}_${i + 1}`;
    const palette = shuffle(base.palette || ['#ffffff', '#000000']);
    out.push({
      key,
      name: i === 0 ? baseName : `${baseName} #${i + 1}`,
      type,
      palette,
      style: base.style,
      shape: base.shape,
      outfit: base.outfit,
      lighting: base.lighting,
      instruments: base.instruments,
      bpm: base.bpm,
      mood: base.mood,
      prompt: `${type} ${key} - style:${base.style || 'clean'} palette:${palette.slice(0, 3).join(',')}`,
      variant: i + 1,
    });
  }
  return out;
}

async function llmVars(provider, type, baseName, count, theme, base) {
  const schema = {
    type: 'object',
    properties: {
      assets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            name: { type: 'string' },
            palette: { type: 'array', items: { type: 'string' } },
            style: { type: 'string' },
            prompt: { type: 'string', description: 'Detailed image/audio generation prompt' },
            notes: { type: 'string' },
          },
          required: ['key', 'name', 'palette', 'prompt'],
        },
      },
    },
    required: ['assets'],
  };
  const sys = 'You are GenPlay asset designer. Design original game assets matching the type, theme, and base palette. Each asset needs a distinct name, palette, and a concise specific prompt suitable for image/audio generation.';
  const input = JSON.stringify({ asset_type: type, base_name: baseName, count, theme, base });
  const res = await provider.json({ systemPrompt: sys, userMessage: input, schema, temperature: 0.8 });
  if (!res?.assets?.length) return ruleVars(type, baseName, count, base);
  return res.assets.map((a, i) => ({
    key: a.key || `${baseName}_${i + 1}`,
    name: a.name || `${baseName} #${i + 1}`,
    type,
    palette: a.palette || base.palette,
    style: a.style || base.style,
    shape: base.shape,
    outfit: base.outfit,
    lighting: base.lighting,
    instruments: base.instruments,
    bpm: base.bpm,
    mood: base.mood,
    prompt: a.prompt,
    notes: a.notes,
    variant: i + 1,
  }));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
