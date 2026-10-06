/**
 * analyze_fun_factor - Evaluate game "fun" based on mechanics diversity,
 * feedback loops, progression depth, replayability, and engagement patterns.
 * Produces a structured fun assessment with genre-aware scoring and
 * actionable suggestions. Complements game_analytics (which simulates
 * player behavior) by evaluating design quality from a game-design lens.
 * AI-native: when LLM is available, generates a tailored fun analysis.
 */

// Weights for each fun dimension (sum to 1.0).
const DIMENSIONS = {
  mechanics: 0.20,
  feedback: 0.15,
  progression: 0.15,
  challenge: 0.15,
  replayability: 0.15,
  polish: 0.10,
  innovation: 0.10,
};

// Genre-specific expected mechanics.
const GENRE_MECHANICS = {
  shooter: ['射击', 'Boss', '道具', '连击', '波次'],
  platformer: ['跳跃', '平台', '收集', '陷阱', 'Boss'],
  rpg: ['升级', '装备', '任务', '战斗', '商店'],
  puzzle: ['消除', '连锁', '限时', '特殊', '关卡'],
  tower: ['塔', '升级', '波次', '路径', '金币'],
  roguelike: ['随机', '遗物', '永久死亡', '背包', '地牢'],
  racing: ['加速', '漂移', '道具', '圈数', '排名'],
  rhythm: ['节拍', '连击', '判定', '多轨', '难度'],
};

function scoreMechanics(game) {
  const genre = (game.genre || '').toLowerCase();
  const expected = GENRE_MECHANICS[genre] || [];
  if (!expected.length) return 0.5;
  const scripts = (game.scripts || '').toLowerCase();
  const config = game.config || {};
  const configStr = JSON.stringify(config).toLowerCase();
  const allText = scripts + ' ' + configStr;
  let matched = 0;
  for (const kw of expected) {
    if (allText.includes(kw.toLowerCase())) matched++;
  }
  return Math.min(1, matched / expected.length);
}

function scoreFeedback(game) {
  let score = 0;
  const audio = game.audio || {};
  if (Array.isArray(audio.sfx) && audio.sfx.length > 0) score += 0.3;
  if (Array.isArray(audio.playlist) && audio.playlist.length > 0) score += 0.2;
  const scripts = game.scripts || '';
  if (/score|分数|combo|连击|popup|飞字|float/i.test(scripts)) score += 0.25;
  if (/shake|震屏|flash|闪烁|particle|粒子/i.test(scripts)) score += 0.25;
  return Math.min(1, score);
}

function scoreProgression(game) {
  let score = 0;
  const scenes = Array.isArray(game.scenes) ? game.scenes.length : 0;
  if (scenes >= 3) score += 0.3;
  else if (scenes >= 1) score += 0.15;
  if (game.progression?.levels?.length >= 3) score += 0.3;
  const meta = game.meta || {};
  if (Array.isArray(meta.achievements) && meta.achievements.length >= 2) score += 0.2;
  const config = game.config || {};
  if (config.winCondition?.type && config.winCondition.type !== 'endless') score += 0.2;
  return Math.min(1, score);
}

function scoreChallenge(game) {
  let score = 0.3; // base for having a game
  const config = game.config || {};
  if (config.enemy?.count >= 3) score += 0.2;
  if (config.enemy?.speed >= 2) score += 0.15;
  if (config.winCondition?.threshold >= 500) score += 0.15;
  if (config.player?.hp && config.player.hp <= 100) score += 0.1; // risk/reward
  const scenes = Array.isArray(game.scenes) ? game.scenes : [];
  if (scenes.some((s) => s.type === 'boss')) score += 0.1;
  return Math.min(1, score);
}

function scoreReplayability(game) {
  let score = 0.2;
  const genre = (game.genre || '').toLowerCase();
  const replayGenres = ['roguelike', 'puzzle', 'rhythm', 'battle', 'auto_battler'];
  if (replayGenres.includes(genre)) score += 0.3;
  const meta = game.meta || {};
  if (Array.isArray(meta.leaderboards) && meta.leaderboards.length > 0) score += 0.2;
  const config = game.config || {};
  if (config.winCondition?.type === 'score') score += 0.15;
  if (game.scripts && /random|随机|seed|seed/i.test(game.scripts)) score += 0.15;
  return Math.min(1, score);
}

function scorePolish(game) {
  let score = 0;
  if (game.theme && game.theme !== 'default') score += 0.2;
  if (Array.isArray(game.npcs) && game.npcs.length > 0) score += 0.15;
  if (game.story?.chapters?.length >= 2) score += 0.15;
  const assets = Array.isArray(game.assets) ? game.assets : [];
  if (assets.length >= 2) score += 0.15;
  if (game.scenario && game.scenario.length > 10) score += 0.15;
  if (game.description && game.description.length > 10) score += 0.1;
  if (game.lastAccessibility?.score >= 70) score += 0.1;
  if (game.lastLint?.summary?.errors === 0) score += 0.1;
  return Math.min(1, score);
}

