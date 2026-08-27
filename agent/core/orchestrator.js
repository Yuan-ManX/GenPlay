import { MemoryStore } from './memory.js';
import { ArtifactMemory } from './artifactMemory.js';
import { SelfReflector } from './reflector.js';
import { LLMProvider } from '../providers/llm.js';
import { listGenres } from '../templates/gameTemplates.js';

const ALL_GENRES = listGenres().map((g) => g.key);

/**
 * AgentOrchestrator v2
 * End-to-end reasoning pipeline for GenPlay Agent:
 *   Rule fast-path → Compound intent plan → LLM tool-usage reasoning loop
 *   → Self-reflection critique → Optional rapid-iteration follow-ups
 *   → Session memory persist + Artifact memory persist + Structured reply
 *
 * Editor action signals flow through every tool and are forwarded to the
 * frontend by the top-level response (editorActions[]).
 */
export class AgentOrchestrator {
  constructor({ memory, artifactMemory, reflector, tools, planner, provider, systemPrompt, maxSteps = 6 } = {}) {
    this.memory = memory || new MemoryStore();
    this.artifactMemory = artifactMemory || new ArtifactMemory();
    this.reflector = reflector || new SelfReflector({ provider });
    this.tools = tools;
    this.planner = planner;
    this.provider = provider || new LLMProvider();
    this.systemPrompt = systemPrompt || this.defaultSystemPrompt();
    this.maxSteps = maxSteps;
  }

  defaultSystemPrompt() {
    return [
      'You are GenPlay, an AI-native game creation and editing agent.',
      'You help users: create games from scratch, edit game logic & parameters, debug & run tests, generate configs, style themes, design NPCs/levels/assets, publish games and iterate rapidly.',
      'You have tool-calling capability. Analyze the user intent and pick the BEST single tool to call at each step.',
      'Think step by step. If a task needs multiple steps, do one tool call then synthesize the next action.',
      'Response requirements: structured, concise, reference tool outputs. When no tool fits, chat naturally.',
      'IMPORTANT: When editing games, always use the editor_actions to emit control signals so the frontend studio reflects the changes live.',
      'Use creative_ideate when user wants inspiration. Use rapid_iterate when the user asks to polish/improve/iterate a game in one shot.',
    ].join('\n');
  }

  buildSystemPrompt(augments = {}) {
    const parts = [this.systemPrompt];
    if (augments.summary) parts.push(`\n[Session Memory] ${augments.summary}`);
    if (augments.currentGameId) parts.push(`\n[Current Focus Game] gameId=${augments.currentGameId}`);
    if (augments.availableGenres) parts.push(`\n[Available Genres] ${augments.availableGenres.join(', ')}`);
    // Inject cross-session preference profile so the agent personalizes
    // suggestions, tone, and difficulty defaults without extra prompting.
    const prefSummary = this.artifactMemory?.preferenceSummary?.();
    if (prefSummary) parts.push(`\n[User Profile] ${prefSummary}`);
    const cc = this.artifactMemory?.creativityContext?.();
    if (cc?.favoriteGenres?.length) parts.push(`\n[User Taste] favorite genres: ${cc.favoriteGenres.join(', ')}; total creations: ${cc.totalGames}`);
    return parts.join('\n');
  }

  detectFocusGameId(session) {
    if (!session?.intents?.length) return null;
    for (let i = session.intents.length - 1; i >= 0; i--) {
      const it = session.intents[i];
      if (it?.gameId) return it.gameId;
    }
    return null;
  }

