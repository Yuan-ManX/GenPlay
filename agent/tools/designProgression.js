/**
 * design_progression - Design a difficulty curve and level progression.
 * Generates a sequence of levels with escalating challenge (enemy count,
 * speed, HP, boss milestones) and reward pacing. The progression is stored
 * on game.progression and can drive procedural_level and manage_scenes tools.
 * AI-native: when LLM is available, produces genre-tailored level themes
 * and narrative beats for each milestone.
 */

// Base difficulty multipliers per level index.
const CURVE_TEMPLATES = {
  // Linear: steady difficulty ramp.
  linear: (i, total) => 1 + (i / Math.max(1, total - 1)) * 2,
  // Exponential: gentle start, steep late-game.
  exponential: (i, total) => 1 + Math.pow(i / Math.max(1, total - 1), 1.8) * 2.5,
  // Gentle: forgiving early, moderate late.
  gentle: (i, total) => 1 + (i / Math.max(1, total - 1)) * 1.5,
  // Spiky: difficulty spikes at boss levels.
  spiky: (i, total) => 1 + (i / Math.max(1, total - 1)) * 1.8 + (i % 4 === 3 ? 0.8 : 0),
};

// Genre-specific enemy count baseline.
const BASE_ENEMIES = {
  shooter: 3, platformer: 2, rpg: 1, puzzle: 0, battle: 1,
  racing: 0, simulation: 0, tower: 5, snake: 0, breakout: 0,
  maze: 0, rhythm: 0, roguelike: 3, deckbuilder: 1, metroidvania: 2,
  idle: 0, sandbox: 0, visual_novel: 0, auto_battler: 3, adventure: 2,
};

function buildProgression(genre, levelCount, curveType) {
  const total = Math.max(1, levelCount);
  const curve = CURVE_TEMPLATES[curveType] || CURVE_TEMPLATES.linear;
  const baseEnemies = BASE_ENEMIES[genre] ?? 2;
  const levels = [];

  for (let i = 0; i < total; i++) {
    const mult = curve(i, total);
    const isBoss = i === total - 1 || (total > 4 && i === Math.floor(total / 2));
    const enemyCount = isBoss
      ? Math.round(baseEnemies * mult * 1.5) + 1
      : Math.max(0, Math.round(baseEnemies * mult));
    const enemyHp = Math.round((1 + mult * 0.8) * 10) / 10;
    const enemySpeed = Math.round((1 + mult * 0.3) * 10) / 10;
    const rewardScore = Math.round(100 * (i + 1) * mult);

    levels.push({
      index: i + 1,
      name: isBoss ? `第 ${i + 1} 关 · Boss 战` : `第 ${i + 1} 关`,
      difficulty: Math.round(mult * 10) / 10,
      isBoss,
      enemies: enemyCount,
      enemyHp,
      enemySpeed,
      reward: rewardScore,
      theme: pickLevelTheme(genre, i, total, isBoss),
    });
  }

  return levels;
}

function pickLevelTheme(genre, index, total, isBoss) {
  const themes = {
    shooter: ['外围防线', '城区巷战', '能量工厂', '母舰核心'],
    platformer: ['苏醒之地', '迷雾森林', '云端高塔', '暗影之巅'],
    rpg: ['新手村', '森林小径', '古老遗迹', '邪神祭坛'],
    adventure: ['群岛入口', '遗迹外围', '宝藏密室', '远古祭坛'],
    roguelike: ['地牢一层', '腐化地窖', '骨龙巢穴', '深渊之心'],
    metroidvania: ['入口大厅', '水下通道', '熔岩深渊', '最终圣殿'],
  };
  const list = themes[genre] || ['起点', '中段', '后段', '终点'];
  if (isBoss) return list[list.length - 1] || 'Boss 战';
  return list[index % list.length] || `区域 ${index + 1}`;
}

export function designProgressionTool({ gameService, provider }) {
  return {
    name: 'design_progression',
    description: 'Design a difficulty curve and level progression. Generates levels with escalating enemy count, HP, speed, boss milestones, and reward pacing. Stored on game.progression.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        levels: { type: 'number', description: 'Number of levels to design (3-20, default 5)' },
        curve: { type: 'string', description: 'linear | exponential | gentle | spiky (default: linear)' },
        genre: { type: 'string', description: 'Game genre (uses game genre if omitted)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, levels, curve, genre, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const g = (genre || game.genre || 'adventure').toLowerCase();
      const count = typeof levels === 'number' ? Math.max(3, Math.min(20, levels)) : 5;
      const curveType = curve || 'linear';

      const levelList = buildProgression(g, count, curveType);

      // LLM enhancement: genre-tailored narrative beats per level.
      let llmEnhanced = false;
      if (provider?.enabled && provider.chat) {
        try {
          const prompt = `For a ${g} game with ${count} levels, write a one-line narrative beat for each level. ` +
            `Format as numbered list: 1. ... 2. ...`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 200 });
          if (resp?.content) {
            const lines = resp.content.split('\n').map((l) => l.trim()).filter(Boolean);
            for (let i = 0; i < levelList.length && i < lines.length; i++) {
              levelList[i].narrative = lines[i].replace(/^\d+[\.\)]\s*/, '');
            }
            llmEnhanced = true;
          }
        } catch (_) { /* fall back to template */ }
      }

      const progression = {
        genre: g,
        curve: curveType,
        levelCount: count,
        levels: levelList,
        createdAt: Date.now(),
      };

      await gameService.update(gameId, { progression });

      const bossCount = levelList.filter((l) => l.isBoss).length;
      return {
        ok: true,
        progression,
        summary: `已设计 ${count} 关进度（${curveType} 曲线），含 ${bossCount} 个 Boss 战${llmEnhanced ? '，AI 叙事增强' : ''}`,
        editorActions: [{ type: 'studio:set-progression', gameId, payload: { progression } }],
      };
    },
  };
}
