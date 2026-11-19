/**
 * manage_environment - Configure the ambient environment of a game:
 * day/night cycle, weather, color grading and vignette. Stored on
 * game.environment and rendered live by the preview + playable build
 * through the shared runtime presentation layer.
 */

const CYCLES = ['day', 'night', 'dusk', 'dawn', 'auto'];
const WEATHERS = ['none', 'rain', 'snow', 'petals', 'sparks', 'bubbles', 'stars', 'embers', 'confetti'];
const GRADINGS = ['none', 'warm', 'cool', 'noir', 'vivid'];
const CYCLE_LABELS = { day: '白天', night: '黑夜', dusk: '黄昏', dawn: '黎明', auto: '自动昼夜' };
const WEATHER_LABELS = {
  none: '无', rain: '下雨', snow: '下雪', petals: '花瓣', sparks: '火花',
  bubbles: '气泡', stars: '星光', embers: '余烬', confetti: '彩带',
};
const GRADING_LABELS = { none: '原色', warm: '暖色', cool: '冷色', noir: '黑白', vivid: '鲜艳' };

export function manageEnvironmentTool({ gameService }) {
  return {
    name: 'manage_environment',
    description: 'Set ambient environment: day/night/dusk/dawn/auto cycle, weather overlay, color grading and vignette strength. Changes render live in preview and exported playable HTML.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'set | clear (default set)' },
        cycle: { type: 'string', description: `one of: ${CYCLES.join(', ')}` },
        weather: { type: 'string', description: `one of: ${WEATHERS.join(', ')}` },
        grading: { type: 'string', description: `one of: ${GRADINGS.join(', ')}` },
        vignette: { type: 'number', description: '0 - 1 corner darkening strength' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, action, cycle, weather, grading, vignette }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || 'set').toLowerCase();
      if (!['set', 'clear'].includes(act)) {
        return { ok: false, error: 'action must be set | clear' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      if (act === 'clear') {
        const updated = await gameService.update(gameId, { environment: null });
        return {
          ok: true,
          game: updated,
          environment: null,
          summary: '已清除环境氛围设置，恢复默认白昼呈现',
          editorActions: [{ type: 'studio:set-environment', gameId, payload: { environment: null } }],
        };
      }

      const prev = game.environment && typeof game.environment === 'object' ? game.environment : {};
      const environment = {
        cycle: CYCLES.includes(cycle) ? cycle : (prev.cycle || 'day'),
        weather: WEATHERS.includes(weather) ? weather : (prev.weather || 'none'),
        grading: GRADINGS.includes(grading) ? grading : (prev.grading || 'none'),
        vignette: vignette !== undefined
          ? Math.max(0, Math.min(1, Number(vignette) || 0))
          : (prev.vignette ?? 0),
      };
      // Normalize 'none' grading away to keep the payload compact.
      if (environment.grading === 'none') delete environment.grading;

      const updated = await gameService.update(gameId, { environment });
      const parts = [`${CYCLE_LABELS[environment.cycle]}`];
      if (environment.weather !== 'none') parts.push(`天气·${WEATHER_LABELS[environment.weather]}`);
      if (environment.grading) parts.push(`调色·${GRADING_LABELS[environment.grading]}`);
      if (environment.vignette) parts.push(`暗角·${Math.round(environment.vignette * 100)}%`);
      return {
        ok: true,
        game: updated,
        environment,
        summary: `环境氛围已更新：${parts.join('，')}。预览与导出游戏实时生效`,
        editorActions: [{ type: 'studio:set-environment', gameId, payload: { environment } }],
      };
    },
  };
}
