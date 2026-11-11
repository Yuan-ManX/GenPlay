/**
 * PlayableBuilder - assembles a self-contained, offline playable HTML5 game.
 *
 * The studio preview and the exported build share the same gameplay modules
 * (web/src/gameplay/*.js). This builder reads the target genre module plus the
 * shared engine helpers from disk, converts the ES module syntax into plain
 * script scope, and wraps them with a minimal canvas runtime (fixed-step loop,
 * keyboard + pointer input, touch pad, score HUD and restart flow).
 *
 * The resulting file has zero network dependencies: it can be opened directly
 * from the filesystem or served by the backend.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAMEPLAY_DIR = path.resolve(HERE, '../../web/src/gameplay');

// genre key -> gameplay module file
export const GENRE_MODULES = {
  shooter: 'shooter.js',
  adventure: 'adventure.js',
  rpg: 'rpg.js',
  puzzle: 'puzzle.js',
  battle: 'battle.js',
  racing: 'racing.js',
  simulation: 'simulation.js',
  platformer: 'platformer.js',
  tower: 'tower.js',
  snake: 'snake.js',
  breakout: 'breakout.js',
  maze: 'maze.js',
  rhythm: 'rhythm.js',
  roguelike: 'roguelike.js',
  deckbuilder: 'deckbuilder.js',
  metroidvania: 'metroidvania.js',
  idle: 'idle.js',
  sandbox: 'sandbox.js',
  visual_novel: 'visual_novel.js',
  auto_battler: 'auto_battler.js',
};

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

const GENRE_ALIASES = {
  射击: 'shooter', 冒险: 'adventure', 角色扮演: 'rpg', 回合制: 'rpg',
  解谜: 'puzzle', 拼图: 'puzzle', 对战: 'battle', 格斗: 'battle', 战斗: 'battle',
  赛车: 'racing', 模拟: 'simulation', 模拟经营: 'simulation',
  平台: 'platformer', 平台跳跃: 'platformer', 横版: 'platformer',
  塔防: 'tower', 贪吃蛇: 'snake', 打砖块: 'breakout', 迷宫: 'maze',
  节奏: 'rhythm', 肉鸽: 'roguelike', 地牢: 'roguelike',
  卡牌: 'deckbuilder', 卡牌构筑: 'deckbuilder', 银河恶魔城: 'metroidvania',
  放置: 'idle', 挂机: 'idle', 沙盒: 'sandbox',
  视觉小说: 'visual_novel', 文字冒险: 'visual_novel', 自走棋: 'auto_battler',
};

export function resolveGenre(genre) {
  const raw = String(genre || 'adventure').toLowerCase();
  const key = GENRE_ALIASES[raw] || raw;
  return GENRE_MODULES[key] ? key : 'adventure';
}

/**
 * Convert an ES module into script-scope source.
 * Only the patterns used by the gameplay modules are handled:
 *   - `import { ... } from './engine.js';`  -> removed (helpers are concatenated)
 *   - `export default {`                   -> `const <name> = {`
 *   - `export const|function|class`        -> plain declaration
 */
