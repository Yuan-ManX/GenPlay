/**
 * screenshot_game - Preview snapshot capture tool.
 * Generates a structured visual snapshot descriptor from the game's
 * genre, theme, and config, producing an SVG thumbnail that the
 * frontend studio can render as a cover/preview image. The snapshot
 * is persisted into game.meta.snapshots so the gallery can show
 * poster art without running the full engine.
 *
 * The SVG is built from genre-aware motifs (palette + iconography)
 * so each game type gets a distinct, recognizable poster.
 */

const GENRE_MOTIFS = {
  shooter: { icon: '▲', accent: '#ff4757', label: 'SHOOTER' },
  adventure: { icon: '⛰', accent: '#2ed573', label: 'ADVENTURE' },
  rpg: { icon: '✦', accent: '#a55eea', label: 'RPG' },
  puzzle: { icon: '◆', accent: '#ffa502', label: 'PUZZLE' },
  battle: { icon: '⚔', accent: '#ff6348', label: 'BATTLE' },
  racing: { icon: '►', accent: '#1e90ff', label: 'RACING' },
  simulation: { icon: '◇', accent: '#26de81', label: 'SIM' },
  platformer: { icon: '▮', accent: '#fd79a8', label: 'PLATFORMER' },
  tower: { icon: '♜', accent: '#fdcb6e', label: 'TOWER' },
  snake: { icon: '〜', accent: '#00b894', label: 'SNAKE' },
  breakout: { icon: '▀', accent: '#0984e3', label: 'BREAKOUT' },
  maze: { icon: '▦', accent: '#6c5ce7', label: 'MAZE' },
  rhythm: { icon: '♪', accent: '#e84393', label: 'RHYTHM' },
  roguelike: { icon: '☠', accent: '#d63031', label: 'ROGUE' },
  deckbuilder: { icon: '♣', accent: '#00cec9', label: 'DECK' },
  metroidvania: { icon: '◈', accent: '#6c5ce7', label: 'METROID' },
  idle: { icon: '∞', accent: '#55efc4', label: 'IDLE' },
  sandbox: { icon: '▣', accent: '#fdcb6e', label: 'SANDBOX' },
  visual_novel: { icon: '❤', accent: '#ff7675', label: 'VN' },
  auto_battler: { icon: '⚡', accent: '#fdcb6e', label: 'AUTOBATTLE' },
};

function pickPalette(theme, genreKey) {
  const motif = GENRE_MOTIFS[genreKey] || GENRE_MOTIFS.adventure;
  if (theme?.palette) {
    return {
      bg: theme.palette.bg || '#1a1a2e',
      primary: theme.palette.primary || motif.accent,
      secondary: theme.palette.secondary || '#16213e',
      accent: theme.palette.accent || motif.accent,
    };
  }
  return { bg: '#1a1a2e', primary: motif.accent, secondary: '#16213e', accent: motif.accent };
}

function buildSvgSnapshot(game) {
  const genreKey = game.genre || 'adventure';
  const motif = GENRE_MOTIFS[genreKey] || GENRE_MOTIFS.adventure;
  const pal = pickPalette(game.theme, genreKey);
  const title = (game.name || 'Untitled').slice(0, 28);
  const desc = (game.description || '').slice(0, 60);
  const w = 480, h = 270;

  // Deterministic geometric pattern from game id hash.
  const seed = (game.id || 'g').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = 6;
  let shapes = '';
  for (let i = 0; i < cells; i++) {
    const x = 40 + ((seed * (i + 3)) % (w - 80));
    const y = 30 + ((seed * (i + 7) * 3) % (h - 60));
    const r = 18 + ((seed * (i + 1)) % 24);
    const fill = i % 2 === 0 ? pal.primary : pal.accent;
    const op = 0.12 + (i % 3) * 0.08;
    shapes += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${op}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${pal.bg}"/>
      <stop offset="1" stop-color="${pal.secondary}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${shapes}
  <text x="${w - 16}" y="34" text-anchor="end" font-size="14" font-family="monospace" fill="${pal.accent}" opacity="0.7">${motif.icon} ${motif.label}</text>
  <text x="24" y="${h - 56}" font-size="26" font-weight="700" font-family="sans-serif" fill="#ffffff">${escapeXml(title)}</text>
  <text x="24" y="${h - 30}" font-size="13" font-family="sans-serif" fill="#ffffff" opacity="0.7">${escapeXml(desc)}</text>
  <rect x="0" y="0" width="${w}" height="4" fill="${pal.primary}"/>
  <rect x="0" y="${h - 4}" width="${w}" height="4" fill="${pal.accent}"/>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function screenshotGameTool({ gameService }) {
  return {
    name: 'screenshot_game',
    description:
      'Capture a preview snapshot (SVG poster thumbnail) for a game based on its genre, theme, and metadata. Stored in game.meta.snapshots for gallery display.',
    parameters: {
      type: 'object',
      required: ['gameId'],
      properties: {
        gameId: { type: 'string', description: 'Target game ID' },
        label: { type: 'string', description: 'Optional label for this snapshot (e.g. "boss-fight", "title-screen")' },
      },
    },
    async execute({ gameId, label }) {
      if (!gameService) return { ok: false, error: 'Game service unavailable' };
      if (!gameId) return { ok: false, error: 'gameId required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: 'Game not found', summary: '截图失败：游戏不存在' };

      const svg = buildSvgSnapshot(game);
      const motif = GENRE_MOTIFS[game.genre] || GENRE_MOTIFS.adventure;
      const snapshot = {
        id: 'shot_' + Date.now().toString(36),
        gameId,
        label: label || `${motif.label}-${(game.meta?.snapshots?.length || 0) + 1}`,
        svg,
        capturedAt: new Date().toISOString(),
        genre: game.genre,
        themeName: game.theme?.name || null,
      };

      // Persist into meta.snapshots (cap at 12 to avoid unbounded growth).
      const meta = { ...(game.meta || {}) };
      const shots = (meta.snapshots || []).concat(snapshot).slice(-12);
      meta.snapshots = shots;
      const updated = await gameService.update(gameId, { meta });

      return {
        ok: true,
        summary: `已为《${game.name}》生成预览截图（${snapshot.label}）`,
        snapshot,
        totalSnapshots: shots.length,
        editorActions: [
          { type: 'studio:screenshot-captured', payload: { gameId, snapshot } },
          { type: 'sidebar:refresh-list', payload: { updated: gameId } },
        ],
      };
    },
  };
}
