const GENRE_ICONS = {
  shooter: '🚀', adventure: '🗺️', rpg: '⚔️', puzzle: '🧩', battle: '🥊',
  racing: '🏎️', simulation: '🌾', platformer: '🦘', tower: '🏰', snake: '🐍',
  breakout: '🧱', maze: '🔮', rhythm: '🎵',
};

const GENRE_BADGE = {
  shooter: 'g-shooter', adventure: 'g-adventure', rpg: 'g-rpg', puzzle: 'g-puzzle',
  battle: 'g-battle', racing: 'g-racing', simulation: 'g-sim', platformer: 'g-platformer',
  tower: 'g-tower', snake: 'g-snake', breakout: 'g-breakout', maze: 'g-maze', rhythm: 'g-rhythm',
};

const STATUS_COLOR = {
  draft: 'st-draft', published: 'st-published',
};

export default function Sidebar({ layout, onLayoutChange, games, selectedGameId, onSelectGame, onRefreshGames }) {
  const tabs = [
    { key: 'split', label: '双栏', icon: '🪟', desc: '对话+创作' },
    { key: 'chat', label: '对话', icon: '💬', desc: 'Agent 聊天' },
    { key: 'studio', label: '创作', icon: '🎮', desc: '工坊编辑' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <span className="brand-mark bounce">◆</span>
        <div className="brand-text">
          <span className="brand-name">GenPlay</span>
          <span className="brand-sub">AI 原生游戏创作</span>
        </div>
      </div>

      <nav className="nav-tabs rainbow-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`nav-tab ${layout === t.key ? 'active' : ''} nav-${t.key}`}
            onClick={() => onLayoutChange(t.key)}
            title={t.desc}
          >
            <span className="tab-ic">{t.icon}</span>
            <span className="tab-text">
              <b>{t.label}</b>
              <small>{t.desc}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="game-list-head">
        <span>我的游戏 · {games.length}</span>
        <button className="refresh-btn spin-on-click" onClick={onRefreshGames} title="刷新">⟳</button>
      </div>

      <div className="game-list">
        {games.length === 0 && (
          <p className="empty-hint fade-in">
            还没有游戏，<br />在对话框中「创建一个…」开始吧。
          </p>
        )}
        {games.map((g) => {
          const icon = GENRE_ICONS[g.genre] || '🎮';
          const badge = GENRE_BADGE[g.genre] || '';
          const status = STATUS_COLOR[g.status] || 'st-draft';
          return (
            <button
              key={g.id}
              className={`game-card ${selectedGameId === g.id ? 'active' : ''} ${badge}`}
              onClick={() => onSelectGame(g.id)}
            >
              <div className={`game-card-thumb status-${status}`}>
                <span className="thumb-ic">{icon}</span>
                <span className={`thumb-status ${status}`}>
                  {g.status === 'published' ? '已发布' : '草稿'}
                </span>
              </div>
              <div className="game-card-body">
                <div className="game-card-name" title={g.name}>{g.name}</div>
                <div className="game-card-meta">
                  <span className={`genre-badge ${badge}`}>{labelFor(g.genre)}</span>
                  <span className="run-count">▶ {g.runCount || 0}</span>
                </div>
                {g.scenario?.title && (
                  <div className="game-card-scenario">📖 {g.scenario.title}</div>
                )}
                {g.theme?.name && (
                  <div className="game-card-theme">🎨 {g.theme.name}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sidebar-foot">
        <span className="dot live" />
        <span>Agent 已就绪</span>
      </div>
    </aside>
  );
}

function labelFor(genre) {
  return ({
    shooter: '射击', adventure: '冒险', rpg: 'RPG', puzzle: '解谜',
    battle: '对战', racing: '赛车', simulation: '模拟', platformer: '平台',
    tower: '塔防', snake: '贪吃蛇', breakout: '打砖块', maze: '迷宫', rhythm: '节奏',
  })[genre] || genre || '未知';
}
