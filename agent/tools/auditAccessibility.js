/**
 * audit_accessibility - Audit a game for accessibility concerns.
 * Checks color contrast ratios, keyboard-only playability, subtitle support,
 * colorblind-safe palette, and motion/epilepsy safety. Produces a structured
 * accessibility report with severity-graded issues and concrete fixes.
 * AI-native: when LLM is available, generates natural-language remediation
 * suggestions tailored to the game's genre and theme.
 */

// WCAG 2.1 AA contrast threshold for normal text.
const AA_CONTRAST = 4.5;
// WCAG 2.1 AA contrast threshold for large text.
const AA_LARGE_CONTRAST = 3.0;

// Parse a hex color (#rgb or #rrggbb) into { r, g, b }.
function parseHex(hex) {
  if (!hex) return null;
  const m = String(hex).replace('#', '');
  if (m.length === 3) {
    return { r: parseInt(m[0] + m[0], 16), g: parseInt(m[1] + m[1], 16), b: parseInt(m[2] + m[2], 16) };
  }
  if (m.length === 6) {
    return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
  }
  return null;
}

// Relative luminance per WCAG.
function luminance({ r, g, b }) {
  const srgb = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

// Contrast ratio between two colors.
function contrastRatio(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

// Colorblind safety: check that palette colors are distinguishable by hue
// AND brightness, not just hue (deuteranopia/protanopia safety).
function colorblindSafe(palette) {
  if (!palette || typeof palette !== 'object') return true;
  const colors = Object.values(palette).filter((c) => typeof c === 'string' && c.startsWith('#'));
  if (colors.length < 2) return true;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = parseHex(colors[i]);
      const b = parseHex(colors[j]);
      if (!a || !b) continue;
      // If two colors share similar luminance but different hue, colorblind
      // users may not distinguish them.
      const lumDiff = Math.abs(luminance(a) - luminance(b));
      if (lumDiff < 0.1) return false;
    }
  }
  return true;
}

