/**
 * searchAssetLibrary tool - Browse the shared asset library from Agent chat.
 * Search by keyword, tag, kind; list themes/scenarios/snippets/node presets;
 * install a snippet directly into a game's scripts + node graph.
 */
export function searchAssetLibraryTool(services = {}) {
  const { assetLibrary, gameService } = services;
  return {
    name: 'search_asset_library',
    description: 'Search the GenPlay shared asset library for themes, scenarios, snippets and node presets. Optionally install a snippet directly into a target game.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'object', description: '{ text, tag, kind, limit }' },
        gameId: { type: 'string', description: 'Optional target game to install an asset into' },
        installSnippetKey: { type: 'string', description: 'If provided, install this snippet into gameId immediately' },
      },
    },
    async execute({ query = {}, gameId, installSnippetKey, sessionId }) {
      if (!assetLibrary) return { ok: false, error: 'Asset library not initialized' };
      const results = assetLibrary.search(query);

      let installResult = null;
      const actions = [];
      if (gameId && installSnippetKey) {
        const game = await gameService?.getById?.(gameId);
        if (game) {
          const patch = assetLibrary.installSnippet(game, installSnippetKey);
          if (patch) {
            await gameService.update(gameId, patch);
            installResult = { snippetKey: installSnippetKey, applied: true };
            actions.push({
              type: 'studio:refresh-game',
              payload: { gameId },
            });
          }
        }
      }

      return {
        ok: true,
        summary: `资源库返回 ${results.length} 条结果${installResult ? '，已安装 1 个片段' : ''}`,
        results,
        totalTags: assetLibrary.allTags().length,
        installResult,
        editorActions: actions,
      };
    },
  };
}
