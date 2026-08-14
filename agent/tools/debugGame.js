/**
 * debug_game - 排错工具
 * 对游戏脚本做静态检查，输出问题定位与修复建议。
 */
export function debugGameTool({ gameService }) {
  return {
    name: 'debug_game',
    description: '对游戏逻辑脚本进行排错检查，输出问题定位与修复建议',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
      },
    },
    async execute({ gameId }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const script = game.scripts || '';
      const diagnostics = [];

      if (!script.trim()) {
        diagnostics.push({ level: 'error', line: 0, message: '游戏尚未生成可执行逻辑脚本' });
      } else {
        const lines = script.split('\n');
        lines.forEach((line, i) => {
          const n = i + 1;
          if (line.includes('function') && !line.includes('{')) {
            diagnostics.push({ level: 'warn', line: n, message: '函数定义可能缺少大括号' });
          }
          if (/(var |let |const )\w+\s*$/.test(line)) {
            diagnostics.push({ level: 'warn', line: n, message: '声明了变量但未赋值' });
          }
          if (line.includes('TODO') || line.includes('FIXME')) {
            diagnostics.push({ level: 'info', line: n, message: '发现未完成的占位标记' });
          }
        });
      }

      const summary = diagnostics.length
        ? `排错完成，发现 ${diagnostics.length} 项：` +
          diagnostics.filter((d) => d.level === 'error').length + ' 错误、' +
          diagnostics.filter((d) => d.level === 'warn').length + ' 警告。' +
          (diagnostics[0] ? ` 首个问题：第 ${diagnostics[0].line} 行 ${diagnostics[0].message}` : '')
        : '未发现明显问题，脚本结构良好。';

      await gameService.update(gameId, {
        debugReport: { diagnostics, at: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      });

      return { ok: true, diagnostics, summary };
    },
  };
}
