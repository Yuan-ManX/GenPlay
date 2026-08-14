import { useState } from 'react';
import { api } from './services/api.js';
import Sidebar from './components/Sidebar.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import StudioPanel from './components/StudioPanel.jsx';
import './styles/global.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('studio'); // 'chat' | 'studio'
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

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        games={games}
        selectedGameId={selectedGameId}
        onSelectGame={(id) => {
          setSelectedGameId(id);
          setActiveTab('studio');
        }}
        onRefreshGames={refreshGames}
      />
      <main className="main">
        {activeTab === 'chat' ? (
          <ChatPanel
            sessionId={sessionId}
            onSessionChange={setSessionId}
            onGamesChanged={refreshGames}
          />
        ) : (
          <StudioPanel
            gameId={selectedGameId}
            onGamesChange={refreshGames}
            onSelectGame={setSelectedGameId}
          />
        )}
      </main>
    </div>
  );
}
