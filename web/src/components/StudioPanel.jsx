import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import GamePreview from './GamePreview.jsx';

export default function StudioPanel({ gameId, onGamesChange, onSelectGame }) {
  const [form, setForm] = useState({ name: '', genre: 'adventure', description: '' });
  const [game, setGame] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (gameId) loadGame(gameId);
  }, [gameId]);

  const loadGame = async (id) => {
    try {
      const data = await api.getGame(id);
      setGame(data.game);
    } catch (err) {
      console.error(err);
    }
  };

  const createGame = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const data = await api.createGame(form);
      setForm({ name: '', genre: 'adventure', description: '' });
      setGame(data.game);
      onSelectGame(data.game.id);
      onGamesChange();
    } catch (err) {
      alert(`创建失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveGame = async () => {
    if (!game) return;
    try {
      const data = await api.updateGame(game.id, {
        name: game.name,
        genre: game.genre,
        description: game.description,
        scripts: game.scripts,
      });
      setGame(data.game);
      onGamesChange();
    } catch (err) {
      alert(`保存失败: ${err.message}`);
    }
  };

  const runGame = async () => {
    if (!game) return;
    try {
      const data = await api.runGame(game.id);
      setRunResult(data.result);
      loadGame(game.id);
    } catch (err) {
      alert(`运行失败: ${err.message}`);
    }
  };

  const deleteGame = async () => {
    if (!game) return;
    if (!confirm(`确定删除游戏「${game.name}」？`)) return;
    await api.deleteGame(game.id);
    setGame(null);
    setRunResult(null);
    onSelectGame(null);
    onGamesChange();
  };

  return (
    <div className="studio-panel">
      <header className="panel-header">
        <h2>创作工坊</h2>
        <span className="panel-hint">AI 原生游戏创作与编辑</span>
      </header>

      {/* 新建表单 */}
      <section className="create-box">
        <h3>新建游戏</h3>
        <div className="create-row">
          <input
            placeholder="游戏名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            value={form.genre}
            onChange={(e) => setForm({ ...form, genre: e.target.value })}
          >
            <option value="adventure">冒险</option>
            <option value="shooter">射击</option>
            <option value="rpg">RPG</option>
            <option value="puzzle">解谜</option>
            <option value="racing">赛车</option>
            <option value="simulation">模拟</option>
          </select>
          <button className="btn-primary" onClick={createGame} disabled={loading}>
            {loading ? '创建中…' : '创建'}
          </button>
        </div>
        <input
          className="create-desc"
          placeholder="游戏描述（可选）"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </section>

      {/* 编辑区 */}
      {game ? (
        <section className="edit-box">
          <div className="edit-head">
            <h3>编辑：{game.name}</h3>
            <div className="edit-actions">
              <button className="btn-ghost" onClick={saveGame}>保存</button>
              <button className="btn-ghost" onClick={runGame}>运行调试</button>
              <button className="btn-primary" onClick={() => setPreviewOpen(true)}>试玩预览</button>
              <button className="btn-danger" onClick={deleteGame}>删除</button>
            </div>
          </div>

          <div className="field">
            <label>名称</label>
            <input value={game.name} onChange={(e) => setGame({ ...game, name: e.target.value })} />
          </div>
          <div className="field">
            <label>类型</label>
            <select value={game.genre} onChange={(e) => setGame({ ...game, genre: e.target.value })}>
              <option value="adventure">冒险</option>
              <option value="shooter">射击</option>
              <option value="rpg">RPG</option>
              <option value="puzzle">解谜</option>
              <option value="racing">赛车</option>
              <option value="simulation">模拟</option>
            </select>
          </div>
          <div className="field">
            <label>描述</label>
            <textarea
              rows={3}
              value={game.description}
              onChange={(e) => setGame({ ...game, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label>游戏逻辑（脚本）</label>
            <textarea
              rows={6}
              className="code-area"
              value={game.scripts || ''}
              onChange={(e) => setGame({ ...game, scripts: e.target.value })}
              placeholder="// 在此编写游戏逻辑，Agent 也可自动生成"
            />
          </div>

          {runResult && (
            <div className={`run-result ${runResult.status}`}>
              <h4>运行结果 · {runResult.durationMs}ms</h4>
              <ul className="logs">
                {runResult.logs.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              {runResult.issues.length > 0 && (
                <p className="issues">告警：{runResult.issues.join('；')}</p>
              )}
            </div>
          )}
        </section>
      ) : (
        <div className="edit-empty">从左侧选择游戏，或在上方创建一个新游戏开始创作。</div>
      )}

      {/* 试玩预览弹层 */}
      {previewOpen && game && (
        <div className="preview-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setPreviewOpen(false)} aria-label="关闭">×</button>
            <GamePreview game={game} />
          </div>
        </div>
      )}
    </div>
  );
}
