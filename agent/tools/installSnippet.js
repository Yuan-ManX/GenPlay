/**
 * installSnippet tool - installs a reusable code snippet from the shared
 * asset library into a target game. Snippets include game logic blocks,
 * node presets, and gameplay recipes from GenPlay or the community.
 */
export function installSnippetTool({ gameService, assetLibrary }) {
  return {
    name: 'install_snippet',
    description: 'Install a logic snippet / gameplay recipe from the asset library into a target game. Known keys: double_jump, dash_attack, collectible_coin, boss_wave, checkpoint, dialogue_tree, achievement_trigger.',
    parameters: {
      type: 'object',
      required: ['gameId', 'snippetKey'],
      properties: {
        gameId: { type: 'string' },
        snippetKey: { type: 'string', description: 'Snippet identifier from asset library' },
      },
    },
    async execute({ gameId, snippetKey, sessionId }) {
      if (!gameId) return { ok: false, error: 'gameId required' };
      if (!snippetKey) return { ok: false, error: 'snippetKey required' };
      const result = await gameService.installSnippet(gameId, snippetKey);
      if (!result?.ok) {
        const available = assetLibrary ? assetLibrary.listSnippets?.().map((s) => s.key) || [] : [];
        return {
          ok: false,
          error: result?.error || 'Snippet install failed',
          summary: `安装失败，可选择的片段有：${available.join('、') || '无'}`,
          availableKeys: available,
        };
      }
      return {
        ok: true,
        summary: `已安装代码片段 ${snippetKey}`,
        game: result.game,
        editorActions: [
          { type: 'studio:refresh-game', payload: { gameId } },
          { type: 'studio:focus-code', gameId, payload: { section: 'scripts' } },
        ],
      };
    },
  };
}