  /**
   * Main entry: run full pipeline for one user message.
   * Optional `onEvent` callback receives streaming lifecycle events:
   *   { type:'plan', tools }            - compound plan built
   *   { type:'tool_start', tool, args } - a tool is about to run
   *   { type:'tool_end', tool, ok, summary } - tool finished
   *   { type:'reply', reply }           - final synthesized reply
   *   { type:'done', result }            - full pipeline result
   * This lets the SSE endpoint stream the agent's reasoning to the frontend
   * without refactoring the loop into an async generator.
   */
  async handleMessage({ sessionId, message, context = {}, onEvent }) {
    const emit = typeof onEvent === 'function' ? onEvent : null;
    const history = this.memory.get(sessionId);
    const session = this.memory.getSession(sessionId);
    const focusGameId = this.detectFocusGameId(session);

    // Fast path intent detection
    const ruleIntent = this.planner.detectIntent(message, history);
    const toolName = ruleIntent.tool || ruleIntent.name;

    let toolResults = [];
    let editorActions = [];
    let intent = ruleIntent;
    let lastToolName = null;
    let lastGameId = ruleIntent.args?.gameId || focusGameId;

    // Build compound plan with create_game re-prioritization logic
    const planTools = [];
    let fastPathToolName = this.tools.has(toolName) && this.hasSufficientArgs(toolName, ruleIntent.args) ? toolName : null;
    if ((/创建|生成|create|build|new|make/i.test(message)) && this.tools.has('create_game')) {
      const createIntent = this.planner.extractArgs ? this.planner.detectIntent(message, history) : null;
      if (createIntent?.name !== 'create_game') {
        const createArgs = (this.planner.extractArgs && this.planner.extractArgs('create_game', message, history)) || {};
        if ((createArgs.name || createArgs.genre)) {
          fastPathToolName = 'create_game';
          intent = { name: 'create_game', args: createArgs, tool: 'create_game' };
        }
      }
    }
    if (fastPathToolName) {
      const primaryArgs = (intent?.name === fastPathToolName || intent?.tool === fastPathToolName)
        ? intent.args
        : ruleIntent.args;
      planTools.push({ name: fastPathToolName, args: primaryArgs, source: 'rule' });
    }
    if (this.isCompoundIntent(message, fastPathToolName || '')) {
      const extras = this.planCompoundExtras(message, fastPathToolName, ruleIntent.args, lastGameId);
      for (const extra of extras) planTools.push(extra);
    }

    if (emit && planTools.length) {
      emit({ type: 'plan', tools: planTools.map((p) => p.name) });
    }

    // Execute primary fast-path tool first
    let gameSnap = null;
    if (planTools.length) {
      const first = planTools.shift();
      if (emit) emit({ type: 'tool_start', tool: first.name, args: first.args });
      const r = await this.runTool(first.name, first.args, context, sessionId);
      toolResults.push({ tool: first.name, result: r });
      if (emit) emit({ type: 'tool_end', tool: first.name, ok: r.ok, summary: r.summary });
      if (r.editorActions) editorActions.push(...r.editorActions);
      if (r.game?.id) { lastGameId = r.game.id; gameSnap = r.game; }
      lastToolName = first.name;
      // Track fast-path tool usage for cross-session preference profiling
      this.artifactMemory?.recordToolUsage?.(first.name, first.args);
      if (r.gameId) {
        ruleIntent.args.gameId = r.gameId;
        this.recordIntentGameId(sessionId, ruleIntent, r.gameId);
      }
    }

    // Reasoning loop bootstrap
    const toolSchemas = this.tools.describe();
    let loopCount = 0;
    const loopHistory = history.slice();
    loopHistory.push({ role: 'user', content: message });
    if (toolResults.length) {
      const last = toolResults[toolResults.length - 1];
      loopHistory.push({
        role: 'assistant',
        content: `[Tool ${last.tool}] ${last.result.summary || last.result.error || 'done'}`,
      });
    }

    // Drain remaining compound extras.
    // When the fast-path tool created/remixed a brand-new game, retarget
    // follow-up extras (theme/scenario/tweak/...) to the NEW game so the
    // user's compound intent ("复刻并改难度地狱") lands on the fresh copy
    // rather than mutating the original source.
    const newGameId = gameSnap?.id || null;
    for (const extra of planTools) {
      loopCount++;
      const nextArgs = { ...extra.args };
      if (newGameId && this.toolNeedsGameId(extra.name) && nextArgs.gameId === ruleIntent.args?.gameId) {
        nextArgs.gameId = newGameId;
      }
      if (!nextArgs.gameId && lastGameId && this.toolNeedsGameId(extra.name)) {
        nextArgs.gameId = lastGameId;
      }
      if (emit) emit({ type: 'tool_start', tool: extra.name, args: nextArgs });
      const r = await this.runTool(extra.name, nextArgs, context, sessionId);
      toolResults.push({ tool: extra.name, result: r });
      if (emit) emit({ type: 'tool_end', tool: extra.name, ok: r.ok, summary: r.summary });
      if (r.editorActions) editorActions.push(...r.editorActions);
      if (r.game?.id) { lastGameId = r.game.id; gameSnap = r.game; }
      lastToolName = extra.name;
      // Track compound-extra tool usage for cross-session preference profiling
      this.artifactMemory?.recordToolUsage?.(extra.name, nextArgs);
      if (r.gameId && intent?.args) {
        intent.args.gameId = r.gameId;
        this.recordIntentGameId(sessionId, intent, r.gameId);
      }
      loopHistory.push({
        role: 'assistant',
        content: `[Tool ${extra.name}] ${r.summary || r.error || 'completed'}`,
      });
    }

    // LLM reasoning loop
    let consecutiveFailures = 0;
    while (loopCount < this.maxSteps) {
      loopCount++;
      if (toolResults.length >= 1 && (planTools.length === 0)) {
        const last = toolResults[toolResults.length - 1];
        const hasCompoundRemainder = this.isCompoundIntent(message, '') &&
          !this._allCompoundBucketsCovered(message, toolResults.map((t) => t.tool));
        if (last.result.ok && !hasCompoundRemainder && (
            this.isSufficientResult(last.tool, last.result) ||
            ['tweak_params','apply_style_theme','apply_scenario','view_code','debug_with_diffs','publish_game','describe_game','debug_game','run_game','creative_ideate','procedural_level','generate_asset','generate_npc','configure_game_meta','rapid_iterate'].includes(last.tool))) {
          break;
        }
      }

      // Break early if too many consecutive failures to avoid wasting steps.
      if (consecutiveFailures >= 2) break;

      const sys = this.buildSystemPrompt({
        summary: session.summary,
        currentGameId: lastGameId,
        availableGenres: ALL_GENRES,
      });

      const pick = await this.provider.pickTool({
        systemPrompt: sys,
        history: loopHistory.slice(-12),
        userMessage: message,
        toolSchemas,
      });

      const nextTool = pick.tool;
      const nextArgs = { ...(pick.args || {}) };

      if (!nextArgs.gameId && lastGameId && this.toolNeedsGameId(nextTool)) {
        nextArgs.gameId = lastGameId;
      }

      if (!nextTool || !this.tools.has(nextTool)) break;
      const alreadyRun = toolResults.some((t) => t.tool === nextTool && t.result.ok);
      if (alreadyRun) break;
      if (nextTool === lastToolName && loopCount > 1 && !this.argsProgressed(nextArgs, ruleIntent.args)) break;
      if (this.isTerminalTool(nextTool, toolResults)) break;

      if (emit) emit({ type: 'tool_start', tool: nextTool, args: nextArgs });
      const r = await this.runTool(nextTool, nextArgs, context, sessionId);
      toolResults.push({ tool: nextTool, result: r });
      if (emit) emit({ type: 'tool_end', tool: nextTool, ok: r.ok, summary: r.summary });
      if (r.editorActions) editorActions.push(...r.editorActions);
      if (r.game?.id) { lastGameId = r.game.id; gameSnap = r.game; }
      lastToolName = nextTool;
      // Track tool usage for cross-session preference profiling
      this.artifactMemory?.recordToolUsage?.(nextTool, nextArgs);

      // Error recovery: when a tool fails, inject the error context into
      // loop history so the LLM can revise its approach on the next step.
      // This lets the agent self-heal by picking a different tool or fixing
      // arguments rather than silently aborting on the first failure.
      if (!r.ok) {
        consecutiveFailures++;
        loopHistory.push({
          role: 'system',
          content: `[Recovery] Tool ${nextTool} failed: ${r.error || 'unknown'}. Consider a different tool or corrected arguments.`,
        });
      } else {
        consecutiveFailures = 0;
      }

      if (r.gameId && intent?.args) {
        intent.args.gameId = r.gameId;
        this.recordIntentGameId(sessionId, intent, r.gameId);
      }

      loopHistory.push({
        role: 'assistant',
        content: `[Tool ${nextTool}] ${r.summary || r.error || 'completed'}`,
      });

      if (r.ok && this.isSufficientResult(nextTool, r)) break;
    }

    // ---- Step 3: Self-reflection critique (optional rapid-iteration follow-up) ----
    let critique = null;
    const shouldReflect = lastGameId && (
      toolResults.some((t) => ['create_game', 'edit_game', 'tweak_params', 'apply_style_theme', 'apply_scenario'].includes(t.tool) && t.result.ok)
    );
    if (shouldReflect && this.reflector) {
      try {
        critique = await this.reflector.critique({ userMessage: message, intent, toolResults, game: gameSnap });
        // Auto-trigger rapid_iterate if:
        //   - critique score is low OR user explicitly said "improve/polish/make it better"
        //   - we haven't already run it
        const userAskedPolish = /(做得更好|优化|润色|polish|improve|make it better|更好)/i.test(message);
        const autoRapid = (critique.score < 0.7 || userAskedPolish) &&
          !toolResults.some((t) => t.tool === 'rapid_iterate') &&
          this.tools.has('rapid_iterate') && this.hasSufficientArgs('rapid_iterate', { gameId: lastGameId });
        if (autoRapid) {
          const r = await this.runTool('rapid_iterate', { gameId: lastGameId, feedback: message, focus: 'all' }, context, sessionId);
          toolResults.push({ tool: 'rapid_iterate', result: r });
          if (r.editorActions) editorActions.push(...r.editorActions);
          if (r.diffs?.length) critique = { ...critique, rapidIterationApplied: r.diffs };
        }
      } catch (_) { /* skip critique if fails */ }
    }

    // ---- Step 4: Artifact memory persistence ----
    if (gameSnap) {
      this.artifactMemory.recordGame(gameSnap, [gameSnap.genre]);
      if (gameSnap.theme) this.artifactMemory.recordTheme(gameSnap.theme, gameSnap.id);
      if (gameSnap.scenario) this.artifactMemory.recordScenario(gameSnap.scenario, gameSnap.id);
    }

    // ---- Step 5: Synthesize reply ----
    // When an LLM is configured, stream the synthesized reply token-by-token
    // so the frontend renders progressively. Otherwise fall back to the
    // synchronous rule-based synthesizer.
    let reply = '';
    if (this.provider?.enabled && emit) {
      const promptCtx = {
        userMessage: message,
        intent,
        toolResults,
        critique,
        fallbackHistory: loopHistory.slice(-8),
        sessionSummary: session.summary,
      };
      const sys = this._buildReplySystemPrompt(promptCtx);
      const toolDigest = this._toolDigest(toolResults, critique);
      try {
        reply = await this.provider.chatStream({
          systemPrompt: sys,
          history: loopHistory.slice(-8),
          userMessage: `${message}\n\n[Tool Outputs]\n${toolDigest}`,
          temperature: 0.6,
          onToken: (chunk) => emit({ type: 'reply_token', chunk }),
        });
        // Ensure non-empty reply; fall through to synthesizer if LLM returned nothing.
        if (!reply || !reply.trim()) reply = this.synthesizeReply(promptCtx);
      } catch (_) {
        reply = this.synthesizeReply(promptCtx);
      }
    } else {
      reply = this.synthesizeReply({
        userMessage: message,
        intent,
        toolResults,
        critique,
        fallbackHistory: loopHistory.slice(-8),
        sessionSummary: session.summary,
      });
    }
    if (emit) emit({ type: 'reply', reply });

    const toolTrace = toolResults.map((t) => ({ tool: t.tool, ok: t.result.ok }));
    const meta = { intent, toolTrace, editorActions };
    if (lastGameId) meta.currentGameId = lastGameId;
    if (critique) meta.critique = { score: critique.score, issues: critique.issues.length };

    this.memory.push(sessionId, { role: 'user', content: message });
    this.memory.push(sessionId, { role: 'assistant', content: reply, meta });

    const topLevel = {
      sessionId, reply, intent, toolTrace, toolResults, editorActions,
      currentGameId: lastGameId, critique, done: true,
    };
    for (const t of toolResults) {
      const r = t.result;
      if (r.game !== undefined) topLevel.game = r.game;
      if (r.sections) { topLevel.sections = r.sections; topLevel.code = r.sections; }
      else if (r.code !== undefined && !topLevel.sections) { topLevel.code = r.sections || {}; }
      if (r.shareLink) topLevel.shareLink = r.shareLink;
      if (r.shareCode) topLevel.shareCode = r.shareCode;
      if (r.debugReport) topLevel.debugReport = r.debugReport;
      if (r.diagnostics) topLevel.diagnostics = r.diagnostics;
      if (r.fixes) topLevel.fixes = r.fixes;
      if (r.diffs) topLevel.diffs = r.diffs;
      if (r.description) topLevel.description = r.description;
      if (r.concepts) topLevel.concepts = r.concepts;
      if (r.level) topLevel.level = r.level;
      if (r.assets) topLevel.assets = r.assets;
      if (r.npcs) topLevel.npcs = r.npcs;
      if (r.meta) topLevel.gameMeta = r.meta;
      // Crew blueprint + specialist breakdown for the frontend crew panel.
      if (r.blueprint) topLevel.blueprint = r.blueprint;
      if (r.specialists) topLevel.specialists = r.specialists;
      if (r.applied) topLevel.crewApplied = r.applied;
      if (r.remixOf) topLevel.remixOf = r.remixOf;
      if (r.sourceTitle) topLevel.remixSourceTitle = r.sourceTitle;
    }
    if (topLevel.game?.id && !topLevel.currentGameId) topLevel.currentGameId = topLevel.game.id;
    if (emit) emit({ type: 'done', result: topLevel });
    return topLevel;
  }