function toScriptScope(src, defaultName) {
  return src
    .replace(/^import[\s\S]*?from\s*['"]\.\/engine\.js['"];?[ \t]*$/gm, '')
    .replace(/^import[\s\S]*?from\s*['"]\.[^'"]+['"];?[ \t]*$/gm, '')
    .replace(/^export\s+default\s+/m, `const ${defaultName} = `)
    .replace(/^export\s+(const|let|function|class)\s+/gm, '$1 ');
}

const SAFE_JSON = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

function readPalette(theme) {
  const palette = Array.isArray(theme?.palette) ? theme.palette.filter(Boolean) : [];
  if (palette.length >= 3) return palette;
  return ['#6d28d9', '#a78bfa', '#facc15', '#0b1020'];
}

/**
 * Build the single-file HTML game.
 * @param {object} game full game record
 * @returns {Promise<{ok:boolean, html?:string, bytes?:number, genre?:string, error?:string}>}
 */
export async function buildPlayableHtml(game) {
  if (!game || !game.id) return { ok: false, error: 'Game record required' };
  const genre = resolveGenre(game.genre);
  const moduleFile = GENRE_MODULES[genre] || GENRE_MODULES.adventure;
  const engineName = `${genre.replace(/[^a-z0-9]/gi, '_')}Engine`;

  let engineSrc;
  let helperSrc;
  let audioSrc;
  let progressSrc;
  try {
    [engineSrc, helperSrc, audioSrc, progressSrc] = await Promise.all([
      readFile(path.join(GAMEPLAY_DIR, moduleFile), 'utf8'),
      readFile(path.join(GAMEPLAY_DIR, 'engine.js'), 'utf8'),
      readFile(path.join(GAMEPLAY_DIR, 'audio.js'), 'utf8'),
      readFile(path.join(GAMEPLAY_DIR, 'progress.js'), 'utf8'),
    ]);
  } catch (err) {
    return { ok: false, error: `Gameplay sources unavailable: ${err.message}` };
  }

  const helpers = [
    toScriptScope(helperSrc, 'helpers'),
    toScriptScope(audioSrc, 'audio'),
    toScriptScope(progressSrc, 'progress'),
  ].join('\n');
  const engine = toScriptScope(engineSrc, engineName);
  const palette = readPalette(game.theme);
  const title = String(game.name || 'GenPlay 游戏');
  const label = GENRE_LABELS[genre] || genre;
  const hint = extractHint(engineSrc);

  const payload = {
    id: game.id,
    name: title,
    genre,
    label,
    hint,
    palette,
    config: game.config || {},
    theme: {
      key: game.theme?.key || null,
      font: game.theme?.font || null,
    },
    // Ambient particle effects + environment ambience ride along so the
    // exported file renders the same presentation as the studio preview.
    vfx: Array.isArray(game.vfx) ? game.vfx.filter((e) => e && e.enabled !== false) : [],
    environment: game.environment && typeof game.environment === 'object' ? game.environment : null,
    // Immersive runtime data: composed soundtrack and achievement rules.
    audio: Array.isArray(game.audio?.composed) ? game.audio.composed : [],
    achievements: Array.isArray(game.meta?.achievements) ? game.meta.achievements : [],
  };

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(title)} · GenPlay</title>
<style>
  :root {
    --gp-a: ${palette[0]};
    --gp-b: ${palette[1]};
    --gp-c: ${palette[2]};
    --gp-ink: #f8fafc;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    display: grid; place-items: center; padding: 18px;
    background: radial-gradient(120% 120% at 15% 0%, rgba(109,40,217,0.35), transparent 55%),
                radial-gradient(120% 120% at 90% 100%, rgba(250,204,21,0.20), transparent 50%),
                #05060d;
    color: var(--gp-ink);
    font-family: ui-sans-serif, -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  }
  .gp-shell {
    width: min(760px, 100%);
    border-radius: 22px; padding: 16px;
    background: linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10);
    backdrop-filter: blur(14px);
  }
  .gp-head { display: flex; align-items: center; gap: 10px; padding: 2px 4px 12px; }
  .gp-dot { width: 10px; height: 10px; border-radius: 99px; background: var(--gp-b); box-shadow: 0 0 12px var(--gp-b); }
  .gp-title { font-size: 1rem; font-weight: 700; letter-spacing: 0.01em; }
  .gp-chip {
    margin-left: auto; font-size: 0.72rem; padding: 4px 10px; border-radius: 999px;
    color: #0b1020; background: linear-gradient(120deg, var(--gp-c), var(--gp-b));
    font-weight: 700;
  }
  .gp-stage { position: relative; border-radius: 16px; overflow: hidden; background: #07070f; border: 1px solid rgba(255,255,255,0.10); }
  canvas { display: block; width: 100%; height: auto; aspect-ratio: 640 / 400; touch-action: none; outline: none; }
  .gp-overlay {
    position: absolute; inset: 0; display: grid; place-content: center; gap: 8px; text-align: center;
    background: rgba(6,7,16,0.78); backdrop-filter: blur(6px);
  }
  .gp-overlay[hidden] { display: none; }
  .gp-over-title { font-size: 1.35rem; font-weight: 800; letter-spacing: 0.02em; }
  .gp-over-sub { color: rgba(248,250,252,0.72); font-size: 0.86rem; }
  .gp-foot { display: flex; align-items: center; gap: 12px; padding: 12px 4px 2px; flex-wrap: wrap; }
  .gp-score { font-size: 0.86rem; color: rgba(248,250,252,0.72); }
  .gp-score b { color: var(--gp-c); font-size: 1rem; }
  .gp-hint { font-size: 0.74rem; color: rgba(248,250,252,0.55); flex: 1 1 220px; }
  .gp-btn {
    appearance: none; border: 1px solid rgba(255,255,255,0.16); cursor: pointer;
    background: linear-gradient(140deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04));
    color: var(--gp-ink); border-radius: 12px; padding: 8px 14px; font-size: 0.8rem; font-weight: 600;
  }
  .gp-btn:active { transform: translateY(1px); }
  .gp-pad { display: grid; grid-template-columns: repeat(3, 52px); gap: 8px; justify-content: center; margin: 14px auto 2px; }
  .gp-pad button {
    width: 52px; height: 52px; border-radius: 14px; font-size: 1.1rem;
    border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06); color: var(--gp-ink);
    touch-action: manipulation; user-select: none;
  }
  .gp-pad button:active { background: rgba(255,255,255,0.18); }
  .gp-pad .gp-pad-action { grid-column: 2; }
  .gp-pad.gp-pad-off { display: none !important; }
  .gp-pad.gp-pad-on { display: grid !important; }
  .gp-best b { color: #fbbf24; }
  .gp-toasts { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 4px 0; }
  .gp-toast {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
    border-radius: 999px; font-size: 0.74rem; font-weight: 600; color: #fde68a;
    background: rgba(251,191,36,0.16); border: 1px solid rgba(251,191,36,0.32);
  }
  @media (min-width: 720px) { .gp-pad { display: none; } }
</style>
</head>
<body>
<div class="gp-shell">
  <div class="gp-head">
    <span class="gp-dot"></span>
    <span class="gp-title">${escapeHtml(title)}</span>
    <span class="gp-chip">${escapeHtml(label)}</span>
  </div>
  <div class="gp-stage">
    <canvas id="gp-canvas" width="640" height="400" tabindex="0" aria-label="${escapeHtml(title)} 游戏画布"></canvas>
    <div class="gp-overlay" id="gp-overlay" hidden>
      <div class="gp-over-title" id="gp-over-title">游戏结束</div>
      <div class="gp-over-sub" id="gp-over-sub"></div>
    </div>
  </div>
  <div class="gp-foot">
    <span class="gp-score">得分 <b id="gp-score">0</b></span>
    <span class="gp-score gp-best" id="gp-best-wrap" hidden>最佳 <b id="gp-best">0</b></span>
    <span class="gp-hint" id="gp-hint"></span>
    <button class="gp-btn" id="gp-restart">重新开始</button>
  </div>
  <div class="gp-toasts" id="gp-toasts"></div>
  <div class="gp-pad" id="gp-pad">
    <button data-key="up">▲</button>
    <button data-key="action">●</button>
    <button data-key="left">◀</button>
    <button data-key="down">▼</button>
    <button data-key="right">▶</button>
  </div>
</div>
<script>
/* ---- shared engine helpers ---- */
${helpers}
/* ---- gameplay module: ${moduleFile} ---- */
${engine}
/* ---- runtime ---- */
(function () {
  var GAME = ${SAFE_JSON(payload)};
  var engine = ${engineName};
  var canvas = document.getElementById('gp-canvas');
  var ctx = canvas.getContext('2d');
  var W = canvas.width = 640;
  var H = canvas.height = 400;
  var keysDown = new Set();
  var state = null;
  var over = false;
  var paused = false;
  var prevScore = 0;
  var lastPickupAt = 0;
  var last = performance.now();
  var acc = 0;
  var scoreEl = document.getElementById('gp-score');
  var overlay = document.getElementById('gp-overlay');
  var overTitle = document.getElementById('gp-over-title');
  var overSub = document.getElementById('gp-over-sub');
  var hintEl = document.getElementById('gp-hint');

  hintEl.textContent = GAME.hint || '';

  // Immersive runtime: soundtrack, SFX, presentation prefs and achievements.
  var PRES = (GAME.config && GAME.config.presentation) || {};
  var AUDIO = createAudioRuntime();
  AUDIO.setVolume(PRES.volume === undefined ? 0.7 : PRES.volume);
  AUDIO.setMuted(!!PRES.muted);
  var TRACK = pickTrackForGenre(GAME.audio || [], GAME.genre);
  var bestWrap = document.getElementById('gp-best-wrap');
  var bestEl = document.getElementById('gp-best');
  var toastBox = document.getElementById('gp-toasts');
  var profile = readProfile(GAME.id);
  if (bestEl && PRES.showBestScore !== false && profile.best > 0) {
    bestWrap.hidden = false;
    bestEl.textContent = String(profile.best);
  }
  var padActions = new Set();
  var controlsCfg = (GAME.config && GAME.config.controls) || {};
  var padEl = document.getElementById('gp-pad');
  if (padEl) {
    if (controlsCfg.touchPad === false) padEl.className = 'gp-pad gp-pad-off';
    else if (controlsCfg.touchPad === true) padEl.className = 'gp-pad gp-pad-on';
  }

  // Gamepad polling: axes drive movement, buttons drive jump / shoot.
  function pollGamepad() {
    padActions.clear();
    if (!controlsCfg.gamepad || !navigator.getGamepads) return;
    var gp = navigator.getGamepads()[0];
    if (!gp) return;
    var ax = gp.axes[0] || 0;
    var ay = gp.axes[1] || 0;
    if (ax < -0.3) padActions.add('left');
    else if (ax > 0.3) padActions.add('right');
    if (ay < -0.3) padActions.add('up');
    else if (ay > 0.3) padActions.add('down');
    if (gp.buttons[0] && gp.buttons[0].pressed) padActions.add('jump');
    if (gp.buttons[1] && gp.buttons[1].pressed) padActions.add('shoot');
  }

  function showToasts(unlocked) {
    if (!toastBox || PRES.achievementToasts === false) return;
    for (var i = 0; i < unlocked.length; i++) {
      var chip = document.createElement('div');
      chip.className = 'gp-toast';
      chip.textContent = (unlocked[i].icon || '🏅') + ' 解锁成就「' + unlocked[i].name + '」';
      toastBox.appendChild(chip);
    }
  }

  // Custom controls: merge the configured remap over the engine default keys.
  var KEYMAP = {};
  (function () {
    var k;
    for (k in engine.keys) KEYMAP[k] = engine.keys[k];
    var remap = (GAME.config && GAME.config.controls && GAME.config.controls.remap) || {};
    for (var action in remap) {
      for (k in KEYMAP) { if (KEYMAP[k] === action) delete KEYMAP[k]; }
      if (remap[action]) KEYMAP[remap[action]] = action;
    }
  })();

  // Ambient particle systems from GAME.vfx plus the environment weather.
  var fxList = [];
  function buildFx() {
    fxList = [];
    var vfx = GAME.vfx || [];
    for (var i = 0; i < vfx.length; i++) {
      if (vfx[i] && vfx[i].preset) fxList.push(createFx(vfx[i], W, H));
    }
    var weather = GAME.environment && GAME.environment.weather;
    if (weather && FX_PRESETS[weather]) fxList.push(createFx({ preset: weather }, W, H));
  }

  function readInput() {
    var input = {};
    var actions = Object.keys(KEYMAP);
    for (var i = 0; i < actions.length; i++) {
      var action = KEYMAP[actions[i]];
      if (keysDown.has(action) || padActions.has(action)) input[action] = true;
    }
    return input;
  }

  function syncScore() {
    if (state && state.score !== undefined) {
      var next = String(state.score);
      if (scoreEl.textContent !== next) scoreEl.textContent = next;
    }
  }

  function reset() {
    state = engine.init(canvas, GAME.config || {});
    over = false;
    acc = 0;
    last = performance.now();
    overlay.hidden = true;
    syncScore();
    buildFx();
    prevScore = 0;
    lastPickupAt = 0;
    if (toastBox) toastBox.innerHTML = '';
    AUDIO.unlock();
    if (TRACK) AUDIO.playTrack(TRACK, { loop: true });
    else AUDIO.playSfx('onButton');
    canvas.focus();
  }

  function finish() {
    over = true;
    overlay.hidden = false;
    var solved = !!(state && state.solved);
    var scoreNow = state && state.score !== undefined ? state.score : 0;
    overTitle.textContent = solved ? '挑战完成' : '游戏结束';
    overSub.textContent = '得分 ' + scoreNow + ' · 按空格或点击重新开始';
    AUDIO.playSfx(solved ? 'onWin' : 'onLose');
    // Fold the session into the local profile and unlock any new achievements.
    var session = {
      score: scoreNow,
      wins: solved ? 1 : 0,
      deaths: solved ? 0 : 1,
      level: (state && state.level) || 0,
    };
    profile = mergeStats(profile, session);
    var evalStats = {
      score: profile.best, wins: profile.wins,
      deaths: profile.deaths, level: profile.level,
    };
    var unlocked = evaluateAchievements(GAME.achievements || [], evalStats, profile.achievements);
    if (unlocked.length) {
      profile.achievements = profile.achievements.concat(unlocked.map(function (a) { return a.id; }));
      showToasts(unlocked);
    }
    writeProfile(GAME.id, profile);
    if (bestEl && PRES.showBestScore !== false && profile.best > 0) {
      bestWrap.hidden = false;
      bestEl.textContent = String(profile.best);
    }
  }

  function loop(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    pollGamepad();
    if (state) {
      if (!paused && !over) {
        acc += dt;
        var step = 1 / 60;
        while (acc >= step) {
          engine.update(state, readInput());
          acc -= step;
        }
      }
      // A score gain plays a pickup chime (throttled to avoid spam).
      if (state.score !== undefined) {
        if (state.score > prevScore && now - lastPickupAt > 220) {
          AUDIO.playSfx('onPickup');
          lastPickupAt = now;
        }
        prevScore = state.score;
      }
      engine.render(state, ctx);
      // Environment grading + ambient particles ride on top of the world pass.
      if (GAME.environment) applyEnvironment(GAME.environment, ctx, W, H, now / 1000);
      for (var fi = 0; fi < fxList.length; fi++) {
        updateFx(fxList[fi], dt, W, H);
        renderFx(fxList[fi], ctx);
      }
      syncScore();
      if (!over && (state.over || state.solved)) finish();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', function (event) {
    var action = KEYMAP[event.key];
    if (!action) return;
    event.preventDefault();
    AUDIO.unlock();
    if (action === 'jump') AUDIO.playSfx('onJump');
    else if (action === 'shoot') AUDIO.playSfx('onShoot');
    if ((action === 'shoot' || action === 'confirm' || action === 'reset') && over) {
      reset();
      return;
    }
    keysDown.add(action);
  });
  window.addEventListener('keyup', function (event) {
    var action = KEYMAP[event.key];
    if (!action) return;
    keysDown.delete(action);
  });

  canvas.addEventListener('click', function (event) {
    if (!engine.onPointer || !state) return;
    var rect = canvas.getBoundingClientRect();
    var x = (event.clientX - rect.left) * (W / rect.width);
    var y = (event.clientY - rect.top) * (H / rect.height);
    engine.onPointer(state, x, y, false);
  });
  canvas.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    if (!engine.onPointer || !state) return;
    var rect = canvas.getBoundingClientRect();
    var x = (event.clientX - rect.left) * (W / rect.width);
    var y = (event.clientY - rect.top) * (H / rect.height);
    engine.onPointer(state, x, y, true);
  });

  document.getElementById('gp-restart').addEventListener('click', reset);
  overlay.addEventListener('click', reset);

  // Touch pad: maps pad buttons to engine action names so mobile players can
  // control the game without a physical keyboard. The action button presses
  // both jump and shoot so it works across every genre.
  var padMap = { up: ['up'], down: ['down'], left: ['left'], right: ['right'], action: ['jump', 'shoot'] };
  document.querySelectorAll('#gp-pad button').forEach(function (button) {
    var actions = padMap[button.dataset.key] || [button.dataset.key];
    var pressed = false;
    var down = function (event) {
      event.preventDefault();
      AUDIO.unlock();
      if (over && (actions.indexOf('shoot') !== -1 || actions.indexOf('confirm') !== -1)) { reset(); return; }
      pressed = true;
      for (var i = 0; i < actions.length; i++) keysDown.add(actions[i]);
    };
    var up = function (event) {
      event.preventDefault();
      if (!pressed) return;
      pressed = false;
      for (var i = 0; i < actions.length; i++) keysDown.delete(actions[i]);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', up);
  });

  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
    last = performance.now();
  });

  reset();
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;

  return {
    ok: true,
    html,
    bytes: Buffer.byteLength(html, 'utf8'),
    genre,
    label,
    fileName: `${sanitizeFileName(title)}.html`,
  };
}

function extractHint(engineSrc) {
  const match = engineSrc.match(/hint:\s*['"`]([^'"`]+)['"`]/);
  return match ? match[1] : '方向键 / WASD 操作';
}

function sanitizeFileName(name) {
  return String(name || 'genplay-game')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'genplay-game';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
