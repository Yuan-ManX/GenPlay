import { useState, useEffect } from 'react';
import { api } from './services/api.js';
import events from './services/events.js';
import Sidebar from './components/Sidebar.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import StudioPanel from './components/StudioPanel.jsx';
import './styles/global.css';

export default function App() {
  const [layout, setLayout] = useState('split'); // 'chat' | 'studio' | 'split'
  const [sessionId, setSessionId] = useState(null);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [games, setGames] = useState([]);

  const refreshGames = async () => {
    try {
      const data = await api.listGames();
      setGames(data.games || []);
    } catch (err) {
      console.error('加载游戏失败', err);
    }
  };

  useEffect(() => {
    refreshGames();
  }, []);

  // Cross-component side-effects: Agent -> Sidebar/Studio live sync
  useEffect(() => {
    const offs = [];
    offs.push(events.on('sidebar:refresh-list', () => refreshGames()));
    offs.push(events.on('studio:select-game', ({ gameId }) => {
      if (!gameId) return;
      setSelectedGameId(gameId);
      setLayout((l) => (l === 'chat' ? 'split' : l));
      refreshGames();
    }));
    offs.push(events.on('studio:refresh-game', ({ gameId }) => {
      if (gameId) setSelectedGameId(gameId);
      refreshGames();
    }));
    return () => offs.forEach((f) => f && f());
  }, []);

  return (
    <div className="app">
      <Sidebar
        layout={layout}
        onLayoutChange={setLayout}
        games={games}
        selectedGameId={selectedGameId}
        onSelectGame={(id) => {
          setSelectedGameId(id);
          setLayout((l) => (l === 'chat' ? 'split' : l));
        }}
        onRefreshGames={refreshGames}
      />
      <main className={`main layout-${layout}`}>
        {(layout === 'chat' || layout === 'split') && (
          <section className="col col-chat warm">
            <ChatPanel
              sessionId={sessionId}
              onSessionChange={setSessionId}
              onGamesChanged={refreshGames}
              selectedGameId={selectedGameId}
              onSelectGame={setSelectedGameId}
            />
          </section>
        )}
        {(layout === 'studio' || layout === 'split') && (
          <section className="col col-studio cool">
            <StudioPanel
              gameId={selectedGameId}
              onGamesChange={refreshGames}
              onSelectGame={setSelectedGameId}
              sessionId={sessionId}
            />
          </section>
        )}
      </main>
    </div>
  );
}