  async runTool(toolName, args, context, sessionId) {
    try {
      const raw = await this.tools.invoke(toolName, args, { ...context, sessionId });
      if (!raw || typeof raw !== 'object') {
        return { ok: false, error: 'Tool returned invalid shape', summary: `Failed ${toolName}` };
      }
      if (raw.ok === undefined) raw.ok = true;
      if (!raw.summary) raw.summary = raw.ok ? `Executed ${toolName}` : `${toolName} failed`;
      return raw;
    } catch (err) {
      return { ok: false, error: err.message || String(err), summary: `${toolName} error` };
    }
  }

  hasSufficientArgs(toolName, args = {}) {
    if (toolName === 'create_game') return !!args.name || !!args.genre;
    if (toolName === 'remix_game') return !!(args.shareCode || args.sourceGameId || args.gameId);
    if (toolName === 'dispatch_crew') return !!args.brief || !!args.genre || true;
    if (toolName === 'edit_game') return !!args.gameId;
    if (['debug_game','run_game','publish_game','describe_game','tweak_params','apply_scenario','apply_style_theme','view_code','debug_with_diffs','procedural_level','generate_asset','generate_npc','configure_game_meta','rapid_iterate'].includes(toolName)) return !!args.gameId;
    if (['list_games','generate_config','help','creative_ideate'].includes(toolName)) return true;
    return !!args;
  }