function scoreInnovation(game) {
  let score = 0.3;
  const mechanics = Array.isArray(game.mechanics) ? game.mechanics : [];
  if (mechanics.length >= 4) score += 0.3;
  // Check for cross-genre mechanics (unusual combinations).
  const genre = (game.genre || '').toLowerCase();
  const scripts = (game.scripts || '').toLowerCase();
  const crossGenre = {
    shooter: ['puzzle', 'rhythm', 'craft'],
    puzzle: ['shooter', 'rpg', 'story'],
    rpg: ['tower', 'rhythm', 'roguelike'],
  };
  const crossover = crossGenre[genre] || [];
  if (crossover.some((c) => scripts.includes(c))) score += 0.2;
  if (game.meta?.multiplayer?.enabled) score += 0.2;
  return Math.min(1, score);
}

export function analyzeFunFactorTool({ gameService, provider }) {
  return {
    name: 'analyze_fun_factor',
    description: 'Evaluate game fun based on mechanics diversity, feedback loops, progression, challenge, replayability, polish, and innovation. Returns a structured score with actionable suggestions.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const scores = {
        mechanics: scoreMechanics(game),
        feedback: scoreFeedback(game),
        progression: scoreProgression(game),
        challenge: scoreChallenge(game),
        replayability: scoreReplayability(game),
        polish: scorePolish(game),
        innovation: scoreInnovation(game),
      };

      // Weighted total.
      const total = Object.entries(DIMENSIONS).reduce(
        (sum, [key, weight]) => sum + scores[key] * weight,
        0,
      );
      const funScore = Math.round(total * 100);
      const grade = funScore >= 80 ? 'S' : funScore >= 65 ? 'A' : funScore >= 50 ? 'B' : funScore >= 35 ? 'C' : 'D';

      // Generate suggestions for lowest-scoring dimensions.
      const suggestions = [];
      const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
      for (const [dim, score] of sorted.slice(0, 3)) {
        if (score < 0.6) {
          suggestions.push({
            dimension: dim,
            score: Math.round(score * 100),
            suggestion: SUGGESTIONS[dim](game),
          });
        }
      }

      // LLM enhancement: natural-language fun analysis.
      let analysis = '';
      if (provider?.enabled && provider.chat) {
        try {
          const dims = Object.entries(scores).map(([k, v]) => `${k}: ${Math.round(v * 100)}`).join(', ');
          const prompt = `Analyze this ${game.genre} game's fun factor. Scores: ${dims}. Overall: ${funScore}/100. Top issue: ${suggestions[0]?.dimension || 'none'}. Write a 2-sentence analysis in Chinese.`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 120 });
          if (resp?.content) analysis = resp.content.trim();
        } catch (_) { /* fall back */ }
      }

      const report = {
        scores,
        total: funScore,
        grade,
        suggestions,
        analysis,
        checkedAt: Date.now(),
      };

      const updatedGame = await gameService.update(gameId, { lastFunFactor: report });

      return {
        ok: true,
        report,
        // Return the updated game so the orchestrator's gameSnap refreshes
        // and the self-reflector can read lastFunFactor without an extra fetch.
        game: updatedGame || { ...game, lastFunFactor: report },
        gameId,
        summary: `趣味评估：${grade} 级（${funScore} 分）${suggestions.length ? `，建议优化：${suggestions.map((s) => s.dimension).join('、')}` : ''}`,
        editorActions: [{ type: 'studio:show-fun-factor', gameId, payload: report }],
      };
    },
  };
}

const SUGGESTIONS = {
  mechanics: (game) => {
    const genre = (game.genre || '').toLowerCase();
    const expected = GENRE_MECHANICS[genre] || [];
    return `补充${genre}类型的核心机制：${expected.slice(0, 3).join('、')}`;
  },
  feedback: (game) => '添加音效、粒子特效、屏幕震动等反馈，增强打击感',
  progression: (game) => '设计多关卡进度和成就系统，给玩家明确的成长目标',
  challenge: (game) => '增加敌人数量、Boss 战或限时挑战，提升游戏难度曲线',
  replayability: (game) => '加入排行榜、随机元素或高分挑战，提高重复游玩价值',
  polish: (game) => '应用视觉主题、添加 NPC 对话、编写剧情，提升整体品质',
  innovation: (game) => '尝试跨类型机制融合，或加入独特的玩法变体',
};
