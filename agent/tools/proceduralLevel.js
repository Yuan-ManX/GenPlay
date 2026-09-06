/**
 * proceduralLevel tool - Generate procedural levels, maps, rooms,
 * dungeons, and layout data for any game genre. Produces deterministic
 * JSON shapes that the studio preview engine can consume directly.
 *
 * Supports: roguelike dungeons, metroidvania maps, platformer level chunks,
 * tower defense paths, maze grids, rhythm charts, sandbox terrain,
 * puzzle layouts.
 */
const LEVEL_SCHEMAS = {
  roguelike: { type: 'object', properties: { seed: 'number', floors: 'number', roomsPerFloor: 'number', roomMinSize: 'number', roomMaxSize: 'number', corridorMin: 'number' } },
  metroidvania: { type: 'object', properties: { seed: 'number', zones: 'number', roomsPerZone: 'number', abilityGates: 'array' } },
  platformer: { type: 'object', properties: { seed: 'number', length: 'number', chunkCount: 'number', difficulty: 'string' } },
  tower: { type: 'object', properties: { seed: 'number', waypointCount: 'number', width: 'number', height: 'number', winding: 'number' } },
  maze: { type: 'object', properties: { seed: 'number', cols: 'number', rows: 'number', algorithm: 'string' } },
  rhythm: { type: 'object', properties: { seed: 'number', bpm: 'number', bars: 'number', difficulty: 'string', lanes: 'number' } },
  sandbox: { type: 'object', properties: { seed: 'number', size: 'array', terrain: 'string' } },
  puzzle: { type: 'object', properties: { seed: 'number', size: 'number', shuffleDepth: 'number' } },
};

export function proceduralLevelTool(services = {}) {
  const { provider, gameService } = services;
  return {
    name: 'procedural_level',
    description: 'Generate procedural levels, dungeons, maps, paths, layouts for any supported genre. Returns structured data consumable by game config.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        levelType: { type: 'string', description: 'Genre/type of level: roguelike, metroidvania, platformer, tower, maze, rhythm, sandbox, puzzle' },
        count: { type: 'integer', description: 'Number of level layouts to generate (default 1)' },
        seed: { type: 'integer', description: 'Random seed for reproducibility' },
        options: { type: 'object', description: 'Level-specific tuning options' },
      },
      required: ['levelType'],
    },
    async execute({ gameId, levelType, count = 1, seed, options = {}, sessionId }) {
      // Fallback levelType from game genre when not explicitly provided
      let resolvedType = String(levelType || '').toLowerCase();
      if (!resolvedType && gameId && gameService?.getById) {
        const g = await gameService.getById(gameId);
        if (g?.genre) {
          // Map genre names to supported LEVEL_SCHEMAS keys
          const genreToLevel = {
            roguelike: 'roguelike', metroidvania: 'metroidvania',
            platformer: 'platformer', tower: 'tower', snake: 'maze',
            maze: 'maze', rhythm: 'rhythm', sandbox: 'sandbox',
            puzzle: 'puzzle', deckbuilder: 'roguelike', idle: 'sandbox',
            visual_novel: 'puzzle', auto_battler: 'tower',
            shooter: 'platformer', adventure: 'maze', rpg: 'roguelike',
            battle: 'maze', racing: 'platformer', simulation: 'sandbox',
            breakout: 'maze',
          };
          resolvedType = genreToLevel[g.genre] || '';
        }
      }
      if (!LEVEL_SCHEMAS[resolvedType]) {
        return { ok: false, error: `未知关卡类型 ${levelType || resolvedType || 'undefined'}，支持: ${Object.keys(LEVEL_SCHEMAS).join(', ')}` };
      }

      const n = Math.max(1, Number(count) || 1);
      const levels = [];
      for (let i = 0; i < n; i++) {
        const actualSeed = (seed ?? Math.floor(Math.random() * 1_000_000)) + i * 131;
        levels.push(generateOne(resolvedType, actualSeed, options));
      }

      const actions = [{
        type: 'studio:patch-config',
        payload: { gameId, after: { levels, proceduralSeed: seed }, changes: [`关卡生成: ${resolvedType} x${n}`] },
      }];
      return {
        ok: true,
        summary: `已生成 ${n} 个 ${resolvedType} 关卡`,
        levels,
        level: levels[0],
        seed: seed ?? levels[0]?.seed,
        levelType: resolvedType,
        editorActions: actions,
      };
    },
  };
}

