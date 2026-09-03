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
  { key: 'roguelike', label: '🃏 Roguelike' },
  { key: 'deckbuilder', label: '🎴 卡牌构筑' },
  { key: 'metroidvania', label: '🗺️ 银河恶魔城' },
  { key: 'idle', label: '⏱️ 放置挂机' },
  { key: 'sandbox', label: '🏖️ 沙盒模拟' },
  { key: 'visual_novel', label: '📖 视觉小说' },
  { key: 'auto_battler', label: '🤖 自动对战' },
];

const THEME_OPTIONS = [
  { key: 'retro_pixel', label: '像素复古' },
  { key: 'cyberpunk', label: '赛博朋克' },
  { key: 'sakura', label: '樱花物语' },
  { key: 'arcade', label: '黄金街机' },
  { key: 'sunset', label: '日落狂想' },
  { key: 'ocean', label: '深海秘境' },
  { key: 'forest', label: '绿林深处' },
  { key: 'neon_night', label: '霓虹夜幕' },
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
  { key: 'ancient', label: '古域·秘境遗迹' },
];

const TABS = [
  { key: 'basic', label: '基础', icon: '📋' },
  { key: 'config', label: '配置', icon: '⚙️' },
  { key: 'scripts', label: '脚本', icon: '💻' },
  { key: 'tweak', label: '调参', icon: '🎚️' },
  { key: 'nodes', label: '节点', icon: '🔗' },
  { key: 'assets', label: '资产', icon: '🎨' },
  { key: 'theme', label: '主题', icon: '🎨' },
  { key: 'scenario', label: '剧情', icon: '📖' },
  { key: 'meta', label: '元设置', icon: '🛸' },
  { key: 'explore', label: '社区', icon: '🌐' },
  { key: 'code', label: '源码', icon: '🧾' },
  { key: 'debug', label: '调试', icon: '🛠️' },
];

const NODE_PALETTE = [
  { type: 'event', category: 'event', name: '游戏开始', desc: 'on start' },
  { type: 'event', category: 'event', name: '按键输入', desc: 'on input' },
  { type: 'event', category: 'event', name: '碰撞检测', desc: 'on hit' },
  { type: 'event', category: 'event', name: '计时器', desc: 'on timer' },
  { type: 'condition', category: 'condition', name: '大于比较', desc: 'if a > b' },
  { type: 'condition', category: 'condition', name: '等于判断', desc: 'if a == b' },
  { type: 'condition', category: 'condition', name: '概率检测', desc: 'if random < p' },
  { type: 'action', category: 'action', name: '移动实体', desc: 'move target' },
  { type: 'action', category: 'action', name: '生成实体', desc: 'spawn entity' },
  { type: 'action', category: 'action', name: '销毁实体', desc: 'despawn target' },
  { type: 'action', category: 'action', name: '加分得分', desc: 'score +n' },
  { type: 'action', category: 'action', name: '游戏结束', desc: 'gameover' },
];

const ASSET_TYPES = [
  { key: 'sprite', label: '🎨 精灵图' },
  { key: 'sound', label: '🔊 音效' },
  { key: 'music', label: '🎵 背景音乐' },
  { key: 'ui', label: '🖼️ UI界面' },
];

