import { useEffect, useRef, useState } from 'react';
import { getEngine, getLabel } from '../gameplay/registry.js';
import {
  FX_PRESETS, createFx, updateFx, renderFx,
  applyEnvironment, createShake, shakeTrigger, shakeOffset,
} from '../gameplay/engine.js';
import { createAudioRuntime, pickTrackForGenre } from '../gameplay/audio.js';
import { readProfile, writeProfile, mergeStats, evaluateAchievements } from '../gameplay/progress.js';
import events from '../services/events.js';

/**
 * GamePreview - playable game canvas.
 * Routes to the genre engine registry, merges agent-configured controls, and
 * renders the shared presentation layer (particles, environment, screen shake).
 * Round 6 adds an immersive runtime: procedural soundtrack + SFX, touch pad,
 * gamepad input, achievement unlocks and a persistent best score.
 */
export default function GamePreview({ game }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const resetRef = useRef(null);
  const audioRef = useRef(null);
  const touchRef = useRef(null);
  const overRef = useRef(false);
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [toasts, setToasts] = useState([]);
  // Runtime control state driven by the control_runtime agent tool.
  const speedRef = useRef(1);
  const invincibleRef = useRef(false);
  const godmodeRef = useRef(false);
  const pausedRef = useRef(false);
  const genre = (game?.genre || 'adventure').toLowerCase();
  const engine = getEngine(genre);
  const presentation = game?.config?.presentation || {};
  const controls = game?.config?.controls || {};

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 640;
    const H = canvas.height = 400;
    const keysDown = new Set();
    const padActions = new Set();

    // Custom controls: merge the agent-configured remap over the engine's
    // default key map (action -> key stored on config.controls.remap).
    const keymap = { ...engine.keys };
    const remap = controls.remap || {};
    for (const [action, key] of Object.entries(remap)) {
      for (const k of Object.keys(keymap)) {
        if (keymap[k] === action) delete keymap[k];
      }
      if (key) keymap[key] = action;
    }

    // Ambient particle systems from game.vfx plus the environment weather.
    const fxListRef = { current: [] };
    const buildFx = () => {
      const list = [];
      for (const e of (Array.isArray(game?.vfx) ? game.vfx : [])) {
        if (e && e.enabled !== false && e.preset) list.push(createFx(e, W, H));
      }
      const weather = game?.environment?.weather;
      if (weather && FX_PRESETS[weather]) list.push(createFx({ preset: weather }, W, H));
      fxListRef.current = list;
    };
    const envRef = { current: game?.environment || null };
    const shake = createShake();
    const reducedMotion = Boolean(presentation.reducedMotion);
    const prevScoreRef = { current: 0 };
    const lastPickupAt = { current: 0 };

    // Audio runtime: procedural soundtrack + synthesized gameplay effects.
    const audio = createAudioRuntime();
    audioRef.current = audio;
    audio.setVolume(presentation.volume ?? 0.7);
    audio.setMuted(Boolean(presentation.muted));
    setMuted(Boolean(presentation.muted));
    const track = pickTrackForGenre(game?.audio?.composed, genre);

    // Local profile: best score, cumulative wins/deaths, unlocked achievements.
    const profileRef = { current: readProfile(game?.id) };
    setBest(profileRef.current.best);

    const reset = () => {
      stateRef.current = engine.init(canvas, game?.config || {});
      overRef.current = false;
      setScore(0);
      setOver(false);
      setStatus('running');
      setToasts([]);
      buildFx();
      prevScoreRef.current = 0;
      if (track) audio.playTrack(track, { loop: true });
      audio.playSfx('onButton');
    };
    resetRef.current = reset;
    reset();

    // Touch pad handlers let the on-screen buttons drive the same key state.
    touchRef.current = {
      press(action) {
        const acts = action === 'action' ? ['jump', 'shoot'] : [action];
        acts.forEach((a) => keysDown.add(a));
      },
      release(action) {
        const acts = action === 'action' ? ['jump', 'shoot'] : [action];
        acts.forEach((a) => keysDown.delete(a));
      },
    };

    // Gamepad polling: D-pad axes drive movement, buttons drive jump/shoot.
    const pollGamepad = () => {
      padActions.clear();
      if (!controls.gamepad || typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      const gp = pads && pads[0];
      if (!gp) return;
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      if (ax < -0.3) padActions.add('left');
      else if (ax > 0.3) padActions.add('right');
      if (ay < -0.3) padActions.add('up');
      else if (ay > 0.3) padActions.add('down');
      if (gp.buttons[0] && gp.buttons[0].pressed) padActions.add('jump');
      if (gp.buttons[1] && gp.buttons[1].pressed) padActions.add('shoot');
    };

    let raf;
    let acc = 0;
    let last = performance.now();
    const loop = (now) => {
      const s = stateRef.current;
      if (!s) { raf = requestAnimationFrame(loop); return; }

      pollGamepad();

      // Respect the agent-controlled pause and speed multiplier.
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) {
        acc += dt * speedRef.current;
        // Run update at a fixed-step scaled by speed for deterministic feel.
        const step = 1 / 60;
        while (acc >= step) {
          const input = readInput(keymap, keysDown, padActions);
          // Apply invincibility: suppress damage by clearing enemy collisions.
          if (invincibleRef.current && s.player) s.player.invincible = true;
          // God mode: grant max score and one-hit kills.
          if (godmodeRef.current) {
            if (s.player) { s.player.hp = 999; s.player.atk = 9999; }
            if (s.enemies) s.enemies.forEach((e) => { e.hp = 1; });
          }
          engine.update(s, input);
          acc -= step;
        }
      }

      // Sync display state; a score gain kicks a small screen shake and chime.
      if (s.score !== undefined) {
        if (s.score > prevScoreRef.current) {
          if (!reducedMotion) shakeTrigger(shake, 3.5);
          if (now - lastPickupAt.current > 220) {
            audio.playSfx('onPickup');
            lastPickupAt.current = now;
          }
        }
        prevScoreRef.current = s.score;
        setScore((prev) => (prev === s.score ? prev : s.score));
      }
      const isOver = Boolean(s.over || s.solved);
      if (isOver !== overRef.current) {
        const solved = Boolean(s.solved);
        overRef.current = isOver;
        setOver(isOver);
        setStatus(isOver ? 'over' : (pausedRef.current ? 'paused' : 'running'));
        if (isOver) {
          audio.playSfx(solved ? 'onWin' : 'onLose');
          // Fold this session into the persistent profile, then unlock badges.
          const session = {
            score: Number(s.score) || 0,
            wins: solved ? 1 : 0,
            deaths: solved ? 0 : 1,
            level: Number(s.level) || 0,
          };
          const profileNow = mergeStats(profileRef.current, session);
          const evalStats = {
            score: profileNow.best,
            wins: profileNow.wins,
            deaths: profileNow.deaths,
            level: profileNow.level,
          };
          const newly = evaluateAchievements(
            game?.meta?.achievements, evalStats, profileNow.achievements,
          );
          if (newly.length) {
            profileNow.achievements = [...profileNow.achievements, ...newly.map((a) => a.id)];
            setToasts(newly.map((a) => ({ id: a.id, icon: a.icon || '🏅', name: a.name })));
          }
          profileRef.current = profileNow;
          writeProfile(game?.id, profileNow);
          setBest(profileNow.best);
        }
      }

      // World pass (shaken unless reduced motion) then grading + particles.
      const off = reducedMotion ? { x: 0, y: 0 } : shakeOffset(shake, dt);
      ctx.save();
      ctx.translate(off.x, off.y);
      engine.render(s, ctx);
      ctx.restore();
      if (envRef.current) applyEnvironment(envRef.current, ctx, W, H, now / 1000);
      for (const fx of fxListRef.current) {
        updateFx(fx, dt, W, H);
        renderFx(fx, ctx);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e) => {
      const k = keymap[e.key];
      if (!k) return;
      e.preventDefault();
      audio.unlock();
      if (e.type === 'keydown') {
        if ((k === 'shoot' || k === 'confirm' || k === 'reset') && overRef.current) {
          reset();
          return;
        }
        if (k === 'jump') audio.playSfx('onJump');
        else if (k === 'shoot') audio.playSfx('onShoot');
        keysDown.add(k);
      } else {
        keysDown.delete(k);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    // Canvas pointer interactions (puzzle clicks, sandbox build/delete, etc.)
    const onPointer = (e, isRight = false) => {
      audio.unlock();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const y = (e.clientY - rect.top) * (H / rect.height);
      if (engine.onPointer && stateRef.current) {
        engine.onPointer(stateRef.current, x, y, isRight);
      }
    };
    const onClick = (e) => onPointer(e, false);
    const onContext = (e) => { e.preventDefault(); onPointer(e, true); };
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', onContext);

    // Listen for runtime control commands emitted by the control_runtime agent
    // tool (forwarded from StudioPanel via the runtime:command event).
    const onRuntime = ({ command, speed, entity, count, enabled }) => {
      switch (command) {
        case 'restart': reset(); break;
        case 'speed': if (typeof speed === 'number') speedRef.current = speed; break;
        case 'pause': pausedRef.current = true; setStatus('paused'); break;
        case 'resume': pausedRef.current = false; setStatus('running'); break;
        case 'invincible': invincibleRef.current = enabled ?? true; break;
        case 'godmode': godmodeRef.current = enabled ?? true; break;
        case 'win': if (stateRef.current) { stateRef.current.over = true; stateRef.current.solved = true; } break;
        case 'lose': if (stateRef.current) stateRef.current.over = true; break;
        case 'spawn': {
          // Inject test entities into the engine state if supported.
          const s = stateRef.current;
          if (!s) break;
          const n = count || 1;
          if (engine.spawnEntity) {
            for (let i = 0; i < n; i++) engine.spawnEntity(s, entity || 'enemy');
          } else if (s.enemies) {
            for (let i = 0; i < n; i++) s.enemies.push({ x: Math.random() * 640, y: Math.random() * 400, hp: 1 });
          }
          break;
        }
      }
    };
    events.on('runtime:command', onRuntime);

    // Audio commands from manage_audio (mute / volume / stop / audition).
    const onAudioCommand = (payload = {}) => {
      const command = payload.command || 'play';
      if (command === 'mute') { audio.setMuted(true); setMuted(true); }
      else if (command === 'unmute') { audio.setMuted(false); setMuted(false); }
      else if (command === 'volume') { audio.setVolume(payload.value ?? payload.volume); }
      else if (command === 'stop') { audio.stop(); }
      else if (command === 'play') {
        const requested = payload.track || payload.entry;
        const played = requested && requested.tracks
          ? requested
          : pickTrackForPhaseSafe(game?.audio?.composed, requested?.mood);
        if (played) { audio.unlock(); audio.playTrack(played, { loop: true }); }
      }
    };
    events.on('studio:audio-command', onAudioCommand);
    events.on('studio:play-audio', onAudioCommand);

    // Checkpoint state: capture/restore live runtime state for the
    // checkpoint_state agent tool. Snapshots are stored locally in-memory.
    const runtimeCheckpoints = {};
    const onSaveCheckpoint = ({ checkpoint }) => {
      if (!checkpoint?.id || !stateRef.current) return;
      try {
        runtimeCheckpoints[checkpoint.id] = JSON.parse(JSON.stringify(stateRef.current));
      } catch (_) { /* non-serializable state, skip */ }
    };
    const onLoadCheckpoint = ({ checkpoint }) => {
      if (!checkpoint?.id || !runtimeCheckpoints[checkpoint.id]) return;
      const snap = runtimeCheckpoints[checkpoint.id];
      // Merge saved fields back into the live state (keep non-serializable refs).
      Object.keys(snap).forEach((k) => { stateRef.current[k] = snap[k]; });
      overRef.current = false;
      setOver(false);
      setStatus('running');
    };
    events.on('runtime:save-checkpoint', onSaveCheckpoint);
    events.on('runtime:load-checkpoint', onLoadCheckpoint);

    canvas.focus?.();
    return () => {
      cancelAnimationFrame(raf);
      audio.stop();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContext);
      events.off('runtime:command', onRuntime);
      events.off('studio:audio-command', onAudioCommand);
      events.off('studio:play-audio', onAudioCommand);
      events.off('runtime:save-checkpoint', onSaveCheckpoint);
      events.off('runtime:load-checkpoint', onLoadCheckpoint);
    };
  }, [genre, game?.id, JSON.stringify(game?.config), JSON.stringify(game?.vfx), JSON.stringify(game?.environment), JSON.stringify(game?.audio?.composed), JSON.stringify(game?.meta?.achievements)]);

  const handleRestart = () => resetRef.current?.();

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRef.current?.setMuted(next);
  };

  return (
    <div className="game-preview">
      <div className="preview-head">
        <span className="preview-title">{game?.name || '未命名游戏'}</span>
        <span className="preview-genre">{getLabel(genre)}</span>
        <span className={`preview-status ${status}`}>
          {status === 'running' ? '运行中' : status === 'over' ? '已结束' : status === 'paused' ? '已暂停' : '就绪'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="preview-canvas"
        aria-label="游戏预览画布"
      />
      {/* Achievement unlock toasts, persistent across the session. */}
      {toasts.length > 0 && (
        <div className="preview-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="toast-chip">
              <span className="toast-icon">{t.icon}</span> 解锁成就「{t.name}」
            </div>
          ))}
        </div>
      )}
      {/* On-screen touch pad, enabled by configure_controls (touchPad). */}
      {controls.touchPad && (
        <div className="touch-pad" aria-label="触屏方向键">
          <div className="touch-row">
            <button
              className="touch-btn"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current?.press('up'); }}
              onPointerUp={() => touchRef.current?.release('up')}
              onPointerLeave={() => touchRef.current?.release('up')}
              onPointerCancel={() => touchRef.current?.release('up')}
            >▲</button>
          </div>
          <div className="touch-row">
            <button
              className="touch-btn"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current?.press('left'); }}
              onPointerUp={() => touchRef.current?.release('left')}
              onPointerLeave={() => touchRef.current?.release('left')}
              onPointerCancel={() => touchRef.current?.release('left')}
            >◀</button>
            <button
              className="touch-btn touch-btn-action"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current?.press('action'); }}
              onPointerUp={() => touchRef.current?.release('action')}
              onPointerLeave={() => touchRef.current?.release('action')}
              onPointerCancel={() => touchRef.current?.release('action')}
            >●</button>
            <button
              className="touch-btn"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current?.press('right'); }}
              onPointerUp={() => touchRef.current?.release('right')}
              onPointerLeave={() => touchRef.current?.release('right')}
              onPointerCancel={() => touchRef.current?.release('right')}
            >▶</button>
          </div>
          <div className="touch-row">
            <button
              className="touch-btn"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current?.press('down'); }}
              onPointerUp={() => touchRef.current?.release('down')}
              onPointerLeave={() => touchRef.current?.release('down')}
              onPointerCancel={() => touchRef.current?.release('down')}
            >▼</button>
          </div>
        </div>
      )}
      <div className="preview-foot">
        <span>得分 <b>{score}</b></span>
        {best > 0 && <span className="preview-best">最佳 <b>{best}</b></span>}
        <span className="preview-controls">{engine.hint}</span>
        <button className="btn-ghost btn-sm" onClick={toggleMute} title="切换声音">
          {muted ? '🔇 静音' : '🔊 声音'}
        </button>
        {over && (
          <button className="btn-ghost btn-sm" onClick={handleRestart}>重新开始</button>
        )}
      </div>
      {/* Runtime checkpoints managed by the checkpoint_state agent tool. */}
      {Array.isArray(game?.checkpoints) && game.checkpoints.length > 0 && (
        <div className="checkpoint-bar">
          <span className="checkpoint-label">💾 检查点</span>
          {game.checkpoints.map((cp) => (
            <button
              key={cp.id}
              className="checkpoint-chip"
              onClick={() => events.emit('runtime:load-checkpoint', { gameId: game.id, checkpoint: cp })}
              title={`加载 ${cp.name}`}
            >
              {cp.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Resolve an audition request: prefer a track object, otherwise match mood,
 * otherwise fall back to the first composed track.
 */
function pickTrackForPhaseSafe(composed, mood) {
  const list = Array.isArray(composed) ? composed.filter((t) => t && t.tracks) : [];
  if (!list.length) return null;
  if (mood) {
    const hit = list.find((t) => (t.mood || '') === mood);
    if (hit) return hit;
  }
  return list[0];
}

function readInput(keyMap, keysDown, extra) {
  const input = {};
  for (const action of Object.values(keyMap)) {
    if (keysDown.has(action) || (extra && extra.has(action))) input[action] = true;
  }
  return input;
}
