import { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api.js';
import events from '../services/events.js';
import GamePreview from './GamePreview.jsx';

const GENRE_OPTIONS = [
  { key: 'adventure', label: '🗺️ 冒险' },
  { key: 'shooter', label: '🚀 射击' },
  { key: 'rpg', label: '⚔️ RPG 回合制' },
  { key: 'puzzle', label: '🧩 解谜' },
  { key: 'battle', label: '🥊 对战格斗' },
  { key: 'racing', label: '🏎️ 赛车' },
  { key: 'simulation', label: '🌾 模拟' },
  { key: 'platformer', label: '🦘 平台跳跃' },
  { key: 'tower', label: '🏰 塔防' },
  { key: 'snake', label: '🐍 贪吃蛇' },
  { key: 'breakout', label: '🧱 打砖块' },
  { key: 'maze', label: '🔮 迷宫探索' },
  { key: 'rhythm', label: '🎵 节奏判定' },
];

const THEME_OPTIONS = [
  { key: 'retro_pixel', label: '像素复古' },
  { key: 'cyberpunk', label: '赛博朋克' },
  { key: 'sakura', label: '樱花物语' },
  { key: 'arcade', label: '黄金街机' },
  { key: 'sunset', label: '日落狂想' },
  { key: 'ocean', label: '深海秘境' },
  { key: 'forest', label: '绿林深处' },
];

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: '简单' },
  { key: 'normal', label: '普通' },
  { key: 'hard', label: '困难' },
  { key: 'hell', label: '地狱' },
];

const SCENARIO_OPTIONS = [
  { key: 'fantasy', label: '魔幻·黎明之剑' },
  { key: 'space', label: '星际·远征方舟' },
  { key: 'cyber', label: '霓虹·回路黑客' },
];

const TABS = [
  { key: 'basic', label: '基础', icon: '📋' },
  { key: 'config', label: '配置', icon: '⚙️' },
  { key: 'scripts', label: '脚本', icon: '💻' },
  { key: 'tweak', label: '调参', icon: '🎚️' },
  { key: 'theme', label: '主题', icon: '🎨' },
  { key: 'scenario', label: '剧情', icon: '📖' },
  { key: 'code', label: '源码', icon: '🧾' },
  { key: 'debug', label: '调试', icon: '🛠️' },
];