  toolNeedsGameId(toolName) {
    return ['edit_game','debug_game','run_game','publish_game','describe_game','tweak_params','apply_scenario','apply_style_theme','view_code','debug_with_diffs','procedural_level','generate_asset','generate_npc','configure_game_meta','rapid_iterate'].includes(toolName);
  }

  argsProgressed(next, prev) {
    if (!next || !prev) return true;
    return Object.keys(next).some((k) => next[k] && next[k] !== prev[k]);
  }

  isTerminalTool(toolName, results) {
    if (toolName === 'publish_game') return true;
    if (toolName === 'rapid_iterate') return true;
    if (toolName === 'describe_game' && results.length >= 2) return true;
    return false;
  }

  isSufficientResult(toolName, r) {
    if (!r.ok) return true;
    if (['create_game','publish_game','run_game','debug_game','creative_ideate','rapid_iterate','generate_npc','generate_asset','procedural_level','configure_game_meta','remix_game','dispatch_crew'].includes(toolName)) return true;
    return false;
  }

  isCompoundIntent(message, currentFastPathTool) {
    const msg = String(message || '');
    const buckets = this._intentBuckets();
    const matchedOthers = buckets
      .filter((b) => b.tool !== currentFastPathTool && b.re.test(msg))
      .map((b) => b.tool);
    return matchedOthers.length > 0;
  }

