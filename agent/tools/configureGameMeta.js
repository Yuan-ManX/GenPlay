/**
 * configureGameMeta tool - High-level game configuration meta switches:
 * multiplayer toggles, collaboration/co-op, monetization (premium/ads),
 * achievements, leaderboards, save/slots and accessibility.
 * Produces a `meta` block that lives on game.config.meta alongside gameplay.
 */
export function configureGameMetaTool(services = {}) {
  return {
    name: 'configure_game_meta',
    description: 'Configure top-level game meta switches: multiplayer/coop, collaboration, monetization, achievements, leaderboards, save slots, accessibility flags.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        multiplayer: { type: 'object', description: '{ mode: "off"|"local"|"online"|"turn_based", maxPlayers: number }' },
        collaboration: { type: 'object', description: '{ enabled: boolean, roles: ["designer","player","coder"] }' },
        monetization: { type: 'object', description: '{ model: "free"|"premium"|"ads"|"iap", adsEnabled: boolean, iapSkuIds: [] }' },
        achievements: { type: 'object', description: '{ enabled: boolean, list: [{id,name,desc,condition}] }' },
        leaderboards: { type: 'object', description: '{ enabled: boolean, boards: [{id,label,scoring}] }' },
        saveSystem: { type: 'object', description: '{ slots: number, autoSave: boolean, cloudSync: boolean }' },
        accessibility: { type: 'object', description: '{ colorBlind: boolean, subtitles: boolean, difficultyAssist: boolean, inputRemap: boolean, reducedMotion: boolean }' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, multiplayer, collaboration, monetization, achievements, leaderboards, saveSystem, accessibility, sessionId }) {
      const { gameService } = services;
      const existing = (await gameService?.getById?.(gameId)) || null;
      const baseConfig = existing?.config || {};
      const prev = baseConfig.meta || {};
      const next = {
        multiplayer: mergeMeta(prev.multiplayer, multiplayer, { mode: 'off', maxPlayers: 1 }),
        collaboration: mergeMeta(prev.collaboration, collaboration, { enabled: false, roles: ['player'] }),
        monetization: mergeMeta(prev.monetization, monetization, { model: 'free', adsEnabled: false, iapSkuIds: [] }),
        achievements: mergeMeta(prev.achievements, achievements, { enabled: false, list: [] }),
        leaderboards: mergeMeta(prev.leaderboards, leaderboards, { enabled: false, boards: [] }),
        saveSystem: mergeMeta(prev.saveSystem, saveSystem, { slots: 3, autoSave: true, cloudSync: false }),
        accessibility: mergeMeta(prev.accessibility, accessibility, { colorBlind: false, subtitles: false, difficultyAssist: false, inputRemap: false, reducedMotion: false }),
      };

      const changes = [];
      if (multiplayer) changes.push(`多人: ${next.multiplayer.mode}`);
      if (collaboration) changes.push(`协作: ${next.collaboration.enabled ? '开' : '关'}`);
      if (monetization) changes.push(`变现: ${next.monetization.model}`);
      if (achievements) changes.push(`成就: ${next.achievements.list.length}项`);
      if (leaderboards) changes.push(`排行榜: ${next.leaderboards.boards.length}个`);
      if (saveSystem) changes.push(`存档: ${next.saveSystem.slots}槽`);
      if (accessibility) changes.push('无障碍选项已更新');

      if (gameService?.update) {
        await gameService.update(gameId, {
          config: { ...(baseConfig || {}), meta: next },
        });
      }

      return {
        ok: true,
        summary: changes.length ? `游戏高级配置已更新：${changes.join(' · ')}` : '已保存游戏元配置',
        meta: next,
        changes,
        editorActions: [
          {
            type: 'studio:set-meta',
            payload: { gameId, meta: next, changes },
          },
          {
            type: 'studio:patch-config',
            payload: { gameId, after: { meta: next }, changes },
          },
        ],
      };
    },
  };
}

function mergeMeta(prev = {}, next = {}, dft) {
  if (!next || typeof next !== 'object') return prev || { ...dft };
  return { ...dft, ...(prev || {}), ...next };
}