function generateOne(type, seed, options) {
  switch (type) {
    case 'roguelike': return { ...generateRoguelike(seed, options), seed };
    case 'metroidvania': return { ...generateMetroidvania(seed, options), seed };
    case 'platformer': return { ...generatePlatformer(seed, options), seed };
    case 'tower': return { ...generateTowerPath(seed, options), seed };
    case 'maze': return { ...generateMaze(seed, options), seed };
    case 'rhythm': return { ...generateRhythmChart(seed, options), seed };
    case 'sandbox': return { ...generateSandboxTerrain(seed, options), seed };
    case 'puzzle': return { ...generatePuzzle(seed, options), seed };
    default: return { seed, type };
  }
}

// ---- Deterministic PRNG (mulberry32) ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateRoguelike(seed, opts) {
  const rand = mulberry32(seed);
  const floors = opts.floors || 5;
  const roomsPer = opts.roomsPerFloor || 6;
  const rMin = opts.roomMinSize || 5;
  const rMax = opts.roomMaxSize || 10;
  const out = { floors: [] };
  for (let f = 0; f < floors; f++) {
    const rooms = [];
    for (let i = 0; i < roomsPer; i++) {
      rooms.push({
        id: `f${f}_r${i}`,
        w: Math.floor(rMin + rand() * (rMax - rMin)),
        h: Math.floor(rMin + rand() * (rMax - rMin)),
        type: i === 0 ? 'start' : (i === roomsPer - 1 ? (f === floors - 1 ? 'boss' : 'stairs') : (rand() < 0.2 ? 'treasure' : 'normal')),
        enemies: rand() < 0.7 ? Math.ceil(rand() * 3) : 0,
        loot: rand() < 0.4 ? 1 : 0,
      });
    }
    // Connect rooms linearly as corridors; extra random connections for loops
    const connections = [];
    for (let i = 0; i < roomsPer - 1; i++) connections.push([rooms[i].id, rooms[i + 1].id]);
    if (roomsPer > 3) connections.push([rooms[0].id, rooms[Math.floor(roomsPer / 2)].id]);
    out.floors.push({ floor: f + 1, rooms, connections });
  }
  return out;
}

function generateMetroidvania(seed, opts) {
  const rand = mulberry32(seed);
  const zones = opts.zones || 6;
  const roomsPerZone = opts.roomsPerZone || 4;
  const gates = opts.abilityGates || ['double_jump', 'dash', 'morph_ball', 'grapple'];
  const map = { zones: [] };
  for (let z = 0; z < zones; z++) {
    const rooms = [];
    for (let r = 0; r < roomsPerZone; r++) {
      rooms.push({
        id: `z${z}_r${r}`,
        kind: r === 0 ? 'entry' : (r === roomsPerZone - 1 ? 'boss' : (rand() < 0.25 ? 'save' : 'explore')),
        abilityGate: r === roomsPerZone - 1 && z < zones - 1 ? gates[z] : null,
        enemies: rand() < 0.6 ? Math.ceil(rand() * 2) : 0,
      });
    }
    map.zones.push({ zone: z + 1, rooms, connections: rooms.slice(0, -1).map((_, i) => [rooms[i].id, rooms[i + 1].id]) });
  }
  return map;
}

function generatePlatformer(seed, opts) {
  const rand = mulberry32(seed);
  const chunks = opts.chunkCount || 12;
  const difficulty = opts.difficulty || 'normal';
  const difficultyMul = difficulty === 'easy' ? 0.7 : difficulty === 'hard' ? 1.4 : difficulty === 'hell' ? 1.9 : 1;
  const chunkTemplates = ['gap', 'stairs_up', 'stairs_down', 'coin_row', 'enemy_patrol', 'high_platform', 'double_jump_gap', 'moving_platform'];
  const chunksOut = [];
  for (let i = 0; i < chunks; i++) {
    const tpl = chunkTemplates[Math.floor(rand() * chunkTemplates.length)];
    chunksOut.push({
      id: `c${i}`,
      template: tpl,
      gap: 40 + Math.floor(rand() * 80 * difficultyMul),
      height: 20 + Math.floor(rand() * 80),
      difficulty: Math.ceil(1 + rand() * 5 * difficultyMul),
      hasEnemy: rand() < 0.5 * difficultyMul,
      hasCoin: rand() < 0.7,
    });
  }
  return { length: chunks, chunks: chunksOut, difficulty };
}

