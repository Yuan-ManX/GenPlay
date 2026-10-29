/**
 * build_playable - Compile a game into a single self-contained HTML5 file.
 *
 * Unlike export_game (which produces a re-importable JSON bundle), this tool
 * emits a ready-to-run page: it inlines the gameplay engine, the game config
 * and a canvas runtime, so the result works offline in any modern browser.
 */
import { buildPlayableHtml } from '../export/playableBuilder.js';

export function buildPlayableTool({ gameService }) {
  return {
    name: 'build_playable',
    description:
      'Build a game into a standalone single-file HTML5 page that runs offline in any browser. Returns the HTML plus download metadata.',
    parameters: {
      type: 'object',
      required: ['gameId'],
      properties: {
        gameId: { type: 'string', description: 'Target game ID' },
        inline: { type: 'boolean', description: 'Return the full HTML source in the tool result (default true)' },
      },
    },
    async execute({ gameId, inline = true }) {
      if (!gameService) return { ok: false, error: 'Game service unavailable' };
      if (!gameId) return { ok: false, error: 'gameId required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: 'Game not found', summary: '构建失败：游戏不存在' };

      const built = await buildPlayableHtml(game);
      if (!built.ok) return { ok: false, error: built.error, summary: '构建失败：玩法引擎不可用' };

      const sizeKb = (built.bytes / 1024).toFixed(2);
      const playUrl = `/api/games/${encodeURIComponent(gameId)}/playable`;

      return {
        ok: true,
        summary: `已构建可独立运行的《${game.name}》HTML5 游戏（${sizeKb} KB）`,
        fileName: built.fileName,
        bytes: built.bytes,
        sizeKb: parseFloat(sizeKb),
        genre: built.genre,
        label: built.label,
        playUrl,
        html: inline ? built.html : undefined,
        editorActions: [
          {
            type: 'studio:playable-ready',
            payload: {
              gameId,
              name: game.name,
              fileName: built.fileName,
              bytes: built.bytes,
              sizeKb: parseFloat(sizeKb),
              genre: built.genre,
              label: built.label,
              playUrl,
            },
          },
        ],
      };
    },
  };
}
