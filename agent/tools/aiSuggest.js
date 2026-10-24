/**
 * ai_suggest - Analyze the current game state and produce a prioritized
 * list of improvement suggestions. Each suggestion has a category
 * (balance / content / polish / accessibility), a human-readable text,
 * and a `followUp` message the user can send to the chat to act on it.
 * Works in rule mode by reading the actual game config.
 */

export function aiSuggestTool({ gameService, provider }) {
  return {
    name: 'ai_suggest',
    description: 'Analyze the current game and return prioritized improvement suggestions with one-click follow-up messages.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        category: { type: 'string', description: 'Optional filter: balance | content | polish | accessibility' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, category, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const cfg = game.config || {};
      const suggestions = [];

      // --- Balance suggestions derived from actual config ---
      const pSpeed = cfg.player?.speed;
      const eSpeed = cfg.enemy?.speed;
      const pHp = cfg.player?.hp;
      const eHp = cfg.enemy?.hp;
      const pAtk = cfg.player?.atk;

      if (eSpeed && pSpeed && eSpeed > pSpeed) {
        suggestions.push({
          category: 'balance',
          text: `敌人速度(${eSpeed})高于玩家(${pSpeed})，玩家无法逃脱，建议降低敌人速度或增加玩家速度`,
          followUp: `把敌人速度调到 ${(pSpeed * 0.8).toFixed(1)}`,
          priority: 1,
        });
      }
      if (eHp && pAtk && eHp / pAtk > 6) {
        suggestions.push({
          category: 'balance',
          text: `敌人血量(${eHp})需要超过${Math.ceil(eHp / pAtk)}次攻击才能击败，战斗节奏偏慢`,
          followUp: `把敌人血量调到 ${pAtk * 4}`,
          priority: 1,
        });
      }
      if (pHp != null && pHp < 30) {
        suggestions.push({
          category: 'balance',
          text: `玩家血量(${pHp})偏低，容错率不足，建议提高到 50 以上`,
          followUp: `把玩家血量调到 60`,
          priority: 2,
        });
      }
      if (pSpeed != null && pSpeed < 1.5) {
        suggestions.push({
          category: 'balance',
          text: `玩家移动速度(${pSpeed})偏慢，操作手感可能发闷`,
          followUp: `把玩家速度调到 3.5`,
          priority: 3,
        });
      }

      // --- Content suggestions ---
      const npcCount = Array.isArray(game.npcs) ? game.npcs.length : 0;
      const assetCount = Array.isArray(game.assets) ? game.assets.length : 0;
      if (npcCount < 2) {
        suggestions.push({
          category: 'content',
          text: `当前只有 ${npcCount} 个 NPC，世界略显空旷，建议添加更多角色`,
          followUp: `给 game#${gameId} 生成 3 个 NPC`,
          priority: 2,
        });
      }
      if (assetCount < 3) {
        suggestions.push({
          category: 'content',
          text: `资产数量(${assetCount})不足，建议补充精灵图、音效和背景音乐`,
          followUp: `给 game#${gameId} 生成背景音乐和音效资产`,
          priority: 2,
        });
      }
      if (!game.scenario) {
        suggestions.push({
          category: 'content',
          text: '尚未设置剧情场景，建议添加一个世界观背景',
          followUp: `给 game#${gameId} 应用一个太空剧情场景`,
          priority: 3,
        });
      }

      // --- Polish suggestions ---
      if (!game.theme) {
        suggestions.push({
          category: 'polish',
          text: '尚未应用视觉主题，建议选择一个风格统一美术表现',
          followUp: `给 game#${gameId} 应用赛博朋克主题`,
          priority: 2,
        });
      }
      suggestions.push({
        category: 'polish',
        text: '运行一次模拟测试，检查数值平衡和潜在玩法问题',
        followUp: `对 game#${gameId} 运行模拟测试`,
        priority: 1,
      });

      // --- Accessibility suggestions ---
      const meta = game.meta || {};
      if (!meta.accessibility) {
        suggestions.push({
          category: 'accessibility',
          text: '未配置无障碍选项，建议添加色盲模式和难度调节',
          followUp: `给 game#${gameId} 开启色盲无障碍支持`,
          priority: 3,
        });
      }
      if (!meta.multiplayer) {
        suggestions.push({
          category: 'accessibility',
          text: '可以考虑添加排行榜或成就系统，提升重玩动力',
          followUp: `给 game#${gameId} 配置成就系统`,
          priority: 3,
        });
      }

      // Sort by priority (lower = more important).
      let result = suggestions.sort((a, b) => (a.priority || 5) - (b.priority || 5));
      if (category) result = result.filter((s) => s.category === category);

      // Always guarantee at least 3 suggestions.
      const fillers = [
        { category: 'polish', text: '一键快速迭代，全面优化游戏品质', followUp: `对 game#${gameId} 进行快速迭代优化`, priority: 4 },
        { category: 'balance', text: '运行深度调试，自动发现并修复代码问题', followUp: `深度调试 game#${gameId}`, priority: 4 },
        { category: 'content', text: '生成程序化关卡，丰富游戏内容', followUp: `给 game#${gameId} 生成 3 个关卡`, priority: 4 },
        { category: 'polish', text: '创建版本快照，保存当前进度以便回滚', followUp: `给 game#${gameId} 创建一个版本快照`, priority: 5 },
      ];
      while (result.length < 3) result.push(fillers.shift());

      // Strip internal priority field from output.
      const clean = result.map(({ priority, ...rest }) => rest);

      const editorActions = [{
        type: 'studio:show-suggestions',
        gameId,
        payload: { suggestions: clean },
      }];

      return {
        ok: true,
        game,
        suggestions: clean,
        editorActions,
        summary: `已生成 ${clean.length} 条改进建议`,
      };
    },
  };
}
