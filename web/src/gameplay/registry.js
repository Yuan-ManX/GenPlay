import shooter from './shooter.js';
import adventure from './adventure.js';
import rpg from './rpg.js';
import puzzle from './puzzle.js';
import battle from './battle.js';
import racing from './racing.js';
import simulation from './simulation.js';
import platformer from './platformer.js';
import tower from './tower.js';
import snake from './snake.js';
import breakout from './breakout.js';
import maze from './maze.js';
import rhythm from './rhythm.js';
import roguelike from './roguelike.js';
import deckbuilder from './deckbuilder.js';
import metroidvania from './metroidvania.js';
import idle from './idle.js';
import sandbox from './sandbox.js';
import visual_novel from './visual_novel.js';
import auto_battler from './auto_battler.js';

/**
 * Gameplay engine registry - routes a genre key to its engine module.
 * Each engine implements the unified interface:
 * { keys, hint, init, update, render, onPointer? }
 */
const REGISTRY = {
  shooter,
  adventure,
  rpg,
  puzzle,
  battle,
  racing,
  simulation,
  platformer,
  tower,
  snake,
  breakout,
  maze,
  rhythm,
  roguelike,
  deckbuilder,
  metroidvania,
  idle,
  sandbox,
  visual_novel,
  auto_battler,
};

// Chinese aliases -> standard genre key (kept in sync with agent planner)
const GENRE_ALIASES = {
  射击: 'shooter', 射击游戏: 'shooter',
  冒险: 'adventure', 冒险游戏: 'adventure',
  角色扮演: 'rpg', 回合制: 'rpg',
  解谜: 'puzzle', 拼图: 'puzzle',
  对战: 'battle', 格斗: 'battle', 战斗: 'battle',
  赛车: 'racing',
  模拟: 'simulation', 模拟经营: 'simulation',
  平台: 'platformer', 平台跳跃: 'platformer', 跳跃: 'platformer', 横版: 'platformer',
  塔防: 'tower', 防御塔: 'tower', towerdefense: 'tower', td: 'tower',
  贪吃蛇: 'snake', 蛇: 'snake',
  打砖块: 'breakout', 砖块: 'breakout', 弹球: 'breakout',
  迷宫: 'maze', 迷宫探索: 'maze', 寻路: 'maze',
  节奏: 'rhythm', 节拍: 'rhythm', 音乐节奏: 'rhythm',
  肉鸽: 'roguelike', 地牢: 'roguelike', 随机地牢: 'roguelike',
  卡牌构筑: 'deckbuilder', 卡组构筑: 'deckbuilder', 卡牌: 'deckbuilder',
  银河恶魔城: 'metroidvania', 恶魔城: 'metroidvania', 类银河: 'metroidvania',
  放置: 'idle', 放置挂机: 'idle', 挂机: 'idle', 增量: 'idle',
  沙盒: 'sandbox', 沙盒模拟: 'sandbox', 自由建造: 'sandbox',
  视觉小说: 'visual_novel', 文字冒险: 'visual_novel', 互动小说: 'visual_novel',
  自走棋: 'auto_battler', 自动对战: 'auto_battler',
};

const DEFAULT = adventure;

export const GENRE_LABELS = {
  shooter: '射击生存',
  adventure: '收集探险',
  rpg: '回合制 RPG',
  puzzle: '滑块解谜',
  battle: '对战格斗',
  racing: '极速躲避',
  simulation: '模拟采集',
  platformer: '平台跳跃',
  tower: '塔防',
  snake: '贪吃蛇',
  breakout: '打砖块',
  maze: '迷宫探索',
  rhythm: '节奏判定',
  roguelike: '地牢探索',
  deckbuilder: '卡牌构筑',
  metroidvania: '银河恶魔城',
  idle: '放置挂机',
  sandbox: '沙盒创造',
  visual_novel: '视觉小说',
  auto_battler: '自走棋',
};

export function getEngine(genre) {
  const raw = String(genre || 'adventure').toLowerCase();
  const key = GENRE_ALIASES[raw] || raw;
  return REGISTRY[key] || DEFAULT;
}

export function getLabel(genre) {
  const raw = String(genre || '').toLowerCase();
  const key = GENRE_ALIASES[raw] || raw;
  return GENRE_LABELS[key] || genre;
}

export function listGenres() {
  return Object.entries(GENRE_LABELS).map(([key, label]) => ({ key, label }));
}
