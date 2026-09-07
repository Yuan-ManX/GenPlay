/**
 * exploreCommunity tool - lists published games in the community feed,
 * supports genre filter, sort order (popular/recent), and fuzzy search.
 * Returns ranked cards so Agent can recommend or user can browse inside chat.
 */
export function exploreCommunityTool({ gameService }) {
  return {
    name: 'explore_community',
    description: 'Browse and search community published games. Filter by genre, sort by popularity/recent, or search by keywords.',
    parameters: {
      type: 'object',
      properties: {
        genre: { type: 'string', description: 'Genre key filter (e.g. shooter, rpg, roguelike)' },
        sort: { type: 'string', enum: ['popular', 'recent'], default: 'recent' },
        search: { type: 'string', description: 'Keyword search on title and description' },
        limit: { type: 'number', default: 10, minimum: 1, maximum: 50 },
      },
    },
    async execute({ genre, sort, search, limit, sessionId }) {
      const rows = await gameService.listPublished({ genre, sort, search, limit: Number(limit) || 10 });
      const summary = rows.length
        ? `社区展示 ${rows.length} 个作品：${rows.slice(0, 5).map((r) => `《${r.title}》@${r.author}`).join('、')}${rows.length > 5 ? '…' : ''}`
        : '暂无符合条件的社区作品。';
      return {
        ok: true,
        summary,
        results: rows,
        total: rows.length,
        editorActions: [
          { type: 'studio:explore-published', payload: { genre, sort, search, results: rows } },
        ],
      };
    },
  };
}
