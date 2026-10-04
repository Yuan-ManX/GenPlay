/**
 * SelfReflector - Critique & self-improvement loop for GenPlay Agent.
 * After each tool execution chain, the reflector reviews:
 *   1. Did the output satisfy the user intent?
 *   2. Are there quality gaps (missing genre features, balance, playability)?
 *   3. What follow-up actions would elevate the result?
 * Produces a structured critique that the orchestrator can optionally
 * turn into extra tool iterations (rapid iteration engine).
 *
 * Quality gates (ordered by typical severity):
 *   - Genre feature completeness (high/medium)
 *   - Untested change verification (low)
 *   - Publish-readiness checklist (medium)
 *   - Engagement inventory: tutorial / audio / achievements (low)
 *   - Fun factor integration: act on lastFunFactor score (medium/high)
 *   - Accessibility audit gap (low)
 *   - Progression design gap (low)
 *   - Script hygiene: lint after script edits (low)
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
    const executedTools = new Set(toolResults.map((t) => t.tool));

    // ====================================================================
    // Gate 1: Genre feature completeness for create_game / template output
    // ====================================================================
    const created = toolResults.find((t) =>
      (t.tool === 'create_game' || t.tool === 'generate_game_template') && t.result.ok);
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

    // ====================================================================
    // Gate 2: Untested change verification
    // ====================================================================
    const editTools = ['edit_game', 'tweak_params', 'apply_style_theme', 'apply_scenario'];
    if (toolResults.some((t) => editTools.includes(t.tool) && t.result.ok) &&
        !toolResults.some((t) => ['run_game', 'debug_game', 'debug_with_diffs', 'play_test'].includes(t.tool))) {
      issues.push({ type: 'untested_change', severity: 'low', suggestion: '改动后未运行试玩，建议调试确认效果' });
      nextActions.push({ tool: 'run_game', args: {} });
    }

    // ====================================================================
    // Gate 3: Publish-readiness checklist
    // ====================================================================
    if (toolResults.some((t) => t.tool === 'publish_game')) {
      if (!game?.description) {
        issues.push({ type: 'publish_metadata', severity: 'medium', suggestion: '发布前缺少游戏简介，影响分享点击率' });
      }
      if (game && !game.tutorial) {
        issues.push({ type: 'publish_onboarding', severity: 'low', suggestion: '发布版本缺少新手引导，可能影响新玩家留存' });
      }
    }

    // ====================================================================
    // Gate 4: Engagement inventory (tutorial / audio / achievements)
    // Skip when the user already asked for these (avoid being noisy) or
    // when the tool chain already produced them.
    // ====================================================================
    const userAskedTutorial = /教程|tutorial|新手引导|教学|onboarding/.test(msg);
    const userAskedAudio = /音乐|music|音效|sfx|bgm/.test(msg);
    const userAskedAchievements = /成就|achievement/.test(msg);

    if (game && !userAskedTutorial && !game.tutorial && !executedTools.has('generate_tutorial')) {
      // Only suggest tutorial for game types where onboarding adds clear value
      const tutorialWorthyGenres = ['shooter', 'platformer', 'rpg', 'puzzle', 'tower', 'roguelike', 'racing', 'rhythm'];
      if (tutorialWorthyGenres.includes(game.genre)) {
        issues.push({ type: 'tutorial_missing', severity: 'low', suggestion: '尚未生成新手引导，可帮助玩家快速上手' });
      }
    }

    if (game && !userAskedAudio && !executedTools.has('manage_audio')) {
      const audioCount = (game.audio?.tracks?.length || 0) + (game.audio?.sfx?.length || 0);
      if (audioCount === 0) {
        issues.push({ type: 'audio_empty', severity: 'low', suggestion: '游戏无音乐与音效配置，氛围感会偏弱' });
      }
    }

    if (game && !userAskedAchievements && !executedTools.has('manage_achievements')) {
      const achCount = game.meta?.achievements?.length || 0;
      if (achCount === 0) {
        issues.push({ type: 'achievements_empty', severity: 'low', suggestion: '未配置成就，可能影响中长期留存目标' });
      }
    }

    // ====================================================================
    // Gate 5: Fun factor integration - act on the most recent analysis
    // ====================================================================
    if (game?.lastFunFactor) {
      const ff = game.lastFunFactor;
      // Trigger follow-up only when the user ran the analysis themselves
      // (executedTools has analyze_fun_factor) — otherwise the digest is
      // background context and we don't auto-suggest fixes.
      if (executedTools.has('analyze_fun_factor')) {
        if (ff.grade === 'D' || ff.grade === 'C') {
          // ff.suggestions entries look like { dimension, score, suggestion }
          const topDims = (ff.suggestions || []).slice(0, 2).map((s) => s.dimension).join('、');
          issues.push({
            type: 'fun_factor_low',
            severity: ff.grade === 'D' ? 'high' : 'medium',
            suggestion: `趣味评估 ${ff.grade} 级（${ff.total} 分），建议优先处理：${topDims || '低分维度'}`,
          });
          // Suggest balance_game when mechanics/progression dimension is weak
          const dims = ff.scores || ff.dimensions || {};
          if (dims.mechanics < 0.5 || dims.progression < 0.5) {
            nextActions.push({ tool: 'balance_game', args: {} });
          }
        }
      }
    }

    // ====================================================================
    // Gate 6: Accessibility audit gap - suggest audit for published games
    // ====================================================================
    const userAskedA11y = /无障碍|accessibility|可访问/.test(msg);
    if (game && !userAskedA11y && !executedTools.has('audit_accessibility') &&
        game.status === 'published') {
      issues.push({
        type: 'a11y_unaudited',
        severity: 'low',
        suggestion: '已发布游戏尚未做无障碍评估，建议进行可访问性审计',
      });
    }

    // ====================================================================
    // Gate 7: Progression design gap for level-based genres
    // ====================================================================
    const userAskedProgression = /进度设计|关卡设计|难度曲线|progression/.test(msg);
    if (game && !userAskedProgression && !executedTools.has('design_progression')) {
      const progressionGenres = ['platformer', 'rpg', 'roguelike', 'tower', 'puzzle'];
      if (progressionGenres.includes(game.genre) && !game.progression?.levels?.length) {
        issues.push({
          type: 'progression_undesigned',
          severity: 'low',
          suggestion: '关卡型游戏缺少进阶难度曲线设计，可能影响中长期体验',
        });
      }
    }

    // ====================================================================
    // Gate 8: Script hygiene - lint after script edits
    // ====================================================================
    if (executedTools.has('edit_script') && !executedTools.has('lint_scripts')) {
      issues.push({
        type: 'script_unlinted',
        severity: 'low',
        suggestion: '脚本编辑后未做语法检查，建议运行 lint 确保无错误',
      });
      nextActions.push({ tool: 'lint_scripts', args: {} });
    }

    // ====================================================================
    // Score aggregation - severity weighted, capped at 0.4 floor
    // ====================================================================
    const highCount = issues.filter((i) => i.severity === 'high').length;
    const mediumCount = issues.filter((i) => i.severity === 'medium').length;
    const lowCount = issues.filter((i) => i.severity === 'low').length;
    const score = Math.max(0.4, 1.0 - highCount * 0.2 - mediumCount * 0.08 - lowCount * 0.03);

    const summary = issues.length === 0
      ? '输出已通过自检'
      : `发现 ${issues.length} 项可优化点，其中 ${highCount} 项高优先级`;

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
      'Detect: missing gameplay features, balance issues, untested changes, publish-readiness gaps,',
      'absent tutorial/onboarding, missing audio, achievement gaps, accessibility risks, weak progression curves,',
      'and unverified script edits. Recommend concrete next tool invocations when warranted.',
    ].join('\n');
    const payload = {
      user_intent: userMessage,
      parsed_intent: intent,
      tool_results_summary: toolResults.map((t) => ({ tool: t.tool, ok: t.result.ok, summary: t.result.summary })),
      game_snapshot: game ? {
        id: game.id,
        genre: game.genre,
        hasTheme: !!game.theme,
        hasScenario: !!game.scenario,
        hasTutorial: !!game.tutorial,
        audioCount: (game.audio?.tracks?.length || 0) + (game.audio?.sfx?.length || 0),
        achievementCount: game.meta?.achievements?.length || 0,
        hasProgression: !!game.progression?.levels?.length,
        funFactor: game.lastFunFactor ? { grade: game.lastFunFactor.grade, total: game.lastFunFactor.total } : null,
      } : null,
    };
    return this.provider.json({ systemPrompt: sys, userMessage: JSON.stringify(payload), schema, temperature: 0.2 });
  }
}
