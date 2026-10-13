/**
 * profile_game - Simulated performance profiling for a game.
 * Estimates FPS, entity count, memory usage, draw calls and potential
 * bottlenecks based on the game's config and content. Does not require
 * actually running the game; uses heuristic models derived from config.
 * Produces a profile report with severity-graded bottlenecks and
 * optimization suggestions.
 */

export function profileGameTool({ gameService }) {
  return {
    name: 'profile_game',
    description: 'Run a simulated performance profile. Estimates FPS, entity count, memory, draw calls and identifies bottlenecks with optimization suggestions. No actual game execution required.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        duration: { type: 'number', description: 'Simulation window in seconds (default 5)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, duration, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const cfg = game.config || {};
      const enemy = cfg.enemy || {};
      const player = cfg.player || {};
      const dur = typeof duration === 'number' ? duration : 5;

      // Estimate concurrent entities.
      const enemyCount = enemy.count ?? 3;
      const bulletEstimate = (player.fireRate ? Math.round(60 / player.fireRate) : 4) * enemyCount;
      const particleEstimate = enemyCount * 5;
      const totalEntities = 1 + enemyCount + bulletEstimate + particleEstimate;

      // Estimate memory (rough model: 2KB per entity + 50KB base).
      const memoryKB = 50 + totalEntities * 2;

      // Estimate draw calls (1 per entity + background + UI).
      const drawCalls = 2 + totalEntities;

      // Estimate FPS based on entity count and complexity.
      const complexityFactor = 1 + (totalEntities > 100 ? (totalEntities - 100) / 200 : 0);
      let fps = Math.round(60 / complexityFactor);
      fps = Math.max(1, Math.min(60, fps));

      // Bottleneck detection.
      const bottlenecks = [];
      if (totalEntities > 150) {
        bottlenecks.push({ severity: 'high', area: 'entity_count', value: totalEntities, threshold: 150, suggestion: '实体数量过多，考虑降低敌人生成频率或子弹上限' });
      }
      if (drawCalls > 120) {
        bottlenecks.push({ severity: 'medium', area: 'draw_calls', value: drawCalls, threshold: 120, suggestion: '绘制调用偏多，可合并精灵或使用图集减少批次' });
      }
      if (fps < 30) {
        bottlenecks.push({ severity: 'high', area: 'fps', value: fps, threshold: 30, suggestion: '帧率偏低，减少同时存在的实体或降低粒子效果' });
      }
      if (memoryKB > 512) {
        bottlenecks.push({ severity: 'medium', area: 'memory', value: memoryKB, threshold: 512, suggestion: '内存占用较高，检查是否有大型纹理或未释放资源' });
      }
      if (enemy.spawnEvery && enemy.spawnEvery < 20) {
        bottlenecks.push({ severity: 'low', area: 'spawn_rate', value: enemy.spawnEvery, threshold: 20, suggestion: '敌人生成过快，可能导致短时间内实体暴增' });
      }

      const score = Math.round(100 * (1 - bottlenecks.filter((b) => b.severity === 'high').length * 0.3 - bottlenecks.filter((b) => b.severity === 'medium').length * 0.15));
      const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';

      const report = {
        fps,
        entities: {
          player: 1,
          enemies: enemyCount,
          bullets: bulletEstimate,
          particles: particleEstimate,
          total: totalEntities,
        },
        memoryKB,
        drawCalls,
        duration: dur,
        bottlenecks,
        score,
        grade,
      };

      // Persist the profile on the game for the analytics tab.
      await gameService.update(gameId, { lastProfile: report });

      return {
        ok: true,
        report,
        summary: `性能评估：${grade} 级（${score} 分），预估 ${fps} FPS，${totalEntities} 实体，${bottlenecks.length} 个瓶颈`,
        editorActions: [{ type: 'studio:show-profile', gameId, payload: report }],
      };
    },
  };
}
