import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

/**
 * SessionHistory - browsable list of past Agent conversations.
 * Renders a collapsible panel inside the ChatPanel header area.
 * Each entry shows a preview of the last user message, message count,
 * tool intents used, and a relative timestamp. Clicking loads the
 * session so the user can continue a prior conversation.
 */
export default function SessionHistory({ currentSessionId, onLoadSession, onDeleteSession }) {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, currentSessionId]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await api.deleteSession(id);
      setSessions((s) => s.filter((x) => x.id !== id));
      if (onDeleteSession) onDeleteSession(id);
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小时前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} 天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`session-history ${open ? 'open' : ''}`}>
      <button
        className="session-history-toggle"
        onClick={() => setOpen((v) => !v)}
        title="历史会话"
      >
        <span className="sh-icon">{open ? '◀' : '🕐'}</span>
        <span className="sh-label">{open ? '收起历史' : '历史会话'}</span>
        {sessions.length > 0 && !open && <span className="sh-badge">{sessions.length}</span>}
      </button>

      {open && (
        <div className="session-history-panel warm-panel">
          <div className="session-history-head">
            <span className="sh-title">历史会话</span>
            <button className="sh-refresh" onClick={refresh} title="刷新">
              {loading ? '...' : '↻'}
            </button>
          </div>
          <div className="session-history-list">
            {sessions.length === 0 && !loading && (
              <div className="sh-empty">暂无历史会话</div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
                onClick={() => onLoadSession && onLoadSession(s.id)}
              >
                <div className="session-item-main">
                  <div className="session-preview">
                    {s.lastUserPreview || '(空会话)'}
                  </div>
                  <div className="session-meta">
                    <span className="session-time">{formatTime(s.updatedAt)}</span>
                    <span className="session-count">{s.messageCount} 条</span>
                    {s.intents?.length > 0 && (
                      <span className="session-intents">{s.intents.slice(0, 3).join(' · ')}</span>
                    )}
                  </div>
                </div>
                <button
                  className="session-delete"
                  onClick={(e) => handleDelete(e, s.id)}
                  title="删除会话"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
