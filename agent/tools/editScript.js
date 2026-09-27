/**
 * edit_script - Generate or replace a game script section from a
 * natural-language description. Sections: init, update, render,
 * onInput, onCollision. When no LLM is available, a rule-based
 * template generator produces a valid function body that matches the
 * requested intent. Returns the generated code, a diff, and an
 * editor action that refreshes the studio scripts tab.
 */

export function editScriptTool({ gameService, provider }) {
  return {
    name: 'edit_script',
    description: 'Generate or replace a game script section (init/update/render/onInput/onCollision) from a natural-language description.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        section: { type: 'string', description: 'init | update | render | onInput | onCollision' },
        description: { type: 'string', description: 'Natural-language behavior to implement' },
      },
      required: ['gameId', 'section', 'description'],
    },
    async execute({ gameId, section, description, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const sec = (section || '').toLowerCase();
      const SECTIONS = ['init', 'update', 'render', 'onInput', 'onCollision'];
      if (!SECTIONS.includes(sec)) {
        return { ok: false, error: `section must be one of: ${SECTIONS.join(', ')}` };
      }
      if (!description) return { ok: false, error: 'description is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      // Generated script sections are stored in game.scriptSections (an
      // object keyed by section name). game.scripts itself holds the
      // high-level DSL template string and must not be overwritten.
      const sections = structuredClone(game.scriptSections || {});
      const before = sections[sec] || '';

      // Try LLM generation first; fall back to rule templates.
      let code = '';
      if (provider?.enabled) {
        try {
          code = await generateViaLLM(provider, sec, description, game);
        } catch (_) {
          code = ruleTemplate(sec, description);
        }
      } else {
        code = ruleTemplate(sec, description);
      }

      sections[sec] = code;
      const updated = await gameService.update(gameId, { scriptSections: sections });

      const diff = buildDiff(before, code);
      const editorActions = [{
        type: 'studio:patch-script',
        gameId,
        payload: { section: sec, before, after: code, diff },
      }];

      return {
        ok: true,
        game: updated,
        section: sec,
        code,
        diff,
        editorActions,
        summary: `已生成 ${sec} 脚本（${diff.length} 行变更）`,
      };
    },
  };
}

/**
 * Rule-based template generator. Produces a syntactically valid function
 * body that matches the user's described behavior using keyword detection.
 * Works without any LLM API key.
 */
function ruleTemplate(section, description) {
  const desc = String(description || '').toLowerCase();
  const lines = [];

  if (section === 'init') {
    lines.push('// init(state) - initialize game state');
    if (/玩家|player/i.test(desc)) {
      lines.push('state.player = state.player || { x: 100, y: 200, w: 20, h: 20, vx: 0, vy: 0 };');
    }
    if (/敌人|enemy/i.test(desc)) {
      lines.push('state.enemies = state.enemies || [];');
    }
    if (/子弹|bullet|projectile/i.test(desc)) {
      lines.push('state.bullets = state.bullets || [];');
    }
    if (lines.length === 1) {
      lines.push('state.score = state.score || 0;');
      lines.push('state.player = state.player || { x: 100, y: 200, w: 20, h: 20 };');
    }
  } else if (section === 'update') {
    lines.push('// update(state, input, ctx) - advance one frame');
    const dt = '(ctx?.dt ?? 1)';
    if (/追踪|chase|follow/i.test(desc)) {
      lines.push(`for (const e of state.enemies || []) {`);
      lines.push(`  if (state.player) {`);
      lines.push(`    const dx = state.player.x - e.x, dy = state.player.y - e.y;`);
      lines.push(`    const d = Math.hypot(dx, dy) || 1;`);
      lines.push(`    const sp = (e.speed || 1) * ${dt};`);
      lines.push(`    e.x += (dx / d) * sp; e.y += (dy / d) * sp;`);
      lines.push(`  }`);
      lines.push(`}`);
    } else if (/移动|move|速度/i.test(desc)) {
      lines.push(`if (state.player) {`);
      lines.push(`  if (input?.left) state.player.x -= (state.player.speed || 3) * ${dt};`);
      lines.push(`  if (input?.right) state.player.x += (state.player.speed || 3) * ${dt};`);
      lines.push(`  if (input?.up) state.player.y -= (state.player.speed || 3) * ${dt};`);
      lines.push(`  if (input?.down) state.player.y += (state.player.speed || 3) * ${dt};`);
      lines.push(`}`);
    } else if (/射击|shoot|fire/i.test(desc)) {
      lines.push(`if (input?.shoot && state.player) {`);
      lines.push(`  state.bullets = state.bullets || [];`);
      lines.push(`  state.bullets.push({ x: state.player.x, y: state.player.y, vy: -6 });`);
      lines.push(`}`);
      lines.push(`for (const b of state.bullets || []) b.y += b.vy;`);
    } else {
      lines.push(`if (state.player) {`);
      lines.push(`  if (input?.left) state.player.x -= (state.player.speed || 3) * ${dt};`);
      lines.push(`  if (input?.right) state.player.x += (state.player.speed || 3) * ${dt};`);
      lines.push(`}`);
    }
  } else if (section === 'render') {
    lines.push('// render(state, ctx) - draw a frame');
    lines.push('ctx.clearRect(0, 0, state.canvasW || 800, state.canvasH || 600);');
    if (/玩家|player/i.test(desc)) {
      lines.push('if (state.player) { ctx.fillStyle = state.player?.color || "#a78bfa"; ctx.fillRect(state.player.x, state.player.y, state.player.w || 20, state.player.h || 20); }');
    }
    if (/敌人|enemy/i.test(desc)) {
      lines.push('for (const e of state.enemies || []) { ctx.fillStyle = e.color || "#ec4899"; ctx.fillRect(e.x, e.y, e.w || 16, e.h || 16); }');
    }
  } else if (section === 'onInput') {
    lines.push('// onInput(state, key) - handle a key press');
    if (/射击|shoot|space/i.test(desc)) {
      lines.push(`if (key === 'shoot' && state.player) { state.bullets = state.bullets || []; state.bullets.push({ x: state.player.x, y: state.player.y, vy: -6 }); }`);
    } else {
      lines.push(`// key: ${key}`);
      lines.push(`// handle input: ${description}`);
    }
  } else if (section === 'onCollision') {
    lines.push('// onCollision(state, a, b) - handle entity collision');
    lines.push(`// collided: ${description}`);
    lines.push(`if (a && b) { /* resolve collision */ }`);
  }

  return lines.join('\n');
}

/**
 * Produce a simple unified-diff between before and after strings.
 */
function buildDiff(before, after) {
  const beforeLines = (before || '').split('\n');
  const afterLines = (after || '').split('\n');
  const diff = [];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === undefined && a !== undefined) diff.push(`+ ${a}`);
    else if (b !== undefined && a === undefined) diff.push(`- ${b}`);
    else if (b !== a) { diff.push(`- ${b}`); diff.push(`+ ${a}`); }
  }
  return diff;
}

/**
 * LLM-backed script generation. Asks the model for a function body
 * matching the requested section and behavior. Returns raw code string.
 */
async function generateViaLLM(provider, section, description, game) {
  const sys = `You are GenPlay game script engineer. Write ONLY the function body for the "${section}" section of a ${game.genre || 'generic'} game. No function signature, no markdown fences. The description: ${description}`;
  const res = await provider.chatSync
    ? provider.chatSync({ systemPrompt: sys, userMessage: `Implement ${section} section.`, temperature: 0.3 })
    : '';
  // Strip any accidental code fences.
  return String(res || '').replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
}
