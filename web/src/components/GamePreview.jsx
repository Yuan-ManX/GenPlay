import { useEffect, useRef, useState } from 'react';
import { getEngine, getLabel } from '../gameplay/registry.js';

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
    const loop = () => {
      const s = stateRef.current;
      if (!s) { raf = requestAnimationFrame(loop); return; }
      const input = readInput(engine.keys, keysDown);
      engine.update(s, input);

      // 同步显示状态（通过 ref 比较避免重复 setState）
      if (s.score !== undefined) setScore((prev) => (prev === s.score ? prev : s.score));
      const isOver = Boolean(s.over || s.solved);
      if (isOver !== overRef.current) {
        overRef.current = isOver;
        setOver(isOver);
        setStatus(isOver ? 'over' : 'running');
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

    // 画布点击（解谜等需要）
    const onPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (W / rect.width);
      const y = (e.clientY - rect.top) * (H / rect.height);
      if (engine.onPointer && stateRef.current) {
        engine.onPointer(stateRef.current, x, y);
      }
    };
    canvas.addEventListener('click', onPointer);

    canvas.focus?.();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('click', onPointer);
    };
  }, [genre, game?.id, JSON.stringify(game?.config)]);

  const handleRestart = () => resetRef.current?.();

  return (
    <div className="game-preview">
      <div className="preview-head">
        <span className="preview-title">{game?.name || '未命名游戏'}</span>
        <span className="preview-genre">{getLabel(genre)}</span>
        <span className={`preview-status ${status}`}>
          {status === 'running' ? '运行中' : status === 'over' ? '已结束' : '就绪'}
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