  _allCompoundBucketsCovered(message, executedTools) {
    const msg = String(message || '');
    const executed = new Set(executedTools || []);
    const matched = this._intentBuckets().filter((b) => b.re.test(msg)).map((b) => b.tool);
    return matched.every((tool) => executed.has(tool));
  }

  _intentBuckets() {
    return [
      { tool: 'apply_style_theme', re: /(主题|风格|theme|style|配色|赛博|像素|复古|樱花|街机|日落|深海|森林|绿林)/i, argExtractor: (m) => ({ theme: this._detectThemeInline(m) }) },
      { tool: 'apply_scenario',     re: /(场景|剧情|story|scenario|关卡|叙事|故事|章节)/i, argExtractor: (m) => ({ scenarioType: this._detectScenarioInline(m) }) },
      { tool: 'tweak_params',       re: /(调参|参数|tweak|速度|血量|难度|伤害|强度|预设)/i, argExtractor: (m) => this._extractTweakInline(m) },
      { tool: 'debug_with_diffs',   re: /(diff|差异|对比|前后|变更|深度调试|自动修复|修复.*问题)/i },
      { tool: 'view_code',          re: /(查看代码|查看脚本|^代码$|^脚本$|code|script|source|源码)/i },
      { tool: 'publish_game',       re: /(发布|上线|publish|deploy|分享)/i },
      { tool: 'debug_game',         re: /(排错|排障|排查|检查问题|找出问题|debug|troubleshoot)/i },
      { tool: 'run_game',           re: /(运行|测试|跑|试玩|run|test|play)/i },
      { tool: 'describe_game',      re: /(概览|介绍|详情|describe|details?|情况)/i },
      { tool: 'creative_ideate',    re: /(创意|灵感|概念|给点主意|inspire|ideas?|脑暴|脑洞|mashup|混搭|想法)/i },
      { tool: 'rapid_iterate',      re: /(快速迭代|一键优化|做得更好|润色|打磨|polish|improve|iterate|再优化|升级.*游戏)/i },
      { tool: 'generate_asset',     re: /(生成.*资源|素材|sprite|背景|音乐|音效|ui|asset|图标|贴图)/i },
      { tool: 'generate_npc',       re: /(npc|角色|人物|村民|商人|对话.*角色|生成.*(npc|角色))/i },
      { tool: 'procedural_level',   re: /(生成.*关卡|地图|地牢|迷宫|路径|关卡.*生成|level|map|dungeon|地形)/i },
      { tool: 'configure_game_meta',re: /(多人|联机|合作|协作|成就|排行榜|存档|无障碍|变现|广告|内购|multiplayer|achievement|leaderboard|accessibility)/i },
      { tool: 'install_snippet',    re: /(安装|引入|导入.*片段|snippet|二段跳|双段跳|冲刺|突进|dash|收集品|金币|boss|首领|检查点|对话树|成就触发|无敌闪烁|连击|限时|倒计时)/i, argExtractor: (m) => this._detectSnippetKey(m) },
      { tool: 'edit_node_graph',    re: /(节点图|逻辑图|可视化.*节点|node.*graph|连线|导入.*DSL|导出.*DSL)/i },
      { tool: 'search_asset_library', re: /(资产库|素材库|共享库|搜索.*(素材|资产|主题|预设|片段)|asset.*library|查找.*(主题|片段|脚本))/i },
      { tool: 'explore_community',  re: /(社区|探索|浏览|热门|新作|精选|community|explore|排行榜|大家的)/i },
      { tool: 'remix_game',         re: /(复刻|remix|fork.*game|二创|改编|基于.*做|参照.*创作|clone.*game)/i },
      { tool: 'dispatch_crew',      re: /(创作团|专家团|多智能体|协同构思|团队.*设计|crew|specialist|一起.*构思|企划)/i },
    ];
  }

