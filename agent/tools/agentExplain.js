/**
 * agent_explain - Agent introspection & decision transparency tool.
 *
 * Surfaces the agent's last decision trace: which intent was detected,
 * which tool was picked, what arguments were extracted, the full tool
 * call sequence in the last turn, and a human-readable reasoning summary.
 * Designed so the user can ask "why did you do X" or "explain your
 * reasoning" and get a structured, auditable answer rather than a guess.
 *
 * Reads from a per-session decision log maintained by the orchestrator
 * (this.toolTraces) and the planner's last intent. Falls back to a
 * generic capability summary when no prior decision exists.
 */

function summarizeIntent(intent) {
  if (!intent) return 'No prior intent recorded for this session yet.';
  const parts = [`Detected intent: ${intent.name || intent.tool || 'chat'}`];
  if (intent.args && Object.keys(intent.args).length) {
    const argPreview = Object.entries(intent.args)
      .slice(0, 6)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v)}`)
      .join(', ');
    parts.push(`Extracted args: ${argPreview}`);
  }
  if (intent.source) parts.push(`Decision source: ${intent.source}`);
  return parts.join('\n');
}

function summarizeTrace(trace) {
  if (!trace || !Array.isArray(trace.steps) || !trace.steps.length) {
    return 'No tool calls recorded in the last turn.';
  }
  const lines = trace.steps.map((s, i) => {
    const status = s.ok ? 'OK' : 'FAIL';
    const dur = s.durationMs != null ? ` (${s.durationMs}ms)` : '';
    const summary = s.summary ? ` — ${s.summary}` : s.error ? ` — ${s.error}` : '';
    return `${i + 1}. ${s.tool} [${status}]${dur}${summary}`;
  });
  return lines.join('\n');
}

function capabilitySummary(toolNames) {
  const buckets = {
    'Create & remix': ['create_game', 'remix_game', 'creative_ideate', 'dispatch_crew'],
    'Edit & balance': ['edit_game', 'tweak_params', 'rapid_iterate', 'configure_game_meta', 'update_basic_info'],
    'Generate content': ['generate_asset', 'generate_npc', 'procedural_level', 'install_snippet'],
    'Style & narrative': ['apply_style_theme', 'apply_scenario', 'edit_node_graph'],
    'Inspect & debug': ['describe_game', 'view_code', 'debug_game', 'debug_with_diffs', 'generate_config'],
    'Run & publish': ['run_game', 'publish_game', 'screenshot_game', 'export_game', 'import_game'],
    'Library & community': ['list_games', 'save_game', 'delete_game', 'search_asset_library', 'explore_community', 'install_snippet'],
    'Insight & history': ['game_analytics', 'version_history', 'agent_explain'],
  };
  const out = [];
  for (const [bucket, names] of Object.entries(buckets)) {
    const have = names.filter((n) => toolNames.includes(n));
    if (have.length) out.push(`• ${bucket}: ${have.join(', ')}`);
  }
  return out.join('\n');
}

export function agentExplainTool(services = {}) {
  return {
    name: 'agent_explain',
    description:
      'Introspect the agent\'s last decision: detected intent, chosen tool, extracted arguments, full tool-call trace, and a reasoning summary. Use when the user asks why a decision was made or wants the reasoning surfaced.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session id whose decision trace should be explained' },
        scope: { type: 'string', enum: ['last', 'capabilities'], description: 'last = prior decision trace (default); capabilities = list all agent tools' },
      },
    },
    async execute({ sessionId, scope = 'last' }) {
      // Access services lazily so late-bound references (orchestrator, tools)
      // injected after registry construction are visible at execution time.
      const { orchestrator, tools } = services;
      const toolNames = tools?.listNames?.() || [];

      if (scope === 'capabilities') {
        const list = capabilitySummary(toolNames);
        return {
          ok: true,
          summary: `GenPlay Agent 共装备 ${toolNames.length} 个工具，分布如下：\n${list}`,
          scope: 'capabilities',
          toolCount: toolNames.length,
          toolNames,
          editorActions: [
            { type: 'studio:show-capabilities', payload: { toolNames, count: toolNames.length } },
          ],
        };
      }

      // scope === 'last'
      const trace = orchestrator?.getLastTrace?.(sessionId);
      const intent = orchestrator?.getLastIntent?.(sessionId);

      const intentText = summarizeIntent(intent);
      const traceText = summarizeTrace(trace);
      const stepCount = trace?.steps?.length || 0;
      const okCount = trace?.steps?.filter((s) => s.ok).length || 0;

      const summary = [
        `🧠 决策意图：\n${intentText}`,
        '',
        `🛠 上一轮工具调用（${stepCount} 步，${okCount} 成功）：`,
        traceText,
      ].join('\n');

      return {
        ok: true,
        summary,
        intent,
        trace,
        stepCount,
        okCount,
        editorActions: [
          { type: 'studio:show-explanation', payload: { sessionId, intent, trace } },
        ],
      };
    },
  };
}
