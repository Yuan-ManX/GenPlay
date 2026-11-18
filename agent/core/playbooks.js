/**
 * Playbooks - task-level recipes for the GenPlay agent.
 *
 * Sixty-nine atomic tools are great for precise edits but force the model to
 * rediscover the same multi-step sequence for recurring workflows ("make this
 * game feel better", "is this ready to ship?"). A playbook packages that
 * sequence into one selectable unit: every step still runs through the normal
 * tool pipeline (including undo snapshots and editor actions), but selection,
 * ordering and failure continuation are handled deterministically here.
 *
 * Steps only declare the tool plus any fixed arguments. Shared context
 * (gameId, sessionId) is supplied by the executor at call time.
 */

export const PLAYBOOKS = [
  {
    key: 'polish',
    label: '打磨体验',
    icon: '✨',
    description: '趣味性诊断 → 改进建议 → 数值平衡 → 自动试玩',
    triggers: [/(?:打磨|润色|更好玩|更好玩一点|优化体验|提升体验|整体提升|体验升级)/],
    steps: [
      { tool: 'analyze_fun_factor', label: '趣味性诊断' },
      { tool: 'ai_suggest', label: '改进建议' },
      { tool: 'balance_game', label: '数值平衡' },
      { tool: 'play_test', label: '自动试玩' },
    ],
  },
  {
    key: 'ship',
    label: '发布验收',
    icon: '🚀',
    description: '脚本检查 → 调试 → 无障碍审查 → 导出可玩版 → 发布',
    triggers: [/(?:上线检查|发布检查|验收|可以发布|能不能发布|准备好上线|准备上线|发布前)/],
    steps: [
      { tool: 'lint_scripts', label: '脚本检查' },
      { tool: 'debug_game', label: '运行调试' },
      { tool: 'audit_accessibility', label: '无障碍审查' },
      { tool: 'build_playable', label: '导出可玩版' },
      { tool: 'publish_game', label: '发布上线' },
    ],
  },
  {
    key: 'world',
    label: '世界构建',
    icon: '🌍',
    description: '生成剧情 → 生成分支对话',
    triggers: [/(?:世界观|世界构建|剧情线|故事线|叙事构建|构建世界观)/],
    steps: [
      { tool: 'generate_story', label: '生成剧情' },
      { tool: 'generate_dialogue_tree', label: '生成分支对话' },
    ],
  },
  {
    key: 'feel',
    label: '手感调校',
    icon: '🎮',
    description: '物理参数 → 操控映射 → 呈现反馈',
    triggers: [/(?:手感|操控感|操作手感|打击感|操作体验)/],
    steps: [
      { tool: 'configure_physics', label: '物理参数' },
      { tool: 'configure_controls', label: '操控映射' },
      { tool: 'configure_presentation', label: '呈现反馈' },
    ],
  },
];

/** Look up a playbook definition by key. */
export function getPlaybook(key) {
  return PLAYBOOKS.find((p) => p.key === key) || null;
}

/**
 * Resolve free-form text to a playbook key. Returns null when no trigger
 * matches, letting normal intent routing take over.
 */
export function resolvePlaybook(message) {
  const msg = String(message || '');
  for (const pb of PLAYBOOKS) {
    if (pb.triggers.some((re) => re.test(msg))) return pb.key;
  }
  return null;
}

/** Compact catalog for tool descriptions and prompts. */
export function listPlaybooks() {
  return PLAYBOOKS.map((p) => ({
    key: p.key,
    label: p.label,
    icon: p.icon,
    description: p.description,
    steps: p.steps.map((s) => s.label),
  }));
}

export default PLAYBOOKS;
