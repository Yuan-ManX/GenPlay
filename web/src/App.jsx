import { useState, useEffect } from 'react';
import { api } from './services/api.js';
import events from './services/events.js';
import Sidebar from './components/Sidebar.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import StudioPanel from './components/StudioPanel.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import PlayShare from './components/PlayShare.jsx';
import './styles/global.css';

// Parse "#/play/gp_xxx" share links into a share code.
function readShareRoute() {
  const m = (window.location.hash || '').match(/^#\/play\/(gp_[a-z0-9]+)/i);
  return m ? m[1] : null;
}

export default function App() {
  const [layout, setLayout] = useState('split'); // 'chat' | 'studio' | 'split'
  const [sessionId, setSessionId] = useState(null);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [games, setGames] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shareCode, setShareCode] = useState(readShareRoute);

  // Hash routing: share links render the standalone play page instead of
  // the studio; clearing the hash returns to the studio without a reload.
  useEffect(() => {
    const onHash = () => setShareCode(readShareRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const exitShare = () => {
    window.location.hash = '';
    setShareCode(null);
  };

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

  // Global command palette: Cmd+K (macOS) / Ctrl+K (others).
  // Keyboard shortcuts: Ctrl+Enter to run game, Ctrl+S to save,
  // Ctrl+Z to undo, Ctrl+Y or Ctrl+Shift+Z to redo.
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      // Ctrl+Enter: trigger run game via events bus.
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        events.emit('studio:open-tab', { tab: 'preview' });
      }
      // Ctrl+S: save current game (prevent browser save dialog).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        events.emit('studio:save-game');
      }
      // Ctrl+Z: undo last action (skip when focus is in an input/textarea
      // so the browser's native text undo still works for text editing).
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        events.emit('chat:trigger-undo');
      }
      // Ctrl+Y or Ctrl+Shift+Z: redo.
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        events.emit('chat:trigger-redo');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app">
      {shareCode ? (
        <PlayShare shareCode={shareCode} onExit={exitShare} />
      ) : (
        <>
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
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            selectedGameId={selectedGameId}
            sessionId={sessionId}
          />
        </>
      )}
    </div>
  );
}
