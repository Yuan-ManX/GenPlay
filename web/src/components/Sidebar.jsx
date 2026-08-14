export default function Sidebar({ activeTab, onTabChange, games, selectedGameId, onSelectGame, onRefreshGames }) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <span className="brand-mark">◆</span>
        <span className="brand-name">GenPlay</span>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => onTabChange('studio')}
        >
          <span className="tab-ic">🎮</span> 创作工坊
        </button>
        <button
          className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => onTabChange('chat')}
        >
          <span className="tab-ic">💬</span> Agent 对话
        </button>
      </nav>

      <div className="game-list-head">
        <span>我的游戏</span>
        <button className="refresh-btn" onClick={onRefreshGames} title="刷新">⟳</button>
      </div>

      <div className="game-list">
        {games.length === 0 && <p className="empty-hint">暂无游戏，去创作一个吧</p>}
        {games.map((g) => (
          <button
            key={g.id}
            className={`game-item ${selectedGameId === g.id ? 'active' : ''}`}
            onClick={() => onSelectGame(g.id)}
          >
            <span className="game-item-name">{g.name}</span>
            <span className="game-item-meta">{g.genre} · {g.status}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