  _detectSnippetKey(msg) {
    if (/二段跳|双段跳|double[ _-]?jump/i.test(msg)) return { snippetKey: 'double_jump' };
    if (/冲刺|突进|dash[ _-]?attack/i.test(msg)) return { snippetKey: 'dash_attack' };
    if (/金币|收集品|coin|拾取|collectible/i.test(msg)) return { snippetKey: 'collectible_coin' };
    if (/boss|首领|boss[ _-]?wave/i.test(msg)) return { snippetKey: 'boss_wave' };
    if (/检查点|复活点|存档点|checkpoint/i.test(msg)) return { snippetKey: 'checkpoint' };
    if (/对话树|分支对话|剧情分支|dialogue[ _-]?tree/i.test(msg)) return { snippetKey: 'dialogue_tree' };
    if (/成就|achievement|解锁条件/i.test(msg)) return { snippetKey: 'achievement_trigger' };
    if (/无敌闪烁|短暂无敌|invincible[ _-]?blink/i.test(msg)) return { snippetKey: 'invincible_blink' };
    if (/连击|combo|score[ _-]?combo/i.test(msg)) return { snippetKey: 'score_combo' };
    if (/限时|时间限制|倒计时|time[ _-]?limit/i.test(msg)) return { snippetKey: 'time_limit' };
    return {};
  }

  planCompoundExtras(message, currentTool, baseArgs, lastGameId) {
    const msg = String(message || '');
    const buckets = this._intentBuckets();
    const out = [];
    const seen = new Set(currentTool ? [currentTool] : []);
    for (const b of buckets) {
      if (seen.has(b.tool)) continue;
      if (!b.re.test(msg)) continue;
      const args = b.argExtractor ? (b.argExtractor(msg) || {}) : {};
      if (baseArgs?.gameId && !args.gameId) args.gameId = baseArgs.gameId;
      out.push({ name: b.tool, args, source: 'compound' });
      seen.add(b.tool);
    }
    return out;
  }

  _detectThemeInline(msg) {
    if (/赛博|cyberpunk|neon/i.test(msg)) return 'cyberpunk';
    if (/像素|复古|retro|pixel|8.?bit/i.test(msg)) return 'retro_pixel';
    if (/樱花|sakura|粉/i.test(msg)) return 'sakura';
    if (/街机|arcade/i.test(msg)) return 'arcade';
    if (/日落|sunset|橙红/i.test(msg)) return 'sunset';
    if (/深海|海洋|ocean|蓝/i.test(msg)) return 'ocean';
    if (/森林|forest|绿|自然|绿林/i.test(msg)) return 'forest';
    return undefined;
  }

  _detectScenarioInline(msg) {
    if (/太空|星|宇宙|方舟|space/i.test(msg)) return 'space';
    if (/魔幻|魔|剑|勇者|fantasy|奇幻/i.test(msg)) return 'fantasy';
    if (/赛博|黑客|霓虹|都市|未来|cyber/i.test(msg)) return 'cyber';
    return undefined;
  }

