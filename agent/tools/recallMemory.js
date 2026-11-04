/**
 * recall_memory - Query the agent's long-term memory.
 *
 * Searches persisted conversation snippets, previously created games, stored
 * assets and the user preference profile. This lets the agent answer questions
 * like "what did we build last time?" or reuse an earlier theme/asset without
 * the user repeating themselves.
 *
 * Games and assets are read from the persistent game store when available so
 * recall keeps working across server restarts, and every query is tokenized
 * (CJK bigrams included) so partial topics like "赛博朋克射击游戏" still match.
 */
export function recallMemoryTool({ memory, artifactMemory, gameService } = {}) {
  return {
    name: 'recall_memory',
    description:
      'Recall long-term memory: earlier conversation snippets, previously created games, stored assets and the user preference profile. Use when the user refers to past sessions or asks what was built before.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or topic to recall (empty returns a recent overview)' },
        scope: { type: 'string', description: 'all | conversations | games | assets | preferences (default all)' },
        limit: { type: 'integer', description: 'Max results per scope (default 6)' },
      },
    },
    async execute({ query = '', scope = 'all', limit = 6 }) {
      const max = Math.max(1, Math.min(20, Number(limit) || 6));
      const all = String(scope || 'all').toLowerCase();
      const want = (key) => all === 'all' || all === key;
      const q = String(query || '').trim();
      const tokens = tokenize(q);

      const pool = await loadGamePool(gameService, artifactMemory);

      const conversations = want('conversations') && memory?.search
        ? memory.search(q, max)
        : [];
      const games = want('games') ? pickGames(pool, tokens, max) : [];
      const assets = want('assets') ? pickAssets(pool, tokens, max) : [];

      let preferences = null;
      if (want('preferences') && artifactMemory) {
        preferences = {
          summary: artifactMemory.preferenceSummary?.() || '',
          context: artifactMemory.creativityContext?.() || null,
        };
      }

      const stats = memory?.stats ? memory.stats() : null;
      const found = conversations.length + games.length + assets.length;
      const scopeLabel = q ? `与「${q}」相关` : '近期';

      return {
        ok: true,
        summary: found
          ? `已从长期记忆中检索到${scopeLabel}的 ${conversations.length} 条对话片段、${games.length} 款游戏、${assets.length} 个资产。`
          : `长期记忆中暂未找到${scopeLabel}的记录。`,
        query: q,
        scope: all,
        conversations,
        games,
        assets,
        preferences,
        stats,
        editorActions: [],
      };
    },
  };
}

/**
 * Prefer the persistent game store so recall spans restarts; fall back to the
 * in-process artifact memory when the service is not wired.
 */
async function loadGamePool(gameService, artifactMemory) {
  if (gameService?.list) {
    try {
      const games = await gameService.list({ limit: 200 });
      if (Array.isArray(games) && games.length) return games;
    } catch (_) { /* fall through to artifact memory */ }
  }
  if (artifactMemory?.searchGames) {
    return artifactMemory.searchGames({}, 100).map((g) => ({
      id: g.id,
      name: g.name,
      genre: g.genre,
      description: g.description,
      theme: g.theme ? { key: g.theme } : undefined,
      assets: [],
      updatedAt: g.createdAt ? new Date(g.createdAt).toISOString() : null,
    }));
  }
  return [];
}

function pickGames(pool, tokens, max) {
  const scored = pool
    .map((game) => ({ game, score: scoreText(gameSearchText(game), tokens) }))
    .filter((row) => (tokens.length ? row.score > 0 : true))
    .sort((a, b) => (tokens.length ? b.score - a.score : 0));
  return scored.slice(0, max).map(({ game }) => ({
    id: game.id,
    name: game.name,
    genre: game.genre,
    description: String(game.description || '').slice(0, 140),
    theme: game.theme?.key || null,
    updatedAt: game.updatedAt || null,
  }));
}

function pickAssets(pool, tokens, max) {
  const out = [];
  for (const game of pool) {
    for (const asset of game.assets || []) {
      const text = `${asset.name || ''} ${asset.type || ''} ${asset.theme || ''} ${asset.prompt || ''}`;
      const score = scoreText(text, tokens);
      if (tokens.length && score <= 0) continue;
      out.push({
        score,
        id: asset.id || asset.key,
        name: asset.name,
        type: asset.type,
        theme: asset.theme || null,
        gameId: game.id,
        gameName: game.name,
      });
    }
  }
  return out
    .sort((a, b) => (tokens.length ? b.score - a.score : 0))
    .slice(0, max)
    .map(({ score, ...rest }) => rest);
}

function gameSearchText(game) {
  return [
    game.name,
    game.description,
    game.genre,
    game.theme?.key,
    game.scenario?.key,
    ...(game.tags || []),
  ].filter(Boolean).join(' ');
}

function scoreText(text, tokens) {
  if (!tokens.length) return 0;
  const hay = String(text || '').toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += token.length > 1 ? 1 : 0.4;
  }
  return score;
}

/**
 * Latin words stay whole; CJK runs also emit character bigrams so a phrase
 * such as 赛博朋克 matches a longer title like 赛博朋克夜城.
 */
function tokenize(query) {
  const text = String(query || '').toLowerCase().trim();
  if (!text) return [];
  const tokens = new Set();
  for (const part of text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    tokens.add(part);
    if (/[\u4e00-\u9fa5]/.test(part)) {
      for (let i = 0; i < part.length - 1; i++) tokens.add(part.slice(i, i + 2));
    }
  }
  return Array.from(tokens);
}
