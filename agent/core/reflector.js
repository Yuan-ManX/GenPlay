/**
 * SelfReflector - Critique & self-improvement loop for GenPlay Agent.
 * After each tool execution chain, the reflector reviews:
 *   1. Did the output satisfy the user intent?
 *   2. Are there quality gaps (missing genre features, balance, playability)?
 *   3. What follow-up actions would elevate the result?
 * Produces a structured critique that the orchestrator can optionally
 * turn into extra tool iterations (rapid iteration engine).
 */
export class SelfReflector {
  constructor({ provider } = {}) {
    this.provider = provider;
  }

  /**
   * Run critique pipeline. Returns structured:
   *   { score: 0..1, issues: [{type, severity, suggestion}], nextActions: [toolName+args] }
   */
  async critique({ userMessage, intent, toolResults, game }) {
    const ruleCritique = this.ruleCritique(userMessage, intent, toolResults, game);
    if (!this.provider?.enabled) return ruleCritique;

    try {
      const llmCritique = await this.llmCritique({ userMessage, intent, toolResults, game });
      // Merge: keep rule-based issues as hard floor, blend LLM suggestions
      return {
        score: Math.max(ruleCritique.score, llmCritique.score || 0),
        issues: [...ruleCritique.issues, ...(llmCritique.issues || [])].slice(0, 8),
        nextActions: [...(llmCritique.nextActions || []), ...ruleCritique.nextActions].slice(0, 4),
        summary: llmCritique.summary || ruleCritique.summary,
      };
    } catch (_) {
      return ruleCritique;
    }
  }

  ruleCritique(userMessage, intent, toolResults, game) {
    const issues = [];
    const nextActions = [];
    const msg = String(userMessage || '').toLowerCase();

    // Quality gate 1: create_game without theme/scenario/tweak suggests polish
    const created = toolResults.find((t) => t.tool === 'create_game' && t.result.ok);
    if (created && game) {
      if (!game.theme) {
        issues.push({ type: 'theme_missing', severity: 'low', suggestion: '尚未应用视觉主题，可匹配流派推荐像素风/赛博朋克等' });
      }
      if (!game.scenario) {
        issues.push({ type: 'scenario_missing', severity: 'low', suggestion: '剧情场景为空，可添加叙事背景与关卡驱动' });
      }
      if (game.config?.winCondition?.type === 'endless' && /目标|通关|结局/i.test(msg)) {
        issues.push({ type: 'win_condition_weak', severity: 'medium', suggestion: '用户提及通关目标，建议设置具体胜利条件而非无尽模式' });
      }
      // Genre-specific sanity checks
      const genre = game.genre;
      if (genre === 'roguelike' && !game.config?.dungeon?.floors) {
        issues.push({ type: 'genre_weak', severity: 'medium', suggestion: 'Roguelike 缺少地牢层数配置' });
      }
      if (genre === 'tower' && !game.config?.path?.points?.length) {
        issues.push({ type: 'genre_weak', severity: 'high', suggestion: '塔防路径为空，游戏无法运行' });
      }
      if (genre === 'deckbuilder' && !game.config?.cards?.length) {
        issues.push({ type: 'genre_weak', severity: 'high', suggestion: '卡组构筑缺少卡牌定义' });
      }
      if (genre === 'auto_battler' && !game.config?.units?.length) {
        issues.push({ type: 'genre_weak', severity: 'high', suggestion: '自走棋缺少单位池' });
      }
      if (genre === 'visual_novel' && !game.config?.characters?.length) {
        issues.push({ type: 'genre_weak', severity: 'high', suggestion: '视觉小说缺少角色定义' });
      }
    }

    // Quality gate 2: edit/tool w/o debug suggest verification
    const editTools = ['edit_game', 'tweak_params', 'apply_style_theme', 'apply_scenario'];
    if (toolResults.some((t) => editTools.includes(t.tool) && t.result.ok) &&
        !toolResults.some((t) => ['run_game', 'debug_game', 'debug_with_diffs'].includes(t.tool))) {
      issues.push({ type: 'untested_change', severity: 'low', suggestion: '改动后未运行试玩，建议调试确认效果' });
      nextActions.push({ tool: 'run_game', args: {} });
    }

    // Quality gate 3: publish-ready checklist
    if (toolResults.some((t) => t.tool === 'publish_game')) {
      if (!game?.description) {
        issues.push({ type: 'publish_metadata', severity: 'medium', suggestion: '发布前缺少游戏简介，影响分享点击率' });
      }
    }

    const score = Math.max(0.4, 1.0 - issues.filter((i) => i.severity === 'high').length * 0.2
                                            - issues.filter((i) => i.severity === 'medium').length * 0.08
                                            - issues.filter((i) => i.severity === 'low').length * 0.03);

    const summary = issues.length === 0 ? '输出已通过自检' : `发现 ${issues.length} 项可优化点，其中 ${
      issues.filter((i) => i.severity === 'high').length} 项高优先级`;

    return { score: Math.min(1, score), issues, nextActions, summary };
  }

  async llmCritique({ userMessage, intent, toolResults, game }) {
    const schema = {
      type: 'object',
      properties: {
        score: { type: 'number', description: '0..1 quality score' },
        summary: { type: 'string' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              suggestion: { type: 'string' },
            },
            required: ['severity', 'suggestion'],
          },
        },
        nextActions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { tool: { type: 'string' }, args: { type: 'object' } },
            required: ['tool'],
          },
        },
      },
      required: ['score', 'summary'],
    };
    const sys = [
      'You are GenPlay self-reflector. Critique the agent output vs user intent.',
      'Detect: missing gameplay features, balance issues, untested changes, publish-readiness gaps.',
      'Recommend concrete next tool invocations if warranted.',
    ].join('\n');
    const payload = {
      user_intent: userMessage,
      parsed_intent: intent,
      tool_results_summary: toolResults.map((t) => ({ tool: t.tool, ok: t.result.ok, summary: t.result.summary })),
      game_snapshot: game ? { id: game.id, genre: game.genre, hasTheme: !!game.theme, hasScenario: !!game.scenario } : null,
    };
    return this.provider.json({ systemPrompt: sys, userMessage: JSON.stringify(payload), schema, temperature: 0.2 });
  }
}
