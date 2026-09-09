/**
 * debug_with_diffs - 带前后差异的深度调试工具
 * 先做静态检查，若发现问题则自动应用补丁修复，输出 before/after diff。
 */
export function debugWithDiffsTool({ gameService }) {
  return {
    name: 'debug_with_diffs',
    description: '深度调试游戏：静态检查 + 自动修复 + 输出 before/after 差异对比',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
        applyFix: { type: 'boolean', description: '是否自动应用修复（默认 true）' },
      },
    },
    async execute({ gameId, applyFix = true }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const diagnostics = [];
      const fixes = [];
      let newConfig = structuredClone(game.config || {});
      let newScripts = game.scripts || '';

      // Config checks
      if (!newConfig.player) {
        diagnostics.push({ level: 'error', field: 'config.player', message: '缺少玩家配置节点' });
        newConfig.player = { hp: 3, speed: 4 };
        fixes.push('注入默认 player: { hp:3, speed:4 }');
      } else {
        if (typeof newConfig.player.speed !== 'number' || newConfig.player.speed <= 0) {
          diagnostics.push({ level: 'warn', field: 'config.player.speed', message: '玩家速度非法或为 0' });
          newConfig.player.speed = 4;
          fixes.push('修正 player.speed = 4');
        }
        if (typeof newConfig.player.hp !== 'number' || newConfig.player.hp <= 0) {
          diagnostics.push({ level: 'warn', field: 'config.player.hp', message: '玩家血量非法或为 0' });
          newConfig.player.hp = 3;
          fixes.push('修正 player.hp = 3');
        }
      }

      if (game.genre === 'tower' && !newConfig.path?.points?.length) {
        diagnostics.push({ level: 'error', field: 'config.path.points', message: '塔防缺少敌人路径点' });
        newConfig.path = {
          points: [[0, 200], [200, 200], [200, 100], [450, 100], [450, 300], [640, 300]],
        };
        fixes.push('注入默认塔防路径 6 点');
      }
      if (game.genre === 'snake' && !newConfig.grid?.cols) {
        diagnostics.push({ level: 'warn', field: 'config.grid', message: '贪吃蛇缺少网格配置' });
        newConfig.grid = { cellSize: 20, cols: 24, rows: 16 };
        fixes.push('注入默认 snake 网格 24x16');
      }

      // Script checks
      if (!newScripts.trim()) {
        diagnostics.push({ level: 'error', field: 'scripts', message: '脚本为空' });
        newScripts = `// GenPlay ${game.genre} Auto Script
genplay::spawn player { x: center, y: bottom }
on hit(player, enemy): genplay::gameover
`;
        fixes.push('写入最小可用启动脚本');
      } else {
        const lines = newScripts.split('\n');
        const scriptFixes = [];
        lines.forEach((line, i) => {
          const n = i + 1;
          if (line.includes('genplay::') && line.trim().endsWith(':')) {
            diagnostics.push({ level: 'warn', line: n, message: 'DSL 指令可能缺少执行体' });
            scriptFixes.push(`第 ${n} 行提示补全`);
          }
          if (line.includes('TODO') || line.includes('FIXME')) {
            diagnostics.push({ level: 'info', line: n, message: '发现占位标记' });
          }
        });
        fixes.push(...scriptFixes);
      }

      const before = { config: game.config || {}, scripts: game.scripts || '' };
      let after = before;
      let updated = game;
      if (applyFix && fixes.length) {
        after = { config: newConfig, scripts: newScripts };
        updated = await gameService.update(gameId, {
          config: newConfig,
          scripts: newScripts,
          debugReport: { diagnostics, at: new Date().toISOString(), autoFixed: true },
          updatedAt: new Date().toISOString(),
        });
      } else {
        await gameService.update(gameId, {
          debugReport: { diagnostics, at: new Date().toISOString(), autoFixed: false },
          updatedAt: new Date().toISOString(),
        });
      }

      const diff = computeLightDiff(before, after);
      const editorActions = [{
        type: 'studio:apply-diff',
        gameId,
        payload: { before, after, diff, diagnostics, applied: applyFix && fixes.length > 0 },
      }];

      const summary = [
        `深度排错「${game.name}」完成。`,
        `发现 ${diagnostics.length} 项问题：${diagnostics.filter((d) => d.level === 'error').length} 错误 / ${diagnostics.filter((d) => d.level === 'warn').length} 警告。`,
        applyFix && fixes.length ? `自动修复 ${fixes.length} 处：${fixes.slice(0, 3).join('、')}${fixes.length > 3 ? '…' : ''}。` : '未自动应用修复。',
      ].join('');

      return {
        ok: true,
        game: updated,
        diagnostics,
        fixes,
        before,
        after,
        diff,
        editorActions,
        summary,
      };
    },
  };
}

function computeLightDiff(before, after) {
  const diff = {};
  const beforeKeys = Object.keys(before.config || {});
  const afterKeys = Object.keys(after.config || {});
  const all = Array.from(new Set([...beforeKeys, ...afterKeys]));
  for (const k of all) {
    const b = JSON.stringify(before.config?.[k]);
    const a = JSON.stringify(after.config?.[k]);
    if (b !== a) diff[`config.${k}`] = { before: before.config?.[k], after: after.config?.[k] };
  }
  if (before.scripts !== after.scripts) {
    diff.scripts = {
      beforeLen: before.scripts?.length || 0,
      afterLen: after.scripts?.length || 0,
      changed: true,
    };
  }
  return diff;
}