const DEFAULT_COMMUNITY_GAMES = [
  { id: 'c1', name: '像素勇者传', author: 'GenPlay官方', genre: 'rpg', icon: '⚔️', plays: 12430, likes: 890, badge: '精选' },
  { id: 'c2', name: '星际突围', author: 'RocketLab', genre: 'shooter', icon: '🚀', plays: 9822, likes: 654, badge: '热门' },
  { id: 'c3', name: '迷雾森林', author: 'PixelMage', genre: 'adventure', icon: '🌲', plays: 7451, likes: 512, badge: '新作' },
  { id: 'c4', name: '霓虹漂移', author: 'CyberArtist', genre: 'racing', icon: '🏎️', plays: 6890, likes: 478, badge: '热门' },
  { id: 'c5', name: '梦境拼图', author: 'PuzzleKing', genre: 'puzzle', icon: '🧩', plays: 5320, likes: 401, badge: '' },
  { id: 'c6', name: '机甲军团', author: 'MechaDev', genre: 'auto_battler', icon: '🤖', plays: 4210, likes: 310, badge: '精选' },
  { id: 'c7', name: '深渊回响', author: 'DungeonCrafter', genre: 'roguelike', icon: '🃏', plays: 8930, likes: 612, badge: '热门' },
  { id: 'c8', name: '卡牌炼金术', author: 'CardSmith', genre: 'deckbuilder', icon: '🎴', plays: 6540, likes: 489, badge: '新作' },
  { id: 'c9', name: '星海遗迹', author: 'ExplorerDev', genre: 'metroidvania', icon: '🗺️', plays: 5210, likes: 367, badge: '' },
  { id: 'c10', name: '余烬工坊', author: 'IdleMaster', genre: 'idle', icon: '⏱️', plays: 7820, likes: 545, badge: '精选' },
  { id: 'c11', name: '创世方块', author: 'BuilderX', genre: 'sandbox', icon: '🏖️', plays: 11200, likes: 780, badge: '热门' },
  { id: 'c12', name: '樱花之约', author: 'StoryWeaver', genre: 'visual_novel', icon: '📖', plays: 4320, likes: 398, badge: '新作' },
  { id: 'c13', name: '塔楼守卫', author: 'TowerGuard', genre: 'tower', icon: '🏰', plays: 6700, likes: 455, badge: '' },
  { id: 'c14', name: '节奏脉冲', author: 'BeatDropper', genre: 'rhythm', icon: '🎵', plays: 5980, likes: 422, badge: '精选' },
];