  _extractTweakInline(message) {
    const args = {};
    const msg = String(message || '');
    const near = `.{0,4}?`;
    const speedMatch = msg.match(new RegExp(`(?:玩家)?(?:速度)${near}(\\d+(?:\\.\\d+)?)`));
    if (speedMatch && !/(伤害|damage|atk|攻击力|血量|hp|生命|敌人)/i.test(speedMatch[0].replace(speedMatch[1],''))) args.speed = Number(speedMatch[1]);
    const hpMatch = msg.match(new RegExp(`(?:玩家)?(?:血量|生命|hp)${near}(\\d+(?:\\.\\d+)?)`, 'i'));
    if (hpMatch && !/(速度|speed|伤害|damage|atk|攻击力|敌人)/i.test(hpMatch[0].replace(hpMatch[1],''))) args.hp = Number(hpMatch[1]);
    const diffMatch = msg.match(/难度.{0,6}?(简单|普通|困难|地狱|easy|normal|hard|hell)/i);
    if (diffMatch) args.difficulty = diffMatch[1];
    const dmgMatch = msg.match(new RegExp(`(?:伤害|攻击力|atk|damage)${near}(\\d+(?:\\.\\d+)?)`, 'i'));
    if (dmgMatch && !/(速度|speed|血量|hp|生命|敌人)/i.test(dmgMatch[0].replace(dmgMatch[1],''))) args.damage = Number(dmgMatch[1]);
    const enemyHpMatch = msg.match(/敌人(?:血量|生命|hp).{0,8}?(\d+(?:\.\d+)?|加倍|翻倍|乘[2-9]|[2-9]倍)/i);
    if (enemyHpMatch) {
      const v = enemyHpMatch[1];
      if (/加倍|翻倍|乘2|2倍/.test(v)) args.enemyHp = 2;
      else if (/乘([2-9])|([2-9])倍/.test(v)) { const m = v.match(/乘([2-9])|([2-9])倍/); args.enemyHp = Number(m[1] || m[2]); }
      else args.enemyHp = Number(v);
    }
    const enemySpdMatch = msg.match(/敌人(?:速度|移速|speed).{0,8}?(\d+(?:\.\d+)?|加倍|翻倍|乘[2-9]|[2-9]倍|加快|减慢)/i);
    if (enemySpdMatch) {
      const v = enemySpdMatch[1];
      if (/加倍|翻倍|乘2|2倍/.test(v)) args.enemySpeed = 2;
      else if (/乘([2-9])|([2-9])倍/.test(v)) { const m = v.match(/乘([2-9])|([2-9])倍/); args.enemySpeed = Number(m[1] || m[2]); }
      else if (/加快/.test(v)) args.enemySpeed = 1.3;
      else if (/减慢/.test(v)) args.enemySpeed = 0.7;
      else args.enemySpeed = Number(v);
    }
    return args;
  }

  recordIntentGameId(sessionId, intent, gameId) {
    const s = this.memory.sessions?.get(sessionId);
    if (!s || !s.intents?.length) return;
    const last = s.intents[s.intents.length - 1];
    last.gameId = gameId;
  }

  /**
   * System prompt for the LLM-powered streaming reply synthesizer.
   * Instructs the model to weave tool outputs into a concise, natural
   * Chinese reply that references what was accomplished and suggests
   * concrete next steps.
   */
  _buildReplySystemPrompt({ intent, critique, sessionSummary }) {
    const parts = [
      this.systemPrompt,
      'You are now writing the final user-facing reply for this turn.',
      'Rules:',
      '- Reply in concise, natural Chinese (简体中文) unless the user spoke English.',
      '- Summarize what was accomplished by referencing the tool outputs below.',
      '- Do NOT fabricate results. If a tool failed, acknowledge it briefly.',
      '- End with 1-3 concrete next-step suggestions the user can pick.',
      '- Keep the reply under 200 Chinese characters unless the user asked for detail.',
    ];
    if (intent?.name) parts.push(`Detected intent: ${intent.name}`);
    if (sessionSummary) parts.push(`[Session Memory] ${sessionSummary}`);
    if (critique?.score != null) {
      parts.push(`[Self-Check] score=${critique.score.toFixed(2)}; ${critique.summary || ''}`);
      if (critique.issues?.length) {
        parts.push('Issues to mention: ' + critique.issues.slice(0, 3).map((i) => i.suggestion).join('; '));
      }
    }
    return parts.join('\n');
  }

  /**
   * Build a compact text digest of tool results for the LLM reply prompt.
   * Each tool contributes its name, status, and summary. Crew blueprints
   * and critiques are included so the model can describe them.
   */
  _toolDigest(toolResults, critique) {
    const lines = [];
    for (const t of toolResults) {
      const r = t.result;
      const status = r.ok ? 'OK' : 'FAIL';
      const summ = r.summary || r.error || '';
      lines.push(`- ${t.tool} [${status}]: ${summ}`);
      if (t.tool === 'dispatch_crew' && r.blueprint) {
        const bp = r.blueprint;
        lines.push(`  Blueprint: "${bp.title}" (${bp.genre || '?'})`);
        if (bp.narrative?.scenarioKey) lines.push(`  Narrative: ${bp.narrative.summary || bp.narrative.scenarioKey}`);
        if (bp.visual?.themeKey) lines.push(`  Visual: ${bp.visual.themeKey}`);
        if (bp.mechanics?.summary) lines.push(`  Mechanics: ${bp.mechanics.summary}`);
        if (bp.critique?.score != null) lines.push(`  Critique: ${bp.critique.score.toFixed(2)}/1.00`);
      }
      if (t.tool === 'remix_game' && r.sourceTitle) {
        lines.push(`  Remixed from: ${r.sourceTitle}`);
      }
    }
    if (critique?.issues?.length) {
      lines.push('', '[Self-Check Issues]');
      for (const iss of critique.issues.slice(0, 4)) {
        lines.push(`- [${iss.severity}] ${iss.suggestion}`);
      }
    }
    return lines.join('\n');
  }

