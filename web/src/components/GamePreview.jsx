import { useEffect, useRef, useState } from 'react';
import { getEngine, getLabel } from '../gameplay/registry.js';
import events from '../services/events.js';

/**
 * GamePreview - 真实可玩的游戏预览画布
 * 通过 gameplay 引擎注册中心按 genre 路由到独立玩法实现，
 * 每种类型拥有自己的 init/update/render 与按键映射，并支持可选的画布点击交互。
 */
export default function GamePreview({ game }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const resetRef = useRef(null);
  const overRef = useRef(false);
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  // Runtime control state driven by the control_runtime agent tool.
  const speedRef = useRef(1);
  const invincibleRef = useRef(false);
  const godmodeRef = useRef(false);
  const pausedRef = useRef(false);
  const genre = (game?.genre || 'adventure').toLowerCase();
  const engine = getEngine(genre);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 640;
    const H = canvas.height = 400;
    const keysDown = new Set();

    const reset = () => {
      stateRef.current = engine.init(canvas, game?.config || {});
      overRef.current = false;
      setScore(0);
      setOver(false);
      setStatus('running');
    };
    resetRef.current = reset;
    reset();

    let raf;
    let acc = 0;
    let last = performance.now();
    const loop = (now) => {
      const s = stateRef.current;
      if (!s) { raf = requestAnimationFrame(loop); return; }

      // Respect the agent-controlled pause and speed multiplier.
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) {
        acc += dt * speedRef.current;
        // Run update at a fixed-step scaled by speed for deterministic feel.
        const step = 1 / 60;
        while (acc >= step) {
          const input = readInput(engine.keys, keysDown);
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

      // Sync display state.
      if (s.score !== undefined) setScore((prev) => (prev === s.score ? prev : s.score));
      const isOver = Boolean(s.over || s.solved);
      if (isOver !== overRef.current) {
        overRef.current = isOver;
        setOver(isOver);
        setStatus(isOver ? 'over' : (pausedRef.current ? 'paused' : 'running'));
      }

      engine.render(s, ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e) => {
      const k = engine.keys[e.key];
      if (!k) return;
      e.preventDefault();
      if (e.type === 'keydown') {
        if ((k === 'shoot' || k === 'confirm' || k === 'reset') && overRef.current) {
          reset();
          return;
        }
        keysDown.add(k);
      } else {
        keysDown.delete(k);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    // Canvas pointer interactions (puzzle clicks, sandbox build/delete, etc.)
    const onPointer = (e, isRight = false) => {
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
        case 'win': if (stateRef.current) stateRef.current.over = true; stateRef.current.solved = true; break;
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
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContext);
      events.off('runtime:command', onRuntime);
      events.off('runtime:save-checkpoint', onSaveCheckpoint);
      events.off('runtime:load-checkpoint', onLoadCheckpoint);
    };
  }, [genre, game?.id, JSON.stringify(game?.config)]);

  const handleRestart = () => resetRef.current?.();

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
      <div className="preview-foot">
        <span>得分 <b>{score}</b></span>
        <span className="preview-controls">{engine.hint}</span>
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

function readInput(keyMap, keysDown) {
  const input = {};
  for (const action of Object.values(keyMap)) {
    if (keysDown.has(action)) input[action] = true;
  }
  return input;
}
