/**
 * GenPlay game template engine.
 * Outputs genre-specific default configuration (config) and bootstrap scripts
 * so create_game can immediately produce a playable preview without extra wiring.
 *
 * Design principles:
 * - Each genre ships its own config schema declaring gameplay parameters.
 * - Scripts use a small declarative DSL that the frontend GamePreview engine understands.
 * - Templates declare the initial loop; the Agent iterates afterwards via edit_game/tool chains.
 */

const TEMPLATES = {
  // Shooter: spaceship dodges meteors and fires at incoming waves
  shooter: {
    label: '射击生存',
    config: {
      player: { hp: 3, speed: 4.6, fireRate: 12, bulletSpeed: -7 },
      enemy: { spawnEvery: 36, speed: 1.6, hp: 1 },
      scoring: { kill: 10, survive: 0 },
      winCondition: { type: 'endless' },
    },
    scripts: `// GenPlay Shooter Template
genplay::spawn player { x: center, y: bottom }
on frame % fireRate == 0 and input.shoot: genplay::fire bullet
on enemy.y > H: genplay::despawn enemy
on hit(player, enemy): genplay::gameover
on hit(bullet, enemy): genplay::score kill, genplay::despawn enemy
`,
  },

  // Adventure: collect coins while dodging hazards
  adventure: {
    label: '收集探险',
    config: {
      player: { hp: 1, speed: 4.6 },
      coin: { spawnEvery: 60, speed: 1.2, value: 5 },
      enemy: { spawnEvery: 36, speed: 1.6 },
      scoring: { coin: 5 },
      winCondition: { type: 'endless' },
    },
    scripts: `// GenPlay Adventure Template
genplay::spawn player { x: center, y: bottom }
on frame % coin.spawnEvery == 0: genplay::spawn coin
on hit(player, coin): genplay::score coin, genplay::despawn coin
on hit(player, enemy): genplay::gameover
`,
  },

  // RPG: turn-based combat with skills and AI opponent turn
  rpg: {
    label: '回合制 RPG',
    config: {
      player: { name: '勇者', hp: 100, mp: 30, atk: 18, def: 6, skills: ['斩击', '火球术', '治愈'] },
      enemy: { name: '魔物', hp: 80, atk: 12, def: 3, ai: 'random' },
      turn: { mode: 'player-first', actionsPerTurn: 1 },
      winCondition: { type: 'enemy-defeated' },
    },
    scripts: `// GenPlay RPG Template
genplay::init battle { player, enemy }
on player.action.attack: genplay::damage enemy = atk - enemy.def
on player.action.skill('火球术'): genplay::cost mp=8, genplay::damage enemy = 24
on player.action.skill('治愈'): genplay::cost mp=10, genplay::heal player = 25
on player.action.defend: genplay::buff player.def *= 2 (this turn)
on enemy.hp <= 0: genplay::victory
on enemy.turn: genplay::ai enemy -> action
on player.hp <= 0: genplay::gameover
`,
  },

  // Puzzle: 3x3 sliding tile
  puzzle: {
    label: '滑块解谜',
    config: {
      grid: { size: 3, shuffled: true, moveLimit: 0 },
      tiles: { count: 8, empty: 1 },
      winCondition: { type: 'ordered', target: [1, 2, 3, 4, 5, 6, 7, 8, 0] },
    },
    scripts: `// GenPlay Puzzle Template
genplay::init grid { size: 3, shuffle: true }
on click(tile) and tile.adjacent(empty): genplay::swap tile <-> empty
on grid == target: genplay::victory
on move++: genplay::update stats.moves
`,
  },

  // Battle: two-fighter duel (P1 vs aggressive AI)
  battle: {
    label: '对战格斗',
    config: {
      player: { name: 'P1', hp: 100, speed: 4, attacks: { light: 8, heavy: 18 }, block: { dmgReduce: 0.6 } },
      enemy: { name: 'AI', hp: 100, speed: 3.5, ai: 'aggressive', attacks: { light: 7, heavy: 15 } },
      stage: { width: 640, height: 200, ground: 320 },
      winCondition: { type: 'opponent-defeated' },
    },
    scripts: `// GenPlay Battle Template
genplay::init fighters { p1, ai } on stage
on p1.action.light and inRange(p1, ai): genplay::damage ai = 8
on p1.action.heavy and inRange(p1, ai): genplay::damage ai = 18 (windup 18f)
on p1.action.block: genplay::buff p1.dmgReduce = 0.6 (while held)
on ai.frame % 60 == 0: genplay::ai ai -> approach | attack | block
on ai.hp <= 0: genplay::victory
on p1.hp <= 0: genplay::gameover
`,
  },

  // Racing: lane-dodge endurance
  racing: {
    label: '极速躲避',
    config: {
      player: { hp: 1, speed: 5.2, lanes: 3 },
      obstacle: { spawnEvery: 24, speed: 3.2 },
      scoring: { survive: 1 },
      winCondition: { type: 'endless' },
    },
    scripts: `// GenPlay Racing Template
genplay::spawn player { x: center, y: bottom }
on frame % obstacle.spawnEvery == 0: genplay::spawn obstacle
on hit(player, obstacle): genplay::gameover
on frame % 60 == 0: genplay::score survive
`,
  },

  // Simulation: resource collection loop
  simulation: {
    label: '模拟采集',
    config: {
      player: { hp: 1, speed: 4, capacity: 10 },
      resource: { spawnEvery: 50, types: ['wood', 'stone', 'food'], value: 3 },
      scoring: { collect: 3 },
      winCondition: { type: 'endless' },
    },
    scripts: `// GenPlay Simulation Template
genplay::spawn player { x: center, y: center }
on frame % resource.spawnEvery == 0: genplay::spawn resource
on hit(player, resource): genplay::collect, genplay::score collect
on inventory.full: genplay::deposit
`,
  },

  // Platformer: gravity, double-jump, stomp enemies
  platformer: {
    label: '平台跳跃',
    config: {
      player: { hp: 1, speed: 3.2, jumpForce: 11, gravity: 0.5, maxJumps: 2 },
      enemy: { spawnEvery: 90, speed: 1.4, patrolRange: 80 },
      platform: { count: 5, gapMin: 80, gapMax: 160, heightVar: 60 },
      scoring: { stomp: 15, coin: 5 },
      winCondition: { type: 'endless' },
    },
    scripts: `// GenPlay Platformer Template
genplay::spawn player { x: 80, y: ground }
genplay::apply gravity to player
on input.jump and jumps < maxJumps: genplay::jump player
on input.left/right: genplay::move player
on hit(player, enemy) and player.vy > 0: genplay::stomp enemy, genplay::score stomp
on hit(player, enemy) and player.vy <= 0: genplay::gameover
on frame % 90 == 0: genplay::spawn coin
on hit(player, coin): genplay::score coin
`,
  },

  // Tower: path-based waves + tower build spots
  tower: {
    label: '塔防',
    config: {
      path: { points: [[0, 200], [200, 200], [200, 100], [450, 100], [450, 300], [640, 300]] },
      player: { gold: 100, lives: 10 },
      tower: { cost: 25, range: 80, damage: 8, fireRate: 30 },
      enemy: { spawnEvery: 90, hp: 30, speed: 1.0, reward: 10 },
      wave: { count: 5, enemiesPerWave: 8 },
      scoring: { kill: 10 },
      winCondition: { type: 'waves-cleared' },
    },
    scripts: `// GenPlay Tower Defense Template
genplay::init path { points }
genplay::spawn tower-build-spots
on click(build-spot) and gold >= tower.cost: genplay::build tower, genplay::cost gold
on frame % enemy.spawnEvery == 0 and wave.active: genplay::spawn enemy on path
on tower.frame % tower.fireRate == 0: genplay::target nearest enemy in range, genplay::fire
on enemy.hp <= 0: genplay::despawn, genplay::reward gold, genplay::score kill
on enemy.reachedEnd: genplay::lose life
on lives <= 0: genplay::gameover
on wave.cleared: genplay::next wave
`,
  },

  // Snake: grid-based eating growth
  snake: {
    label: '贪吃蛇',
    config: {
      grid: { cellSize: 20, cols: 24, rows: 16 },
      snake: { speed: 8, initialLength: 3 },
      food: { value: 10, growth: 1 },
      scoring: { food: 10 },
      winCondition: { type: 'endless' },
    },
    scripts: `// GenPlay Snake Template
genplay::init grid { cols, rows }
genplay::spawn snake { x: center, y: center, len: 3, dir: right }
genplay::spawn food at random empty cell
on tick (every 1/speed): genplay::move snake forward
on input.left/right/up/down: genplay::turn snake (no reverse)
on snake.head == food: genplay::eat, genplay::grow, genplay::score food, genplay::spawn food
on snake.head == body or wall: genplay::gameover
`,
  },

  // Breakout: paddle + ball + brick grid
  breakout: {
    label: '打砖块',
    config: {
      paddle: { w: 90, h: 12, speed: 6 },
      ball: { r: 6, speed: 4, vx: 3, vy: -3 },
      brick: { rows: 5, cols: 10, w: 56, h: 20, gap: 4, hp: 1 },
      scoring: { brick: 10 },
      winCondition: { type: 'all-bricks-cleared' },
    },
    scripts: `// GenPlay Breakout Template
genplay::spawn paddle { x: center, y: bottom }
genplay::spawn ball { x: center, y: paddle - r, vx, vy }
genplay::spawn brick grid { rows, cols }
on input.left/right: genplay::move paddle
on ball.y > H: genplay::gameover
on ball hits paddle: genplay::reflect ball.vy = -|vy|
on ball hits brick: genplay::damage brick, genplay::reflect, genplay::score brick
on all bricks destroyed: genplay::victory
`,
  },

  // Maze: procedurally generated top-down pathfinding
  maze: {
    label: '迷宫探索',
    config: {
      grid: { cols: 15, rows: 10, cellSize: 32 },
      player: { speed: 2.4 },
      goal: { reward: 100 },
      scoring: { reach: 100, perMove: -1 },
      winCondition: { type: 'reach-goal' },
    },
    scripts: `// GenPlay Maze Template
genplay::generate maze { cols, rows } using recursive-backtracker
genplay::spawn player { x: 0, y: 0 }
genplay::spawn goal { x: cols-1, y: rows-1 }
on input.left/right/up/down: genplay::move player (if no wall)
on player == goal: genplay::victory, genplay::score reach
on move++: genplay::score perMove
`,
  },

  // Rhythm: falling note lanes + line-of-judgement scoring
  rhythm: {
    label: '节奏判定',
    config: {
      track: { lanes: 4, noteSpeed: 3.2, hitLine: 360 },
      song: { bpm: 120, notes: 32 },
      scoring: { perfect: 100, good: 50, miss: -20 },
      judgement: { perfect: 12, good: 24, miss: 36 },
      winCondition: { type: 'song-end', minScore: 500 },
    },
    scripts: `// GenPlay Rhythm Template
genplay::init lanes { count: 4 }
genplay::spawn notes from song.chart at hitLine - offset
on frame: genplay::move notes down at noteSpeed
on input[lane] and note in judgement.perfect: genplay::hit perfect, genplay::score perfect
on input[lane] and note in judgement.good: genplay::hit good, genplay::score good
on note.y > hitLine + judgement.miss: genplay::miss, genplay::score miss
on song.end: genplay::result based on score vs minScore
`,
  },

  // Roguelike: permadeath procedural rooms + random loot on floor clear
  roguelike: {
    label: '地城 Rogue',
    config: {
      player: { hp: 30, atk: 6, speed: 3, gold: 0, level: 1, xp: 0, xpNext: 20 },
      dungeon: { floors: 5, roomsPerFloor: 6, roomSize: [7, 10], corridorMin: 3 },
      enemy: { spawnPerRoom: [1, 3], hp: 10, atk: 3, xp: 6 },
      loot: { spawnPerRoom: [0, 2], table: ['sword+1', 'shield+1', 'potion_hp', 'gold_pile', 'scroll_fire'] },
      winCondition: { type: 'boss-floor', bossFloor: 5 },
    },
    scripts: `// GenPlay Roguelike Template
genplay::generate floor (dungeon.floors, roomsPerFloor, roomSize, corridorMin)
genplay::place stairs at far.room
on enter(room): genplay::spawn enemies and loot
on hit(player, enemy): genplay::damage both
on enemy.hp <= 0: genplay::drop xp, chance to drop loot.item
on player.xp >= xpNext: genplay::level up, +hp/+atk
on hit(player, stairs): genplay::next floor
on floor == bossFloor: genplay::spawn boss instead of enemies
on boss.hp <= 0: genplay::victory
on player.hp <= 0: genplay::gameover (permadeath)
`,
  },

  // Deckbuilder: draft deck -> play cards from hand -> combat turn cycle
  deckbuilder: {
    label: '卡组构筑',
    config: {
      player: { hp: 60, energy: 3, energyMax: 3, block: 0 },
      deck: { starting: 12, handSize: 5, drawPerTurn: 5 },
      cards: [
        { id: 'strike', cost: 1, type: 'attack', value: 6 },
        { id: 'defend', cost: 1, type: 'block', value: 5 },
        { id: 'bash',   cost: 2, type: 'attack', value: 8, status: 'vulnerable' },
      ],
      enemy: { hp: 40, atk: 6, intent: 'attack' },
      winCondition: { type: 'enemy-defeated' },
    },
    scripts: `// GenPlay Deckbuilder Template
genplay::shuffle deck, genplay::draw handSize
on turn.start: genplay::reset energy, genplay::clear block, genplay::draw drawPerTurn
on play(card) and energy >= card.cost: genplay::apply effect, genplay::discard card, genplay::cost energy
on endTurn: genplay::enemy.act (intent value), genplay::new intent
on enemy.hp <= 0: genplay::reward card + gold, genplay::victory
on player.hp <= 0: genplay::gameover
`,
  },

  // Metroidvania: connected map with ability-gated rooms + persistent stat upgrades
  metroidvania: {
    label: '银河恶魔城',
    config: {
      player: { hp: 50, speed: 3, jumpForce: 10, gravity: 0.45, abilities: ['jump'] },
      map: { zones: 6, roomsPerZone: 4, abilityGates: ['double_jump', 'dash', 'morph_ball', 'grapple'] },
      enemy: { hp: 18, atk: 6, speed: 1.6 },
      upgrades: { perZoneBoss: ['double_jump', 'dash', 'morph_ball', 'grapple'] },
      winCondition: { type: 'final-boss' },
    },
    scripts: `// GenPlay Metroidvania Template
genplay::procedural map (zones x roomsPerZone) with ability gates
genplay::spawn player at zone_0.start
genplay::apply gravity to player
on input.jump: genplay::jump if ability.jump
on input.jump x2 (held): genplay::double jump if ability.double_jump
on input.dash: genplay::dash if ability.dash
on enter(gate): genplay::block if missing ability
on hit(player, enemy): genplay::damage both
on enemy.hp <= 0: genplay::chance drop ability upgrade or hp shard
on zone.end and boss cleared: genplay::unlock next zone, grant upgrade
on final_boss.hp <= 0: genplay::victory
on player.hp <= 0: genplay::gameover (respawn last save)
`,
  },

  // Idle/incremental: offline progression, prestige loops, research trees
  idle: {
    label: '放置增量',
    config: {
      currency: { coin: 0, gem: 0 },
      generators: [
        { key: 'clicker', base: 1, level: 1, costScale: 1.15 },
        { key: 'miner', basePerSec: 2, level: 0, cost: 10, costScale: 1.18 },
        { key: 'factory', basePerSec: 40, level: 0, cost: 300, costScale: 1.22 },
        { key: 'fusion', basePerSec: 900, level: 0, cost: 8000, costScale: 1.25 },
      ],
      prestige: { threshold: 1_000_000, reward: 'gem +1 per 1M reset coin' },
      research: { unlocks: ['double_click', 'auto_clicker', 'offline_rate+50%'] },
      winCondition: { type: 'prestige-count', target: 5 },
    },
    scripts: `// GenPlay Idle/Incremental Template
on click(big_button): genplay::gain coin = (clicker.level * clicker.base) * multipliers
on each tick: genplay::gain coin = sum(generators * basePerSec * levels)
on buy(generator) and coin >= cost: genplay::buy generator, level++, update cost
on research.purchase(points): genplay::unlock research perk, apply multiplier
on coin >= prestige.threshold: genplay::offer prestige (reset coin, grant gems, global multipliers)
on prestige.count >= prestige.target: genplay::victory
`,
  },

  // Sandbox: voxels/grid build + spawnable NPCs + vehicles, creative first then survival
  sandbox: {
    label: '开放沙盒',
    config: {
      world: { size: [64, 64], terrain: 'procedural_island', tileSet: ['grass', 'sand', 'water', 'stone', 'wood'] },
      player: { hp: 20, speed: 3.6, creative: true },
      inventory: { slots: 36, stack: 99 },
      npcs: { villagers: 4, spawn: ['town_center'], trades: true },
      winCondition: { type: 'open' },
    },
    scripts: `// GenPlay Sandbox Template
genplay::generate island world { size, terrain, tileSet }
genplay::spawn player { x: center, y: land }
genplay::populate 4 villagers + 1 town_center
on mode.creative: genplay::place/break block instantly (infinite inventory)
on mode.survival: genplay::mine block -> inventory slot
on craft(inventory, recipe): genplay::consume inputs, genplay::unlock output
on place(bed): genplay::set spawn point
on hit(player, zombie at night): genplay::damage player
on player.hp <= 0: genplay::respawn at bed
`,
  },

  // Visual novel: branching dialogue, choices unlock CGs, affection + routes
  visual_novel: {
    label: '视觉小说',
    config: {
      characters: [
        { id: 'lyra', name: 'Lyra', sprite: 'uniform_happy', traits: ['cheerful', 'mysterious'] },
        { id: 'kael', name: 'Kael', sprite: 'jacket_neutral', traits: ['calm', 'sharp'] },
      ],
      chapters: 3,
      choicesPerChapter: 4,
      affection: { lyra: 0, kael: 0 },
      flags: {},
      endings: ['lyra_good', 'kael_good', 'true_route', 'neutral'],
      winCondition: { type: 'ending-unlocked' },
    },
    scripts: `// GenPlay Visual Novel Template
genplay::scene chapter_1.intro with (bg = city_sunset, bgm = breeze)
on dialogue(char, line): genplay::typewriter + portrait(char.sprite)
on choice(option): genplay::set flag(option.flag), genplay::add affection(option.target, option.value)
on end of chapter: genplay::route branch based on flags + affection
on route.final and final_choice: genplay::unlock ending(closest match)
on ending unlocked: genplay::credit roll, genplay::victory
`,
  },

  // Auto battler: bench -> lineup -> round-by-round AI solve + tier shop refresh
  auto_battler: {
    label: '自走棋',
    config: {
      player: { hp: 100, gold: 10, level: 1, xpToNext: 5 },
      lineup: { size: 5, bench: 8 },
      shop: { tiers: [1, 2, 3, 4, 5], refreshCost: 1, poolPerTier: [20, 18, 14, 10, 6] },
      units: [
        { id: 'shield_guard', cost: 1, hp: 50, atk: 6, trait: 'tank', synergy: 'human' },
        { id: 'flame_mage', cost: 2, hp: 22, atk: 14, trait: 'mage', synergy: 'human' },
        { id: 'shadow_assassin', cost: 3, hp: 28, atk: 22, trait: 'assassin', synergy: 'shadow' },
        { id: 'forest_wolf', cost: 2, hp: 38, atk: 12, trait: 'beast', synergy: 'forest' },
      ],
      match: { rounds: 8, opponents: 7, finalBoss: true },
      winCondition: { type: 'reach-round', target: 8 },
    },
    scripts: `// GenPlay Auto Battler Template
on prep phase: genplay::roll shop (tier unlocked by player.level) for gold
on buy(unit): genplay::add to bench, genplay::cost gold
on place(bench -> lineup): genplay::auto position board
on round.start: genplay::battle (lineup vs opponent) using auto-attack priorities
on lose round: genplay::damage player.hp = opponent.unitsLeft * 2
on win round: genplay::reward gold + xpToNext
on round >= match.target and player.hp > 0: genplay::victory
on player.hp <= 0: genplay::gameover
`,
  },
};

const DEFAULT_GENRE = 'adventure';

export function getTemplate(genre) {
  const key = String(genre || DEFAULT_GENRE).toLowerCase();
  return TEMPLATES[key] || TEMPLATES[DEFAULT_GENRE];
}

export function listGenres() {
  return Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label }));
}

export default { getTemplate, listGenres };