  synthesizeReply({ userMessage, intent, toolResults, critique, fallbackHistory, sessionSummary }) {
    if (toolResults.length === 0) {
      const sys = this.buildSystemPrompt({ summary: sessionSummary, availableGenres: ALL_GENRES });
      return this.provider.chatSync
        ? this.provider.chatSync({ systemPrompt: sys, history: fallbackHistory, userMessage })
        : this.buildRuleReply(userMessage, intent);
    }

    const seen = new Set();
    const lines = [];
    const last = toolResults[toolResults.length - 1];

    for (const t of toolResults) {
      if (t.result.ok) {
        const line = t.result.summary;
        if (line && !seen.has(line)) { seen.add(line); lines.push(line); }
      } else {
        lines.push(`⚠️ ${t.tool}: ${t.result.error || 'Unknown error'}`);
      }
    }

    if (critique && critique.issues?.length) {
      lines.push(`\n🔍 自检评估（${critique.score.toFixed(2)}/1.00）：${critique.summary}`);
      const topIssues = critique.issues.filter((i) => i.severity !== 'low').slice(0, 2);
      for (const iss of topIssues) {
        lines.push(`   · [${iss.severity}] ${iss.suggestion}`);
      }
      if (critique.rapidIterationApplied?.length) {
        lines.push(`   ✨ 已自动应用 ${critique.rapidIterationApplied.length} 项优化`);
      }
    }

    if (last.tool === 'create_game' && last.result.ok) {
      const gid = last.result.game?.id || '当前游戏';
      lines.push('', '接下来你可以告诉我：');
      lines.push('  · 修改玩法："把难度调高" / "加个Boss关卡"');
      lines.push('  · 应用风格："用像素风" / "赛博朋克配色"');
      lines.push(`  · 一键打磨："优化 game#${gid}" 或 "快速迭代"`);
      lines.push(`  · 调试发布："运行 game#${gid}" / "发布上线"`);
    }
    if (last.tool === 'edit_game' && last.result.ok) {
      lines.push('', '要查看修改效果，告诉我"运行游戏"或直接点击试玩预览。');
    }
    if (last.tool === 'debug_game' && last.result.ok && last.result.diagnostics?.length) {
      lines.push('', '如需我帮你自动修复，告诉我"修复上述问题"即可。');
    }
    if (last.tool === 'creative_ideate') {
      lines.push('', '选择一个概念，直接告诉我"用第 2 个来创建"，我会立刻开始搭建。');
    }

    return lines.join('\n');
  }

  buildRuleReply(message, intent) {
    if (intent?.name === 'help' || /(帮助|help|你能做什么|功能|怎么用)/i.test(message)) {
      return [
        '我是 GenPlay AI 游戏创作助手，可以帮你完成以下工作：',
        '  💡 创意灵感："给我 3 个原创游戏概念"',
        '  🎮 创建游戏："创建一个叫星空冒险的射击游戏"',
        '  ✏️  编辑游戏："修改 game#xxx 把玩家速度调高"',
        '  🧱 生成关卡/NPC/资源："给 game#xxx 生成地城关卡" / "做 3 个角色"',
        '  🎨 主题风格："对 game#xxx 应用赛博朋克风格"',
        '  📝 场景剧情："给 game#xxx 加一个太空站关卡剧情"',
        '  🔧 一键打磨："优化 game#xxx" 快速迭代润色',
        '  🐛 调试运行："运行 game#xxx" / "排查 game#xxx 的问题"',
        '  🚀 发布上线："发布 game#xxx"',
        '',
        '所有编辑器操作都可以在左侧对话中用自然语言控制，无需手动操作界面。',
      ].join('\n');
    }
    if (/你好|hi|hello/i.test(message)) {
      return '你好！我是 GenPlay AI 助手。想找灵感可以说"给我几个点子"，想直接创作就告诉我你要什么游戏，我会从零帮你创建、编辑、调试并发布上线 🎮';
    }
    if (/谢谢|thanks|thx/i.test(message)) {
      return '不客气！随时可以告诉我下一步想调整什么，我们一起把游戏做好 ✨';
    }
    return [
      '我已收到你的消息。如果需要我执行具体操作，可以用更明确的指令，例如：',
      '  · "给我 3 个游戏创意"',
      '  · "创建一个叫跳跃冒险的平台跳跃游戏"',
      '  · "给 game#xxx 修改玩家速度为 5.5"',
      '  · "对 game#xxx 应用像素复古风格"',
      '  · "一键优化 game#xxx"',
      '  · "列出所有游戏"',
    ].join('\n');
  }

  reset(sessionId) {
    this.memory.clear(sessionId);
  }
}
