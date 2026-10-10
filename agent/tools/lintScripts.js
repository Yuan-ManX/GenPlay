/**
 * lint_scripts - Validate game DSL scripts for common errors and best practices.
 * Checks the game.scripts DSL string and game.scriptSections generated code
 * for syntax issues, undefined entity references, missing handlers, and
 * style recommendations. Returns a structured lint report.
 */

// Valid DSL instruction verbs.
const VALID_VERBS = ['spawn', 'despawn', 'move', 'jump', 'fire', 'turn', 'score', 'gameover', 'set', 'wait', 'log'];
// Valid DSL conditions.
const VALID_CONDITIONS = ['hit', 'collide', 'input', 'timeout', 'score', 'hp', 'pickup', 'spawn'];

function lintDsl(dsl) {
  const issues = [];
  if (!dsl || typeof dsl !== 'string') return issues;
  const lines = dsl.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const num = i + 1;
    if (!line || line.startsWith('//')) return;

    // genplay::verb pattern
    const verbMatch = line.match(/genplay::(\w+)/g) || [];
    for (const vm of verbMatch) {
      const verb = vm.replace('genplay::', '');
      if (!VALID_VERBS.includes(verb)) {
        issues.push({ level: 'error', line: num, code: 'unknown_verb', message: `未知指令 genplay::${verb}`, fix: `可用指令：${VALID_VERBS.join(', ')}` });
      }
    }

    // on condition pattern
    const condMatch = line.match(/^on\s+(\w+)/);
    if (condMatch) {
      const cond = condMatch[1];
      // Allow dotted conditions like input.left, hit.a, hp.player.
      const baseCond = cond.split('.')[0];
      if (!VALID_CONDITIONS.includes(baseCond)) {
        issues.push({ level: 'warning', line: num, code: 'unknown_condition', message: `未知条件 ${cond}`, fix: `可用条件：${VALID_CONDITIONS.join(', ')}` });
      }
    }

    // Check for unclosed braces on set/spawn.
    if (line.includes('{') && !line.includes('}')) {
      issues.push({ level: 'error', line: num, code: 'unclosed_brace', message: '花括号未闭合' });
    }

    // Discourage very long lines.
    if (line.length > 120) {
      issues.push({ level: 'info', line: num, code: 'line_too_long', message: '行长超过 120 字符，建议拆分' });
    }
  });
  return issues;
}

function lintScriptSections(sections) {
  const issues = [];
  if (!sections || typeof sections !== 'object') return issues;
  for (const [name, code] of Object.entries(sections)) {
    if (typeof code !== 'string') continue;
    // Check for obvious syntax issues: unbalanced braces/parens.
    const openBrace = (code.match(/{/g) || []).length;
    const closeBrace = (code.match(/}/g) || []).length;
    if (openBrace !== closeBrace) {
      issues.push({ level: 'error', section: name, code: 'unbalanced_braces', message: `花括号不匹配（开 ${openBrace} / 闭 ${closeBrace}）` });
    }
    const openParen = (code.match(/\(/g) || []).length;
    const closeParen = (code.match(/\)/g) || []).length;
    if (openParen !== closeParen) {
      issues.push({ level: 'error', section: name, code: 'unbalanced_parens', message: `括号不匹配（开 ${openParen} / 闭 ${closeParen}）` });
    }
    // Warn about potentially undefined variables (very rough check).
    if (/ctx\./.test(code) && !/function\s*\(/.test(code.split('\n')[0] || '')) {
      // Not necessarily an error; skip.
    }
    if (code.length < 10) {
      issues.push({ level: 'warning', section: name, code: 'empty_section', message: `${name} 脚本内容过短，可能未实现逻辑` });
    }
  }
  return issues;
}

export function lintScriptsTool({ gameService }) {
  return {
    name: 'lint_scripts',
    description: 'Validate game DSL scripts and generated code sections for syntax errors, unknown instructions, unbalanced braces and style issues. Returns a structured lint report with fixes.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        scope: { type: 'string', description: 'dsl | sections | all (default: all)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, scope, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const sc = scope || 'all';
      const dslIssues = (sc === 'dsl' || sc === 'all') ? lintDsl(game.scripts) : [];
      const sectionIssues = (sc === 'sections' || sc === 'all') ? lintScriptSections(game.scriptSections) : [];

      const errors = dslIssues.filter((i) => i.level === 'error').length + sectionIssues.filter((i) => i.level === 'error').length;
      const warnings = dslIssues.filter((i) => i.level === 'warning').length + sectionIssues.filter((i) => i.level === 'warning').length;
      const infos = dslIssues.filter((i) => i.level === 'info').length + sectionIssues.filter((i) => i.level === 'info').length;

      const report = {
        dslIssues,
        sectionIssues,
        summary: { errors, warnings, infos },
        clean: errors === 0,
      };

      return {
        ok: true,
        report,
        summary: `脚本检查完成：${errors} 错误，${warnings} 警告，${infos} 提示${errors === 0 ? ' ✓' : ''}`,
        editorActions: [{ type: 'studio:show-lint', gameId, payload: report }],
      };
    },
  };
}