export function auditAccessibilityTool({ gameService, provider }) {
  return {
    name: 'audit_accessibility',
    description: 'Audit game accessibility: color contrast, keyboard-only playability, subtitle support, colorblind-safe palette, and motion safety. Returns a structured report with fixes.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        focus: { type: 'string', description: 'contrast | controls | subtitles | colorblind | motion | all (default all)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, focus, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const scope = focus || 'all';
      const issues = [];
      const palette = game.theme?.palette || {};

      // ---- Color contrast checks ----
      if (scope === 'all' || scope === 'contrast') {
        const bg = parseHex(palette.bg);
        const fg = parseHex(palette.text || palette.fg);
        if (bg && fg) {
          const ratio = contrastRatio(bg, fg);
          if (ratio < AA_CONTRAST) {
            issues.push({
              severity: 'high', area: 'contrast', code: 'low_text_contrast',
              message: `文本对比度 ${ratio.toFixed(1)}:1 低于 WCAG AA 标准 ${AA_CONTRAST}:1`,
              fix: '提高前景色与背景色的亮度差异',
              value: ratio, threshold: AA_CONTRAST,
            });
          }
        }
        const accent = parseHex(palette.accent);
        if (bg && accent) {
          const ratio = contrastRatio(bg, accent);
          if (ratio < AA_LARGE_CONTRAST) {
            issues.push({
              severity: 'medium', area: 'contrast', code: 'low_accent_contrast',
              message: `强调色对比度 ${ratio.toFixed(1)}:1 偏低`,
              fix: '选择更亮或更暗的强调色',
              value: ratio, threshold: AA_LARGE_CONTRAST,
            });
          }
        }
      }

      // ---- Colorblind safety ----
      if (scope === 'all' || scope === 'colorblind') {
        const safe = colorblindSafe(palette);
        if (!safe) {
          issues.push({
            severity: 'medium', area: 'colorblind', code: 'hue_only_distinction',
            message: '配色可能仅靠色相区分，色觉障碍玩家难以辨别',
            fix: '为不同状态增加形状、图标或亮度差异',
          });
        }
        const meta = game.meta || {};
        if (!meta.accessibility?.colorBlind) {
          issues.push({
            severity: 'low', area: 'colorblind', code: 'colorblind_mode_off',
            message: '未启用色盲模式配色',
            fix: '在元设置中开启色盲模式，或用工具自动切换',
          });
        }
      }

      // ---- Keyboard / control accessibility ----
      if (scope === 'all' || scope === 'controls') {
        const scripts = game.scripts || '';
        const usesPointerOnly = /onPointer|onClick|onMouse/i.test(scripts) && !/input\.|key|keyboard/i.test(scripts);
        if (usesPointerOnly) {
          issues.push({
            severity: 'high', area: 'controls', code: 'pointer_only',
            message: '游戏逻辑仅依赖指针输入，键盘玩家无法操作',
            fix: '添加键盘按键映射（如 input.space、input.arrows）',
          });
        }
        const genre = (game.genre || '').toLowerCase();
        const genresNeedingPause = ['shooter', 'platformer', 'racing', 'rpg', 'battle', 'roguelike', 'metroidvania'];
        if (genresNeedingPause.includes(genre) && !/pause|暂停|esc/i.test(scripts)) {
          issues.push({
            severity: 'low', area: 'controls', code: 'no_pause',
            message: '未检测到暂停按键，建议支持 ESC 暂停',
            fix: '添加 ESC 暂停逻辑',
          });
        }
      }

      // ---- Subtitles / caption support ----
      if (scope === 'all' || scope === 'subtitles') {
        const meta = game.meta || {};
        const npcs = game.npcs || [];
        const hasDialog = npcs.some((n) => n.dialog || n.quote);
        if (hasDialog && meta.accessibility?.subtitles === false) {
          issues.push({
            severity: 'medium', area: 'subtitles', code: 'subtitles_disabled',
            message: '存在 NPC 对话但字幕功能被关闭',
            fix: '在元设置中开启字幕与对话气泡',
          });
        }
        if (!hasDialog && npcs.length > 0) {
          issues.push({
            severity: 'low', area: 'subtitles', code: 'npc_no_dialog',
            message: 'NPC 缺少对话文本，剧情可能无法被阅读',
            fix: '为 NPC 添加 dialog 或 quote 字段',
          });
        }
      }

      // ---- Motion / epilepsy safety ----
      if (scope === 'all' || scope === 'motion') {
        const scripts = game.scripts || '';
        const hasFlashing = /flash|blink|flicker|strobe/i.test(scripts);
        if (hasFlashing) {
          issues.push({
            severity: 'high', area: 'motion', code: 'flashing_content',
            message: '检测到闪烁效果，可能引发光敏性癫痫',
            fix: '限制闪烁频率低于 3Hz，并提供减少动效选项',
          });
        }
        const cfg = game.config || {};
        if (cfg.particles && (cfg.particles.count || cfg.particles.max) > 200) {
          issues.push({
            severity: 'low', area: 'motion', code: 'heavy_particles',
            message: '粒子数量较多，可能影响低端设备或造成视觉过载',
            fix: '降低粒子数量或提供低特效模式',
          });
        }
      }

      // ---- Difficulty accessibility ----
      if (scope === 'all') {
        const cfg = game.config || {};
        const difficulty = cfg.difficulty;
        if (difficulty === 'hell' || difficulty === 'hard') {
          issues.push({
            severity: 'low', area: 'difficulty', code: 'high_difficulty',
            message: `当前难度为 ${difficulty}，建议提供简单/普通选项`,
            fix: '确保有 easy / normal 难度预设可选',
          });
        }
      }

      const errors = issues.filter((i) => i.severity === 'high').length;
      const warnings = issues.filter((i) => i.severity === 'medium').length;
      const infos = issues.filter((i) => i.severity === 'low').length;
      const score = Math.round(100 * (1 - errors * 0.25 - warnings * 0.1 - infos * 0.03));
      const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';

      // LLM enhancement: natural-language remediation summary.
      let remediation = '';
      if (provider?.enabled && provider.chat && issues.length) {
        try {
          const topIssues = issues.slice(0, 5).map((i) => `- [${i.severity}] ${i.message} → ${i.fix}`).join('\n');
          const prompt = `Given a ${game.genre} game with these accessibility issues:\n${topIssues}\nWrite a concise 2-sentence remediation summary in Chinese.`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 120 });
          if (resp?.content) remediation = resp.content.trim();
        } catch (_) { /* fall back to rule-based */ }
      }

      const report = {
        issues,
        summary: { errors, warnings, infos },
        score,
        grade,
        remediation,
        checkedAt: Date.now(),
      };

      // Persist the last accessibility report on the game.
      await gameService.update(gameId, { lastAccessibility: report });

      return {
        ok: true,
        report,
        summary: `无障碍评估：${grade} 级（${score} 分），${errors} 严重 · ${warnings} 警告 · ${infos} 提示`,
        editorActions: [{ type: 'studio:show-accessibility', gameId, payload: report }],
      };
    },
  };
}
