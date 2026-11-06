/**
 * manage_community - Read and interact with the published community feed.
 * Actions: list, detail, play, like, comment, comments.
 * Play/like bumps are persisted on the published record, comments are stored
 * in the community event log so every surface (studio, REST, export share)
 * sees the same interaction history.
 */

const ACTIONS = ['list', 'detail', 'play', 'like', 'comment', 'comments'];

export function manageCommunityTool({ gameService }) {
  return {
    name: 'manage_community',
    description: 'Browse and interact with community published games: list the feed, read a game detail with comments, bump play counts, like a work, or post and list comments. Use share codes (gp_xxx) to target a specific work.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ACTIONS, description: 'list | detail | play | like | comment | comments' },
        shareCode: { type: 'string', description: 'Published share code, e.g. gp_abc123' },
        author: { type: 'string', description: 'Comment author name (defaults to Anonymous)' },
        text: { type: 'string', description: 'Comment text for the comment action' },
        genre: { type: 'string', description: 'Genre filter for the list action' },
        sort: { type: 'string', enum: ['popular', 'recent'], description: 'Feed ordering for the list action' },
        search: { type: 'string', description: 'Keyword search for the list action' },
        limit: { type: 'number', description: 'Max rows for list/comments' },
      },
      required: ['action'],
    },
    async execute({ action, shareCode, author, text, genre, sort, search, limit }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      const act = (action || 'list').toLowerCase();
      if (!ACTIONS.includes(act)) return { ok: false, error: `action must be ${ACTIONS.join(' | ')}` };

      if (act === 'list') {
        const rows = await gameService.listPublished({
          genre, sort: sort || 'popular', search, limit: Number(limit) || 20,
        });
        const summary = rows.length
          ? `社区共 ${rows.length} 个作品：${rows.slice(0, 5).map((r) => `《${r.title}》@${r.author}`).join('、')}${rows.length > 5 ? '…' : ''}`
          : '社区暂无符合条件的作品。';
        return {
          ok: true,
          summary,
          results: rows,
          total: rows.length,
          editorActions: [{ type: 'studio:explore-published', payload: { genre, sort, search, results: rows } }],
        };
      }

      const code = String(shareCode || '').trim();
      if (!code) return { ok: false, error: 'shareCode is required for this action' };
      const rec = await gameService.getPublished(code);
      if (!rec) return { ok: false, error: `Published game not found: ${code}` };

      if (act === 'detail') {
        const comments = await gameService.listComments(code, { limit: Number(limit) || 50 });
        return {
          ok: true,
          communityGame: rec,
          comments,
          commentCount: comments.length,
          summary: `《${rec.title || rec.share_code}》@${rec.author || 'Anonymous'} · 游玩 ${rec.plays || 0} · 点赞 ${rec.likes || 0} · 评论 ${comments.length}`,
          editorActions: [{ type: 'studio:community-updated', payload: { action: 'detail', shareCode: code, communityGame: rec, comments } }],
        };
      }

      if (act === 'comments') {
        const comments = await gameService.listComments(code, { limit: Number(limit) || 50 });
        return {
          ok: true,
          comments,
          summary: comments.length ? `共 ${comments.length} 条评论` : '还没有评论，来写第一条吧。',
          editorActions: [{ type: 'studio:community-updated', payload: { action: 'comments', shareCode: code, comments } }],
        };
      }

      if (act === 'play') {
        await gameService.bumpPlay(code);
        const fresh = await gameService.getPublished(code);
        return {
          ok: true,
          communityGame: fresh,
          summary: `已记录一次游玩，《${fresh.title || code}》累计 ${fresh.plays || 0} 次`,
          editorActions: [{ type: 'studio:community-updated', payload: { action: 'play', shareCode: code, plays: fresh.plays || 0, communityGame: fresh } }],
        };
      }

      if (act === 'like') {
        await gameService.likePublished(code);
        const fresh = await gameService.getPublished(code);
        return {
          ok: true,
          communityGame: fresh,
          summary: `已点赞，《${fresh.title || code}》共 ${fresh.likes || 0} 赞`,
          editorActions: [{ type: 'studio:community-updated', payload: { action: 'like', shareCode: code, likes: fresh.likes || 0, communityGame: fresh } }],
        };
      }

      // comment
      const body = String(text || '').trim();
      if (!body) return { ok: false, error: 'text is required for the comment action' };
      const saved = await gameService.addComment(code, { author, text: body });
      if (!saved) return { ok: false, error: 'Failed to store comment' };
      const comments = await gameService.listComments(code, { limit: 50 });
      return {
        ok: true,
        comment: saved,
        comments,
        summary: `已发布评论：${saved.text.slice(0, 40)}${saved.text.length > 40 ? '…' : ''}`,
        editorActions: [{ type: 'studio:community-updated', payload: { action: 'comment', shareCode: code, comment: saved, comments } }],
      };
    },
  };
}
