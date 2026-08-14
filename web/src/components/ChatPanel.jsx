import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api.js';

export default function ChatPanel({ sessionId, onSessionChange, onGamesChanged }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.chat(text, sessionId);
      if (!sessionId && res.sessionId) onSessionChange(res.sessionId);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
      // Agent 若操作了游戏（创建/编辑/运行），通知侧栏刷新列表
      if (onGamesChanged && res.intent?.name && res.intent.name !== 'chat') {
        onGamesChanged();
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-panel">
      <header className="panel-header">
        <h2>Agent 对话</h2>
        <span className="panel-hint">创建 · 编辑 · 调试 · 配置</span>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-mark">◆</div>
            <p>告诉 GenPlay Agent 你想创作什么</p>
            <p className="chat-empty-sub">例如：创建一个叫「星空冒险」的射击游戏</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-bubble">{m.content}</div>
          </div>
        ))}
        {loading && <div className="msg assistant"><div className="msg-bubble typing">思考中…</div></div>}
      </div>

      <div className="chat-input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="输入你的游戏创作需求…"
          rows={2}
        />
        <button className="btn-primary" onClick={send} disabled={loading}>
          {loading ? '…' : '发送'}
        </button>
      </div>
    </div>
  );
}