function generateTowerPath(seed, opts) {
  const rand = mulberry32(seed);
  const w = opts.width || 640;
  const h = opts.height || 360;
  const points = opts.waypointCount || 6;
  const winding = opts.winding ?? 0.5;
  const pts = [];
  pts.push([0, Math.floor(h / 2)]);
  for (let i = 1; i < points - 1; i++) {
    const x = Math.floor((i / (points - 1)) * w);
    const base = h / 2;
    const variation = (rand() - 0.5) * 2 * winding * (h * 0.35);
    pts.push([x, Math.max(30, Math.min(h - 30, Math.floor(base + variation)))]);
  }
  pts.push([w, Math.floor(h / 2)]);
  return { path: pts, width: w, height: h, totalLength: pts.reduce((s, _, i) => i === 0 ? 0 : s + Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]), 0) };
}

function generateMaze(seed, opts) {
  const cols = opts.cols || 15;
  const rows = opts.rows || 10;
  const rand = mulberry32(seed);
  // Recursive backtracker via iterative stack
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ walls: [true, true, true, true], visited: false })));
  const dirs = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]]; // dx,dy,wallIdx,opposite
  const stack = [[0, 0]];
  grid[0][0].visited = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = dirs.filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && nx < cols && ny >= 0 && ny < rows && !grid[ny][nx].visited;
    });
    if (!options.length) { stack.pop(); continue; }
    const [dx, dy, wall, opp] = options[Math.floor(rand() * options.length)];
    grid[y][x].walls[wall] = false;
    grid[y + dy][x + dx].walls[opp] = false;
    grid[y + dy][x + dx].visited = true;
    stack.push([x + dx, y + dy]);
  }
  const cells = grid.map((row) => row.map((c) => ({ walls: c.walls })));
  return { cols, rows, cells, start: [0, 0], goal: [cols - 1, rows - 1] };
}

function generateRhythmChart(seed, opts) {
  const rand = mulberry32(seed);
  const bpm = opts.bpm || 120;
  const bars = opts.bars || 16;
  const lanes = opts.lanes || 4;
  const difficulty = opts.difficulty || 'normal';
  const density = difficulty === 'easy' ? 0.4 : difficulty === 'hard' ? 0.85 : difficulty === 'hell' ? 1.1 : 0.6;
  const beats = bars * 4;
  const notes = [];
  for (let b = 0; b < beats; b++) {
    if (rand() < density) {
      const lane = Math.floor(rand() * lanes);
      notes.push({ beat: b, lane, type: rand() < 0.08 ? 'hold' : 'tap', hold: rand() < 0.08 ? 1 + Math.floor(rand() * 2) : 0 });
    }
  }
  return { bpm, bars, lanes, difficulty, totalNotes: notes.length, notes };
}

function generateSandboxTerrain(seed, opts) {
  const rand = mulberry32(seed);
  const [w, h] = opts.size || [32, 32];
  const terrain = opts.terrain || 'procedural_island';
  const tiles = Array.from({ length: h }, () => Array(w).fill('grass'));
  // Simple noise via layered rand smoothing
  const raw = Array.from({ length: h }, () => Array.from({ length: w }, () => rand()));
  const smooth = raw.map((row, y) => row.map((v, x) => {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w) { s += raw[ny][nx]; c++; }
    }
    return s / c;
  }));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = smooth[y][x];
    // Edge falloff to water for islands
    const cx = w / 2, cy = h / 2;
    const dist = Math.hypot(x - cx, y - cy) / (Math.min(w, h) / 2);
    const val = terrain.includes('island') ? v - dist * 0.6 : v;
    tiles[y][x] = val < 0.25 ? 'water' : val < 0.4 ? 'sand' : val < 0.7 ? 'grass' : val < 0.85 ? 'stone' : 'wood';
  }
  return { width: w, height: h, terrain, tiles, spawn: [Math.floor(w / 2), Math.floor(h / 2)] };
}

function generatePuzzle(seed, opts) {
  const size = opts.size || 3;
  const shuffleDepth = opts.shuffleDepth || 40;
  const rand = mulberry32(seed);
  const n = size * size;
  const tiles = Array.from({ length: n }, (_, i) => i); // 0 = empty
  const target = tiles.slice();
  // Shuffle via valid swaps only (so puzzle is solvable)
  let emptyIdx = n - 1;
  const dirs = [-1, 1, -size, size];
  for (let s = 0; s < shuffleDepth; s++) {
    const validDirs = dirs.filter((d) => {
      const ni = emptyIdx + d;
      if (ni < 0 || ni >= n) return false;
      if (d === -1 && emptyIdx % size === 0) return false;
      if (d === 1 && emptyIdx % size === size - 1) return false;
      return true;
    });
    const d = validDirs[Math.floor(rand() * validDirs.length)];
    [tiles[emptyIdx], tiles[emptyIdx + d]] = [tiles[emptyIdx + d], tiles[emptyIdx]];
    emptyIdx += d;
  }
  return { size, tiles, target, empty: tiles.indexOf(0) };
}