export default function StudioPanel({ gameId, onGamesChange, onSelectGame, sessionId }) {
  const [form, setForm] = useState({ name: '', genre: 'adventure', description: '' });
  const [game, setGame] = useState(null);
  const [tab, setTab] = useState('basic');
  const [runResult, setRunResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [codeView, setCodeView] = useState({ sections: null, section: 'all' });
  const [exploreFilter, setExploreFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, published: 0, runs: 0, genres: 0 });

  useEffect(() => { if (gameId) loadGame(gameId); }, [gameId]);

  // Load overall stats for dashboard
  useEffect(() => {
    (async () => {
      try {
        const data = await api.listGames();
        const games = data.games || [];
        setStats({
          total: games.length,
          published: games.filter((g) => g.status === 'published').length,
          runs: games.reduce((s, g) => s + (g.runCount || 0), 0),
          genres: new Set(games.map((g) => g.genre)).size,
        });
      } catch (e) { /* noop */ }
    })();
  }, [gameId]);

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
    offs.push(events.on('studio:set-meta', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, meta: payload }) : g);
      setTab('meta');
      flash('游戏元设置已更新');
    }));
    offs.push(events.on('studio:add-asset', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, assets: [...(g.assets || []), payload] }) : g);
      setTab('assets');
      flash(`已添加资产：${payload.name}`);
    }));
    offs.push(events.on('studio:add-npc', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, npcs: [...(g.npcs || []), payload] }) : g);
      setTab('assets');
      flash(`角色「${payload.name}」加入游戏`);
    }));
    offs.push(events.on('studio:update-nodes', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, nodeGraph: payload }) : g);
      setTab('nodes');
      flash('节点图已更新');
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
        theme: game.theme, scenario: game.scenario,
        meta: game.meta, assets: game.assets, npcs: game.npcs, nodeGraph: game.nodeGraph,
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
      flash(`发布成功！`);
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

      {/* Dashboard hero - only show when no game is selected */}
      {!game && (
        <section className="dashboard-hero">
          <span className="hero-badge">✨ AI 原生创作平台</span>
          <h1>自然语言驱动，创意即刻生成</h1>
          <p className="hero-sub">
            GenPlay 融合全能 Agent 智能体，一句话即可完成从创意构思、关卡生成、角色设计、数值平衡到发布上线的全流程。
            13 类经典 + 7 类创新玩法引擎，实时预览、一键调试。
          </p>
          <div className="hero-actions">
            <button className="btn-primary pulse-on-hover" onClick={() => {
              document.querySelector('.create-row input')?.focus();
            }}>✨ 从零创建游戏</button>
            <button className="btn-ghost" onClick={() => setTab('explore')}>🌐 探索社区作品</button>
            <button className="btn-ghost" onClick={() => runEditorAction('creative_ideate') || flash('请先选择游戏或在左侧对话')}>
              💡 生成创意
            </button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-num">{stats.total}</div>
              <div className="hero-stat-label">游戏总数</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">{stats.published}</div>
              <div className="hero-stat-label">已发布</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">{stats.runs}</div>
              <div className="hero-stat-label">累计运行</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">{stats.genres}</div>
              <div className="hero-stat-label">玩法引擎</div>
            </div>
          </div>
        </section>
      )}

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
        <>
          {tab === 'explore' ? (
            <section style={{ margin: '0 28px 28px' }}>
              <TabExplore
                exploreFilter={exploreFilter}
                setExploreFilter={setExploreFilter}
                onPick={(g) => alert(`打开社区作品: ${g.name}\n(示例社区展示，正式发布后可直接导入或试玩)`)}
              />
            </section>
          ) : (
            <div className="edit-empty">
              <div className="empty-emoji bounce">🎮</div>
              <p>从左侧选择游戏，或在上方创建一个新游戏开始创作。</p>
              <p className="edit-empty-sub">所有编辑器操作也可以在左侧 Agent 中用自然语言控制。</p>
              <div className="quick-prompts" style={{ marginTop: 24 }}>
                <button className="chip" onClick={() => setTab('explore')}>🌐 浏览社区作品</button>
              </div>
            </div>
          )}
        </>
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
              {tab === 'nodes' && <TabNodes game={game} setGame={setGame} runEditorAction={runEditorAction} />}
              {tab === 'assets' && <TabAssets game={game} setGame={setGame} runEditorAction={runEditorAction} />}
              {tab === 'theme' && <TabTheme game={game} runEditorAction={runEditorAction} />}
              {tab === 'scenario' && <TabScenario game={game} runEditorAction={runEditorAction} />}
              {tab === 'meta' && <TabMeta game={game} setGame={setGame} runEditorAction={runEditorAction} />}
              {tab === 'explore' && <TabExplore exploreFilter={exploreFilter} setExploreFilter={setExploreFilter} onPick={(g) => flash(`社区作品: ${g.name}`)} />}
              {tab === 'code' && <TabCodeView game={game} codeView={codeView} runEditorAction={runEditorAction} />}
              {tab === 'debug' && <TabDebug game={game} runResult={runResult} runEditorAction={runEditorAction} />}
            </div>
          </div>

          <div className="preview-col">
            <div className="preview-col-head">
              <h4>🎯 实时预览</h4>
              <span className="preview-col-hint">
                键盘 · WASD / 方向键 / 空格 交互
              </span>
            </div>
            <GamePreview game={game} />
            {runResult && (
              <div className={`run-result ${runResult.status === 'ok' ? 'ok' : (runResult.issues?.length ? 'warn' : '')}`}>
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
          <li>资产数量：<b>{(game.assets || []).length}</b></li>
          <li>角色数量：<b>{(game.npcs || []).length}</b></li>
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
        <button className="btn-ghost" style={{ marginLeft: 10 }} onClick={() => runEditorAction('rapid_iterate', { focus: 'balance' })}>
          ⚡ 快速迭代平衡
        </button>
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
      <div className="tweak-group">
        <h5>💡 让 Agent 生成定制主题</h5>
        <button className="btn-ghost" onClick={() => runEditorAction('search_asset_library', { category: 'theme' })}>
          📚 从资产库安装主题
        </button>
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
    meta: game.meta, assets: game.assets, npcs: game.npcs,
  };
  return (
    <div className="tab-fields">
      <div className="code-tabs">
        {['all', 'config', 'scripts', 'theme', 'scenario', 'meta', 'assets', 'npcs'].map((s) => (
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
        <button className="btn-ghost" onClick={() => runEditorAction('rapid_iterate', { focus: 'quality' })}>
          ⚡ 质量自检
        </button>
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

// ---- New panels: Nodes, Assets, Meta, Explore ----

function TabNodes({ game, setGame, runEditorAction }) {
  const graph = game.nodeGraph || { nodes: [], edges: [] };
  const [nodes, setNodes] = useState(graph.nodes || []);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setNodes(graph.nodes || []);
  }, [game.nodeGraph]);

  const addNode = (palette) => {
    const newNode = {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: palette.type, category: palette.category,
      name: palette.name, desc: palette.desc,
      x: 40 + (nodes.length % 4) * 210, y: 40 + Math.floor(nodes.length / 4) * 130,
      data: {},
    };
    setNodes([...nodes, newNode]);
    setSelected(newNode.id);
  };

  const removeNode = (id) => {
    setNodes(nodes.filter((n) => n.id !== id));
    if (selected === id) setSelected(null);
  };

  const saveToGame = () => {
    const newGraph = { nodes, edges: graph.edges || [] };
    setGame({ ...game, nodeGraph: newGraph });
    runEditorAction('edit_node_graph', {
      action: 'import_graph',
      graph: newGraph,
    });
  };

  return (
    <div className="node-editor tab-fields">
      <div className="node-toolbar">
        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>🔗 可视化节点脚本</span>
        <div className="node-toolbar-group">
          <button className="btn-ghost btn-sm" onClick={() => runEditorAction('edit_node_graph', { action: 'dsl_to_graph', dsl: game.scripts || '' })}>
            📥 从 DSL 导入
          </button>
          <button className="btn-ghost btn-sm" onClick={() => runEditorAction('edit_node_graph', { action: 'export_dsl' })}>
            📤 导出为 DSL
          </button>
          <button className="btn-primary btn-sm" onClick={saveToGame}>💾 保存节点图</button>
        </div>
      </div>
      <div className="node-palette">
        {NODE_PALETTE.map((p, i) => (
          <button key={i} className="node-palette-btn" onClick={() => addNode(p)}>
            <span className="np-ic">
              {p.category === 'event' ? '⚡' : p.category === 'condition' ? '❓' : '🎯'}
            </span>
            {p.name}
            <small style={{ display: 'block', color: 'var(--text-faint)', fontSize: '0.65rem' }}>{p.desc}</small>
          </button>
        ))}
      </div>
      <div className="node-canvas">
        <div className="node-graph" style={{ height: `${Math.max(280, Math.ceil(nodes.length / 4) * 130 + 120)}px` }}>
          {nodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
              从上方调色板拖拽（或点击）添加节点，连接事件 → 条件 → 动作构建游戏逻辑
            </div>
          )}
          {nodes.map((n) => (
            <div key={n.id}
              className={`node-block ${n.type} ${selected === n.id ? 'selected' : ''}`}
              style={{ left: n.x, top: n.y }}
              onClick={() => setSelected(n.id)}>
              <div className="node-head">
                <span>{n.name}</span>
                <span className="nh-type">{n.category}</span>
              </div>
              <div className="node-body">
                <div className="nv-row"><span>触发</span><b>{n.desc}</b></div>
              </div>
              <div className="node-foot">
                {n.category !== 'event' && <span className="node-port in" title="输入" />}
                <span>&nbsp;</span>
                {n.category !== 'action' && <span className="node-port out" title="输出" />}
                <button className="node-del" onClick={(e) => { e.stopPropagation(); removeNode(n.id); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabAssets({ game, setGame, runEditorAction }) {
  const [assetType, setAssetType] = useState('sprite');
  const [assetName, setAssetName] = useState('');
  const [assetDesc, setAssetDesc] = useState('');
  const assets = game.assets || [];
  const npcs = game.npcs || [];

  const genAsset = () => {
    if (!assetName.trim()) return;
    runEditorAction('generate_asset', {
      assetType, name: assetName, description: assetDesc || assetName,
    });
    setAssetName(''); setAssetDesc('');
  };

  const genNpc = () => {
    runEditorAction('generate_npc', { count: 2 });
  };

  const browseAssets = () => {
    runEditorAction('search_asset_library', { category: assetType, query: assetDesc });
  };

  return (
    <div className="asset-panel tab-fields">
      <h4 className="tab-h">🎨 资产与角色</h4>

      <div className="asset-form">
        <div className="field">
          <label>类型</label>
          <select value={assetType} onChange={(e) => setAssetType(e.target.value)}>
            {ASSET_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>名称</label>
          <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="如：激光炮、胜利曲、金币音效" />
        </div>
        <div className="field field-full">
          <label>描述 / 参考</label>
          <input value={assetDesc} onChange={(e) => setAssetDesc(e.target.value)} placeholder="详细描述外观、风格、用途…" />
        </div>
        <div className="field field-full" style={{ flexDirection: 'row', gap: 8 }}>
          <button className="btn-primary" onClick={genAsset}>➕ 生成资产</button>
          <button className="btn-ghost" onClick={browseAssets}>📚 资产库搜索</button>
          <button className="btn-ghost" onClick={genNpc}>🎭 设计 2 个 NPC</button>
        </div>
      </div>

      <div>
        <h5 style={{ fontSize: '0.9rem', marginBottom: 10 }}>🧩 游戏资产 ({assets.length})</h5>
        <div className="asset-list">
          {assets.length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: 'var(--text-faint)', fontSize: '0.82rem', padding: 18, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              暂无资产。使用上方表单或让 Agent 在对话中生成资产 →
            </div>
          )}
          {assets.map((a, i) => (
            <div key={i} className="asset-card">
              <span className={`asset-type-tag at-${a.type || 'sprite'}`}>
                {ASSET_TYPES.find((t) => t.key === a.type)?.label || a.type}
              </span>
              <h5>{a.name}</h5>
              <p>{a.description || a.spec || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 style={{ fontSize: '0.9rem', marginBottom: 10 }}>🎭 角色 NPC ({npcs.length})</h5>
        <div className="npc-list">
          {npcs.length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: 'var(--text-faint)', fontSize: '0.82rem', padding: 18, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              暂无角色。点击「设计 2 个 NPC」或在对话中描述角色特征 →
            </div>
          )}
          {npcs.map((n, i) => (
            <div key={i} className="npc-card">
              <div className="npc-card-head">
                <span className="npc-avatar">{n.avatar || '🧝'}</span>
                <div>
                  <h5>{n.name}</h5>
                  <span className="npc-role">{n.role || '角色'}</span>
                </div>
              </div>
              <div className="npc-personality">
                {(n.traits || n.personality || []).slice(0, 4).map((t, j) => (
                  <span key={j} className="npc-trait">{t}</span>
                ))}
              </div>
              <p className="npc-desc">{n.description || n.backstory || '—'}</p>
              {n.quote && <div className="npc-quote">“{n.quote}”</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabMeta({ game, setGame, runEditorAction }) {
  const meta = game.meta || {};
  const setMeta = (patch) => {
    const next = { ...meta, ...patch };
    setGame({ ...game, meta: next });
    // Also sync via agent tool if multiplayer/monetization key changed
    if (patch.multiplayer !== undefined || patch.monetization !== undefined) {
      runEditorAction('configure_game_meta', next);
    }
  };

  const achievements = meta.achievements || [
    { id: 1, name: '初次胜利', desc: '完成第一局游戏', unlocked: false, icon: '🏆' },
    { id: 2, name: '高分猎手', desc: '单局得分超过 1000', unlocked: false, icon: '🎯' },
    { id: 3, name: '完美通关', desc: '不损失一命通过', unlocked: false, icon: '⭐' },
  ];

  return (
    <div className="tab-fields">
      <h4 className="tab-h">🛸 游戏元设置</h4>

      <div className="meta-section">
        <h5>🌐 多人与协作</h5>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">启用多人对战</span>
            <span className="toggle-hint">最多支持 4 人联机（P2P / 房间）</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.multiplayer?.enabled}
              onChange={(e) => setMeta({ multiplayer: { ...(meta.multiplayer || {}), enabled: e.target.checked } })} />
            <span className="slider-switch" />
          </label>
        </div>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">排行榜</span>
            <span className="toggle-hint">社区全球分数榜单</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.leaderboard}
              onChange={(e) => setMeta({ leaderboard: e.target.checked })} />
            <span className="slider-switch" />
          </label>
        </div>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">观战模式</span>
            <span className="toggle-hint">允许其他玩家观看当前对局</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.spectator}
              onChange={(e) => setMeta({ spectator: e.target.checked })} />
            <span className="slider-switch" />
          </label>
        </div>
      </div>

      <div className="meta-section">
        <h5>💰 商业化配置</h5>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">内置奖励广告</span>
            <span className="toggle-hint">复活、加倍奖励等场景激励</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.monetization?.ads}
              onChange={(e) => setMeta({ monetization: { ...(meta.monetization || {}), ads: e.target.checked } })} />
            <span className="slider-switch" />
          </label>
        </div>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">内购皮肤/道具</span>
            <span className="toggle-hint">商店售卖装饰物与体验道具</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.monetization?.iap}
              onChange={(e) => setMeta({ monetization: { ...(meta.monetization || {}), iap: e.target.checked } })} />
            <span className="slider-switch" />
          </label>
        </div>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">云存档同步</span>
            <span className="toggle-hint">跨设备进度保存</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.cloudSave !== false}
              onChange={(e) => setMeta({ cloudSave: e.target.checked })} />
            <span className="slider-switch" />
          </label>
        </div>
      </div>

      <div className="meta-section">
        <h5>♿ 无障碍与品质</h5>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">色盲模式配色</span>
            <span className="toggle-hint">自动替换对比度颜色</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.accessibility?.colorBlind}
              onChange={(e) => setMeta({ accessibility: { ...(meta.accessibility || {}), colorBlind: e.target.checked } })} />
            <span className="slider-switch" />
          </label>
        </div>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">字幕与对话气泡</span>
            <span className="toggle-hint">对白完全可阅读</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.accessibility?.subtitles !== false}
              onChange={(e) => setMeta({ accessibility: { ...(meta.accessibility || {}), subtitles: e.target.checked } })} />
            <span className="slider-switch" />
          </label>
        </div>
        <div className="toggle-row">
          <div className="toggle-info">
            <span className="toggle-label">难度自适应</span>
            <span className="toggle-hint">根据玩家水平动态调整数值</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={!!meta.dynamicDifficulty}
              onChange={(e) => setMeta({ dynamicDifficulty: e.target.checked })} />
            <span className="slider-switch" />
          </label>
        </div>
      </div>

      <div className="meta-section">
        <h5>🏆 成就系统</h5>
        <div className="achievement-list">
          {achievements.map((a) => (
            <div key={a.id} className="achievement-item">
              <span className="achievement-ic">{a.icon}</span>
              <div className="achievement-body">
                <div className="achievement-name">{a.name}</div>
                <div className="achievement-desc">{a.desc}</div>
              </div>
              <span className="achievement-unlock">{a.unlocked ? '已解锁' : '未解锁'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tweak-group" style={{ marginTop: 0 }}>
        <button className="btn-primary" onClick={() => runEditorAction('configure_game_meta', meta)}>
          💾 通过 Agent 同步至后端
        </button>
      </div>
    </div>
  );
}

function TabExplore({ exploreFilter, setExploreFilter, onPick }) {
  const games = DEFAULT_COMMUNITY_GAMES.filter((g) => exploreFilter === 'all' || g.genre === exploreFilter);
  const tags = [
    { key: 'all', label: '全部' },
    ...GENRE_OPTIONS.map((g) => ({ key: g.key, label: g.label })),
  ];
  return (
    <div className="tab-fields">
      <h4 className="tab-h">🌐 社区探索</h4>
      <div className="explore-tabs">
        {tags.map((t) => (
          <button key={t.key} className={`btn-ghost btn-sm ${exploreFilter === t.key ? 'active' : ''}`}
            onClick={() => setExploreFilter(t.key)}
            style={exploreFilter === t.key ? { background: 'var(--grad-cool)', color: '#fff', borderColor: 'transparent' } : {}}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="explore-grid">
        {games.map((g) => (
          <div key={g.id} className="explore-card" onClick={() => onPick(g)}>
            <div className="explore-cover">
              <span>{g.icon}</span>
              {g.badge && <span className="explore-cover-badge">{g.badge}</span>}
            </div>
            <div className="explore-body">
              <div className="explore-title">{g.name}</div>
              <div className="explore-author">@{g.author}</div>
              <div className="explore-stats">
                <span>▶ {g.plays.toLocaleString()}</span>
                <span>❤ {g.likes}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {GENRE_OPTIONS.find((o) => o.key === g.genre)?.label || g.genre}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
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