export default function StudioPanel({ gameId, onGamesChange, onSelectGame, sessionId }) {
  const [form, setForm] = useState({ name: '', genre: 'adventure', description: '' });
  const [game, setGame] = useState(null);
  const [tab, setTab] = useState('basic');
  const [runResult, setRunResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [codeView, setCodeView] = useState({ sections: null, section: 'all' });

  useEffect(() => { if (gameId) loadGame(gameId); }, [gameId]);

  // ---- Agent event-driven live sync ----
  useEffect(() => {
    const offs = [];
    offs.push(events.on('studio:refresh-game', ({ gameId: id }) => {
      if (id && (!game || game.id === id)) loadGame(id);
      flash('已应用变更');
    }));
    offs.push(events.on('studio:patch-config', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, config: payload.after }) : g);
      setTab('config');
      flash(`配置已更新：${payload.changes?.join(' · ')}`);
    }));
    offs.push(events.on('studio:set-theme', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, theme: payload }) : g);
      setTab('theme');
      flash(`已应用「${payload.name}」主题`);
    }));
    offs.push(events.on('studio:set-scenario', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, scenario: payload }) : g);
      setTab('scenario');
      flash(`剧情《${payload.title}》已写入`);
    }));
    offs.push(events.on('studio:focus-code', ({ gameId: id, payload }) => {
      setCodeView({ sections: payload.sections, section: payload.section || 'all' });
      setTab('code');
      if (!game || game.id !== id) loadGame(id);
      flash('已定位到代码快照');
    }));
    offs.push(events.on('studio:apply-diff', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      setTab('debug');
      flash(payload.applied ? '问题已自动修复' : '已输出诊断报告');
    }));
    return () => offs.forEach((f) => f && f());
  }, [game?.id]);

  const loadGame = async (id) => {
    try {
      const data = await api.getGame(id);
      setGame(data.game);
      setRunResult(data.game.lastRun || null);
    } catch (err) { console.error(err); }
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const createGame = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const data = await api.createGame(form);
      setForm({ name: '', genre: 'adventure', description: '' });
      setGame(data.game);
      onSelectGame?.(data.game.id);
      onGamesChange?.();
      flash('游戏创建成功');
    } catch (err) { alert(`创建失败: ${err.message}`); }
    finally { setLoading(false); }
  };

  const saveGame = async () => {
    if (!game) return;
    try {
      const data = await api.updateGame(game.id, {
        name: game.name, genre: game.genre, description: game.description,
        scripts: game.scripts, config: game.config,
      });
      setGame(data.game);
      onGamesChange?.();
      flash('已保存');
    } catch (err) { alert(`保存失败: ${err.message}`); }
  };

  const runGame = async () => {
    if (!game) return;
    try {
      const data = await api.runGame(game.id);
      setRunResult(data.result);
      loadGame(game.id);
      flash(data.result.status === 'ok' ? '运行成功' : '存在告警');
    } catch (err) { alert(`运行失败: ${err.message}`); }
  };

  const publishGame = async () => {
    if (!game) return;
    if (!confirm(`确认发布游戏「${game.name}」？`)) return;
    try {
      const data = await api.publishGame(game.id);
      setGame(data.game);
      onGamesChange?.();
      flash(`发布成功！链接：${data.shareLink}`);
    } catch (err) { alert(`发布失败: ${err.message}`); }
  };

  const deleteGame = async () => {
    if (!game) return;
    if (!confirm(`确定删除游戏「${game.name}」？`)) return;
    await api.deleteGame(game.id);
    setGame(null); setRunResult(null);
    onSelectGame?.(null);
    onGamesChange?.();
  };

  // Agent tool helpers
  const runEditorAction = async (tool, args = {}) => {
    if (!game?.id) return;
    try {
      const res = await api.editorAction(tool, { gameId: game.id, ...args }, sessionId);
      events.emit('studio:refresh-game', { gameId: game.id });
      loadGame(game.id);
      onGamesChange?.();
      flash(res.result?.summary || '已应用');
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="studio-panel cool-panel">
      <header className="panel-header cool-header">
        <div className="panel-title-row">
          <span className="panel-accent cool-dot" />
          <h2>创作工坊</h2>
        </div>
        <span className="panel-hint">AI 原生 · 多引擎游戏编辑器</span>
      </header>

      {toast && <div className="studio-toast fade-in-slide">{toast}</div>}

      {/* Create form */}
      <section className="create-box">
        <h3>✨ 新建游戏</h3>
        <div className="create-row">
          <input placeholder="游戏名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
            {GENRE_OPTIONS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <button className="btn-primary pulse-on-hover" onClick={createGame} disabled={loading}>
            {loading ? '创建中…' : '＋ 创建'}
          </button>
        </div>
        <input className="create-desc" placeholder="游戏描述（可选，例如：星际冒险、太空站救援）"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </section>

      {!game ? (
        <div className="edit-empty">
          <div className="empty-emoji bounce">🎮</div>
          <p>从左侧选择游戏，或在上方创建一个新游戏开始创作。</p>
          <p className="edit-empty-sub">所有编辑器操作也可以在左侧 Agent 中用自然语言控制。</p>
        </div>
      ) : (
        <section className="studio-split">
          {/* ---------- Left: Editor column ---------- */}
          <div className="editor-col">
            <div className="edit-head">
              <div>
                <h3>{game.name}</h3>
                <div className="edit-sub">
                  <span className={`chip-tag st-${game.status}`}>
                    {game.status === 'published' ? '已发布' : '草稿'}
                  </span>
                  <span className="chip-tag chip-genre">
                    {GENRE_OPTIONS.find((g) => g.key === game.genre)?.label || game.genre}
                  </span>
                  {game.theme?.name && <span className="chip-tag chip-theme">🎨 {game.theme.name}</span>}
                  {game.scenario?.title && <span className="chip-tag chip-scenario">📖 {game.scenario.title}</span>}
                </div>
              </div>
              <div className="edit-actions">
                <button className="btn-ghost" onClick={saveGame}>💾 保存</button>
                <button className="btn-ghost" onClick={runGame}>▶ 运行</button>
                <button className="btn-ghost" onClick={publishGame}>🚀 发布</button>
                <button className="btn-danger" onClick={deleteGame}>🗑️</button>
              </div>
            </div>

            <nav className="tabs">
              {TABS.map((t) => (
                <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''} tab-${t.key}`}
                  onClick={() => setTab(t.key)}>
                  <span className="tab-icon">{t.icon}</span>{t.label}
                </button>
              ))}
            </nav>

            <div className="tab-body">
              {tab === 'basic' && <TabBasic game={game} setGame={setGame} />}
              {tab === 'config' && <TabConfig game={game} setGame={setGame} />}
              {tab === 'scripts' && <TabScripts game={game} setGame={setGame} />}
              {tab === 'tweak' && <TabTweak game={game} setGame={setGame} runEditorAction={runEditorAction} />}
              {tab === 'theme' && <TabTheme game={game} runEditorAction={runEditorAction} />}
              {tab === 'scenario' && <TabScenario game={game} runEditorAction={runEditorAction} />}
              {tab === 'code' && <TabCodeView game={game} codeView={codeView} runEditorAction={runEditorAction} />}
              {tab === 'debug' && <TabDebug game={game} runResult={runResult} runEditorAction={runEditorAction} />}
            </div>
          </div>

          {/* ---------- Right: Live preview column ---------- */}
          <div className="preview-col">
            <div className="preview-col-head">
              <h4>🎯 实时预览</h4>
              <span className="preview-col-hint">
                键盘 · WASD / 方向键 / 空格 进行交互
              </span>
            </div>
            <GamePreview game={game} />
            {runResult && (
              <div className={`run-result ${runResult.status}`}>
                <h4>运行报告 · {runResult.durationMs}ms</h4>
                <ul className="logs">
                  {runResult.logs?.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
                {runResult.issues?.length > 0 && (
                  <p className="issues">告警：{runResult.issues.join('；')}</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- Sub panels ----------

function TabBasic({ game, setGame }) {
  return (
    <div className="tab-fields">
      <div className="field">
        <label>名称</label>
        <input value={game.name} onChange={(e) => setGame({ ...game, name: e.target.value })} />
      </div>
      <div className="field">
        <label>类型</label>
        <select value={game.genre} onChange={(e) => setGame({ ...game, genre: e.target.value })}>
          {GENRE_OPTIONS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>描述</label>
        <textarea rows={4} value={game.description || ''}
          onChange={(e) => setGame({ ...game, description: e.target.value })} />
      </div>
      <div className="field-info">
        <h5>元数据</h5>
        <ul>
          <li>运行次数：<b>{game.runCount || 0}</b></li>
          <li>编辑记录：<b>{(game.editLog || []).length}</b> 条</li>
          <li>最近运行：<b>{game.lastRun?.status || '未运行'}</b></li>
          <li>更新时间：<b>{new Date(game.updatedAt || game.createdAt || Date.now()).toLocaleString()}</b></li>
        </ul>
      </div>
    </div>
  );
}

function TabConfig({ game, setGame }) {
  const cfg = game.config || {};
  const onPatch = (path, value) => {
    const clone = structuredClone(cfg);
    const keys = path.split('.');
    let node = clone;
    for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]] = node[keys[i]] || {};
    node[keys[keys.length - 1]] = value;
    setGame({ ...game, config: clone });
  };

  return (
    <div className="tab-fields">
      <div className="field-info"><h5>游戏配置 JSON（可直接编辑顶层数值）</h5></div>
      <div className="config-grid">
        {Object.entries(cfg).map(([nodeKey, nodeValue]) => (
          <div key={nodeKey} className="config-card">
            <h6>config.{nodeKey}</h6>
            {nodeValue && typeof nodeValue === 'object' ? (
              <div className="config-sub">
                {Object.entries(nodeValue).map(([k, v]) => (
                  <label key={k} className="config-row">
                    <span>{k}</span>
                    {typeof v === 'number' ? (
                      <input type="number" step="0.1" value={v}
                        onChange={(e) => onPatch(`${nodeKey}.${k}`, Number(e.target.value))} />
                    ) : typeof v === 'boolean' ? (
                      <input type="checkbox" checked={v}
                        onChange={(e) => onPatch(`${nodeKey}.${k}`, e.target.checked)} />
                    ) : Array.isArray(v) ? (
                      <input value={JSON.stringify(v)} readOnly />
                    ) : (
                      <input value={v ?? ''}
                        onChange={(e) => onPatch(`${nodeKey}.${k}`, e.target.value)} />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <input value={nodeValue ?? ''}
                onChange={(e) => onPatch(nodeKey, e.target.value)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabScripts({ game, setGame }) {
  return (
    <div className="tab-fields">
      <div className="field">
        <label>游戏逻辑脚本（DSL）</label>
        <textarea rows={14} className="code-area" value={game.scripts || ''}
          onChange={(e) => setGame({ ...game, scripts: e.target.value })}
          placeholder="// 编写游戏逻辑 DSL。Agent 也可自动生成：" />
      </div>
      <div className="field-info">
        <h5>DSL 指令速览</h5>
        <pre className="code-block">
{`genplay::spawn <entity> { position }
on <condition>: genplay::<action> <target> = <value>
on hit(a, b): genplay::score / genplay::despawn / genplay::gameover
on input.<key>: genplay::move / jump / fire / turn`}
        </pre>
      </div>
    </div>
  );
}

function TabTweak({ game, setGame, runEditorAction }) {
  const cfg = game.config || {};
  const player = cfg.player || {};
  const enemy = cfg.enemy || {};

  const setPlayer = (k, v) => {
    const clone = structuredClone(cfg);
    clone.player = clone.player || {};
    clone.player[k] = v;
    setGame({ ...game, config: clone });
  };
  const setEnemy = (k, v) => {
    const clone = structuredClone(cfg);
    clone.enemy = clone.enemy || {};
    clone.enemy[k] = v;
    setGame({ ...game, config: clone });
  };

  return (
    <div className="tab-fields">
      <div className="tweak-row-head">
        <h4>🎚️ 参数调优</h4>
        <div className="tweak-presets">
          {DIFFICULTY_OPTIONS.map((d) => (
            <button key={d.key} className="btn-ghost btn-sm"
              onClick={() => runEditorAction('tweak_params', { difficulty: d.key })}>
              {d.label}预设
            </button>
          ))}
        </div>
      </div>

      <div className="tweak-group">
        <h5>👤 玩家</h5>
        <Slider label="速度" value={player.speed ?? 4} min={1} max={12} step={0.1}
          onChange={(v) => setPlayer('speed', v)} />
        <Slider label="生命值" value={player.hp ?? 3} min={1} max={99} step={1}
          onChange={(v) => setPlayer('hp', Math.round(v))} />
        <Slider label="攻击力" value={player.atk ?? 10} min={1} max={999} step={1}
          onChange={(v) => setPlayer('atk', Math.round(v))} />
        {typeof player.fireRate === 'number' && (
          <Slider label="射速(帧)" value={player.fireRate} min={4} max={60} step={1}
            onChange={(v) => setPlayer('fireRate', Math.round(v))} />
        )}
        {typeof player.jumpForce === 'number' && (
          <Slider label="跳跃力度" value={player.jumpForce} min={4} max={20} step={0.2}
            onChange={(v) => setPlayer('jumpForce', v)} />
        )}
      </div>

      <div className="tweak-group">
        <h5>👾 敌人 / 障碍</h5>
        <Slider label="速度" value={enemy.speed ?? 1.5} min={0.2} max={8} step={0.1}
          onChange={(v) => setEnemy('speed', v)} />
        <Slider label="血量" value={enemy.hp ?? 1} min={1} max={50} step={1}
          onChange={(v) => setEnemy('hp', Math.round(v))} />
        {typeof enemy.spawnEvery === 'number' && (
          <Slider label="生成间隔(帧)" value={enemy.spawnEvery} min={10} max={240} step={1}
            onChange={(v) => setEnemy('spawnEvery', Math.round(v))} />
        )}
      </div>

      <div className="tweak-group">
        <button className="btn-primary" onClick={() => runEditorAction('tweak_params', {
          speed: player.speed, hp: player.hp, damage: player.atk,
        })}>通过 Agent 同步写入</button>
      </div>
    </div>
  );
}

function TabTheme({ game, runEditorAction }) {
  const cur = game.theme;
  return (
    <div className="tab-fields">
      <h4 className="tab-h">🎨 视觉主题</h4>
      {cur && (
        <div className="theme-preview-card" style={{
          background: `linear-gradient(135deg, ${cur.palette?.bg}, ${cur.palette?.muted})`,
          color: cur.palette?.accent,
        }}>
          <div className="theme-preview-head">
            <b>当前：{cur.name}</b>
            <span>{cur.mood}</span>
          </div>
          <div className="palette-row">
            {Object.entries(cur.palette || {}).map(([k, v]) => (
              <div key={k} className="palette-chip" title={`${k}: ${v}`} style={{ background: v }}>
                <small>{k}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="theme-grid">
        {THEME_OPTIONS.map((t) => (
          <button key={t.key} className="theme-card"
            onClick={() => runEditorAction('apply_style_theme', { theme: t.key })}>
            <span className="theme-card-name">{t.label}</span>
            <span className="theme-card-hint">点击应用</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TabScenario({ game, runEditorAction }) {
  const cur = game.scenario;
  return (
    <div className="tab-fields">
      <h4 className="tab-h">📖 剧情场景</h4>
      <div className="scenario-row">
        {SCENARIO_OPTIONS.map((s) => (
          <button key={s.key} className="scenario-card"
            onClick={() => runEditorAction('apply_scenario', { scenarioType: s.key })}>
            {s.label}
          </button>
        ))}
      </div>
      {cur && (
        <div className="scenario-view">
          <div className="scenario-title">《{cur.title}》</div>
          <div className="scenario-backdrop">{cur.backdrop}</div>
          <ul className="scenario-chapters">
            {cur.chapters?.map((c) => (
              <li key={c.id}>
                <b>第{c.id}章 {c.name}：</b>
                {c.objective}
              </li>
            ))}
          </ul>
          <div className="scenario-dialog">
            <blockquote>🎬 开场：{cur.dialog?.intro}</blockquote>
            <blockquote>🏆 胜利：{cur.dialog?.win}</blockquote>
            <blockquote>💔 失败：{cur.dialog?.lose}</blockquote>
          </div>
        </div>
      )}
    </div>
  );
}

function TabCodeView({ game, codeView, runEditorAction }) {
  const sections = codeView.sections || {
    config: game.config, scripts: game.scripts,
    theme: game.theme, scenario: game.scenario,
  };
  return (
    <div className="tab-fields">
      <div className="code-tabs">
        {['all', 'config', 'scripts', 'theme', 'scenario'].map((s) => (
          <button key={s} className="btn-ghost btn-sm"
            onClick={() => runEditorAction('view_code', { section: s })}>
            {s === 'all' ? '全部' : s}
          </button>
        ))}
      </div>
      {Object.entries(sections).map(([k, v]) => (
        <div key={k} className="code-block-wrap">
          <div className="code-block-title">{k.toUpperCase()}</div>
          <pre className="code-block">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

function TabDebug({ game, runResult, runEditorAction }) {
  return (
    <div className="tab-fields">
      <h4 className="tab-h">🛠️ 调试面板</h4>
      <div className="debug-actions">
        <button className="btn-ghost" onClick={() => runEditorAction('debug_game')}>🔍 静态检查</button>
        <button className="btn-primary" onClick={() => runEditorAction('debug_with_diffs')}>🛠️ 深度修复（自动打补丁）</button>
        <button className="btn-ghost" onClick={() => runEditorAction('run_game')}>▶ 运行验证</button>
      </div>
      {game.debugReport && (
        <div className="debug-report">
          <h5>最近报告 · {new Date(game.debugReport.at || 0).toLocaleString()}</h5>
          <ul className="diag-list">
            {(game.debugReport.diagnostics || []).map((d, i) => (
              <li key={i} className={`diag diag-${d.level}`}>
                <b>[{d.level}] {d.field || `第${d.line || 0}行`}</b>：{d.message}
              </li>
            ))}
          </ul>
          {game.debugReport.autoFixed && <p className="diag-fixed">已自动修复 ✓</p>}
        </div>
      )}
      {runResult && (
        <div className={`run-result ${runResult.status}`}>
          <h5>运行报告 · {runResult.durationMs}ms</h5>
          <ul className="logs">{runResult.logs?.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {runResult.issues?.length > 0 && <p className="issues">告警：{runResult.issues.join('；')}</p>}
        </div>
      )}
    </div>
  );
}

// ---------- Helper components ----------

function Slider({ label, value, min, max, step, onChange }) {
  const v = Number(value ?? 0);
  return (
    <div className="slider-row">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(Number(e.target.value))} />
      <input type="number" className="slider-input" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
