/**
 * PlanMemory - Multi-turn plan tracker for long-horizon goal pursuit.
 *
 * Many creative tasks span multiple conversation turns: the user says
 * "let's make a game, theme it cyberpunk, add a boss, balance it, then
 * publish" — that is a 5-step plan that unfolds across several messages.
 * PlanMemory detects such plans, tracks step completion as tools run,
 * and surfaces pending steps to the orchestrator's system prompt so the
 * agent stays focused on the user's original goal across turns.
 *
 * Plans are stored per session and time out after a configurable idle
 * window so stale plans do not hijack fresh conversations.
 */

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Step templates keyed by their canonical tool name. Each entry lists
// the bucket label shown to the user and a matcher that recognizes
// natural-language fragments signaling this step was requested.
const STEP_TEMPLATES = {
  create_game:        { label: '创建游戏',   match: /(创建|生成|做|build|create|make|新建|开发)/i },
  creative_ideate:    { label: '构思灵感',   match: /(创意|灵感|构思|brainstorm|idea)/i },
  apply_style_theme:  { label: '应用主题',   match: /(主题|风格|theme|style|配色)/i },
  apply_scenario:     { label: '编排剧情',   match: /(场景|剧情|story|scenario|叙事)/i },
  tweak_params:       { label: '调参平衡',   match: /(调参|参数|tweak|难度|速度|血量|balance)/i },
  procedural_level:   { label: '生成关卡',   match: /(关卡|地图|level|map|地牢)/i },
  generate_npc:       { label: '生成角色',   match: /(角色|npc|character|人物)/i },
  generate_asset:     { label: '生成资源',   match: /(资源|素材|sprite|asset|音效|配乐)/i },
  install_snippet:    { label: '安装机制',   match: /(安装|snippet|片段|二段跳|dash|boss|金币)/i },
  edit_node_graph:    { label: '节点编排',   match: /(节点|node|graph|逻辑图)/i },
  debug_game:         { label: '调试排错',   match: /(调试|debug|排错|排查)/i },
  debug_with_diffs:   { label: '深度修复',   match: /(diff|深度调试|自动修复|修复)/i },
  run_game:           { label: '运行试玩',   match: /(运行|试玩|run|test|play)/i },
  rapid_iterate:      { label: '一键打磨',   match: /(优化|打磨|polish|iterate|润色)/i },
  game_analytics:     { label: '数据分析',   match: /(分析|analytics|留存|retention|流失|漏斗)/i },
  version_history:    { label: '版本快照',   match: /(版本|快照|snapshot|历史|回滚|restore)/i },
  publish_game:       { label: '发布上线',   match: /(发布|上线|publish|deploy|分享)/i },
  screenshot_game:    { label: '生成封面',   match: /(截图|封面|screenshot|poster)/i },
  export_game:        { label: '导出打包',   match: /(导出|export|打包|备份)/i },
  describe_game:      { label: '概览复盘',   match: /(概览|介绍|describe|复盘)/i },
};

// Connector tokens that signal a multi-step plan in a single message.
// Examples: "创建...然后...发布", "先...再...最后", "做完后...接着",
// "第一步...第二步", "1. ... 2. ...", comma-separated imperative clauses.
const PLAN_CONNECTORS = [
  /然后/i, /接着/i, /再/i, /最后/i, /之后/i, /做完/i, /完成后/i,
  /第一步/i, /第二步/i, /第三步/i, /第四步/i, /第五步/i,
  /先.{2,40}?后/i, /先.{2,40}?再/i,
  /\d+\.\s/i, /→/i, /->/i, /；/i,
];

export class PlanMemory {
  constructor({ idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS } = {}) {
    this.plans = new Map();
    this.idleTimeoutMs = idleTimeoutMs;
  }

  /**
   * Inspect a user message and decide whether it opens a multi-step plan.
   * Returns a plan object (with steps) when detected, or null otherwise.
   * A plan is detected when the message contains 2+ connector tokens AND
   * references 2+ distinct step buckets.
   */
  detectPlan(sessionId, message) {
    const msg = String(message || '');
    if (!msg) return null;

    const connectorHits = PLAN_CONNECTORS.filter((re) => re.test(msg));
    if (connectorHits.length < 1) return null;

    const matchedSteps = [];
    const seen = new Set();
    for (const [tool, tmpl] of Object.entries(STEP_TEMPLATES)) {
      if (seen.has(tool)) continue;
      if (tmpl.match.test(msg)) {
        matchedSteps.push({ tool, label: tmpl.label, status: 'pending' });
        seen.add(tool);
      }
    }
    // Require at least 2 distinct steps to call it a plan.
    if (matchedSteps.length < 2) return null;

    const plan = {
      id: 'plan_' + Date.now().toString(36),
      sessionId,
      originMessage: msg.slice(0, 200),
      steps: matchedSteps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      status: 'active',
    };
    this.plans.set(sessionId, plan);
    return plan;
  }

  /**
   * Get the active plan for a session (or null if none / stale).
   */
  getActive(sessionId) {
    const plan = this.plans.get(sessionId);
    if (!plan) return null;
    if (plan.status === 'completed') return null;
    // Expire stale plans.
    const age = Date.now() - new Date(plan.updatedAt).getTime();
    if (age > this.idleTimeoutMs) {
      plan.status = 'expired';
      return null;
    }
    return plan;
  }

  /**
   * Mark a step as completed when its tool runs successfully.
   * Returns the updated plan (or null).
   */
  markStepCompleted(sessionId, toolName) {
    const plan = this.plans.get(sessionId);
    if (!plan || plan.status !== 'active') return null;
    const step = plan.steps.find((s) => s.tool === toolName && s.status !== 'completed');
    if (!step) return plan;
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    plan.updatedAt = new Date().toISOString();
    // Auto-complete the plan when every step is done.
    if (plan.steps.every((s) => s.status === 'completed')) {
      plan.status = 'completed';
      plan.completedAt = plan.updatedAt;
    }
    return plan;
  }

  /**
   * Append a new step to an active plan when the user extends the goal
   * mid-flight (e.g. "also add achievements" while a plan is running).
   */
  appendStep(sessionId, toolName) {
    const plan = this.plans.get(sessionId);
    if (!plan || plan.status !== 'active') return null;
    if (plan.steps.some((s) => s.tool === toolName)) return plan;
    const tmpl = STEP_TEMPLATES[toolName];
    if (!tmpl) return plan;
    plan.steps.push({ tool: toolName, label: tmpl.label, status: 'pending' });
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  /**
   * Render a compact status line for the orchestrator system prompt.
   * Returns null when there is no active plan so the prompt stays clean.
   */
  statusLine(sessionId) {
    const plan = this.getActive(sessionId);
    if (!plan) return null;
    const pending = plan.steps.filter((s) => s.status !== 'completed');
    const done = plan.steps.length - pending.length;
    const stepBrief = plan.steps
      .map((s) => (s.status === 'completed' ? `[x]${s.label}` : `[ ]${s.label}`))
      .join(' -> ');
    return `Active multi-step plan (${done}/${plan.steps.length} done): ${stepBrief}. Continue with the next pending step unless the user redirects.`;
  }

  /**
   * Clear plan for a session (used on session reset).
   */
  clear(sessionId) {
    this.plans.delete(sessionId);
  }
}
