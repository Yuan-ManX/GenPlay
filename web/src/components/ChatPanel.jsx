import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import events from '../services/events.js';
import SessionHistory from './SessionHistory.jsx';

// Follow-up suggestions based on last tool triggered
const SUGGESTION_MAP = {
  create_game: [
    { label: '🎨 赛博朋克风格', message: '应用赛博朋克主题' },
    { label: '📝 太空剧情', message: '添加太空站关卡剧情' },
    { label: '🗺️ 生成关卡', message: '生成3个程序化关卡' },
    { label: '🚀 直接发布', message: '发布上线' },
  ],
  edit_game: [
    { label: '👀 代码变更', message: '查看代码脚本' },
    { label: '🏃 试玩改动', message: '运行游戏' },
    { label: '🎨 樱花主题', message: '应用樱花主题' },
  ],
  tweak_params: [
    { label: '🏃 试玩数值', message: '运行游戏' },
    { label: '🔁 地狱难度', message: '难度调高到地狱' },
    { label: '⚡ 一键优化', message: '快速迭代优化平衡性' },
  ],
  apply_style_theme: [
    { label: '🏃 试玩效果', message: '运行游戏' },
    { label: '📖 加剧情', message: '应用剧情场景' },
    { label: '🎭 角色设计', message: '设计3个NPC角色' },
  ],
  apply_scenario: [
    { label: '🎨 配主题', message: '应用赛博朋克主题' },
    { label: '🏃 运行', message: '运行游戏' },
    { label: '🎵 配乐资产', message: '生成背景音乐和音效资产' },
  ],
  debug_with_diffs: [
    { label: '🏃 验证修复', message: '运行游戏' },
    { label: '📖 看差异', message: '查看代码脚本' },
  ],
  debug_game: [
    { label: '🛠️ 深度修复', message: '深度调试并自动修复' },
    { label: '🏃 再跑一次', message: '运行游戏' },
  ],
  run_game: [
    { label: '📝 调速度', message: '把玩家速度调到 5.5' },
    { label: '🎨 街机主题', message: '应用街机主题' },
    { label: '⚡ 快速迭代', message: '一键快速迭代优化' },
    { label: '🚀 发布上线', message: '发布上线' },
  ],
  view_code: [
    { label: '🛠️ 检查问题', message: '深度调试游戏' },
    { label: '🎨 深海主题', message: '应用深海主题' },
  ],
  creative_ideate: [
    { label: '🎮 立即创建', message: '创建这个游戏创意' },
    { label: '💡 更多创意', message: '给我3个混搭游戏创意' },
  ],
  procedural_level: [
    { label: '🏃 试玩关卡', message: '运行游戏' },
    { label: '🔁 更多关卡', message: '再生成5个关卡' },
  ],
  generate_asset: [
    { label: '🎵 生成音效', message: '生成音效资产' },
    { label: '🏃 试玩效果', message: '运行游戏' },
  ],
  generate_npc: [
    { label: '💬 继续对话', message: '运行游戏查看NPC对白' },
    { label: '➕ 更多角色', message: '再设计3个NPC' },
  ],
  configure_game_meta: [
    { label: '🏃 验证设置', message: '运行游戏' },
    { label: '🚀 发布', message: '发布上线' },
  ],
  rapid_iterate: [
    { label: '🏃 试玩新版', message: '运行游戏' },
    { label: '🎯 再优化', message: '继续快速迭代优化' },
  ],
  search_asset_library: [
    { label: '📥 安装主题', message: '从资产库安装赛博朋克主题' },
    { label: '🔍 搜索更多', message: '搜索关卡预设资产' },
  ],
  edit_node_graph: [
    { label: '🏃 验证逻辑', message: '运行游戏' },
    { label: '📖 节点脚本', message: '查看代码脚本' },
  ],
  publish_game: [
    { label: '🎯 新建游戏', message: '创建一个新游戏' },
    { label: '🌐 浏览社区', message: '浏览社区探索页面' },
  ],
  list_games: [
    { label: '🎮 创建新游戏', message: '创建一个射击游戏' },
    { label: '💡 创意灵感', message: '给我5个游戏创意' },
  ],
  describe_game: [
    { label: '🎨 改主题', message: '应用樱花主题' },
    { label: '📖 加剧情', message: '应用魔幻剧情' },
  ],
  generate_config: [
    { label: '🏃 试玩', message: '运行游戏' },
    { label: '🎚️ 调参', message: '调参预设困难' },
  ],
  delete_game: [
    { label: '🎯 新建游戏', message: '创建一个射击游戏' },
    { label: '📋 查看列表', message: '列出所有游戏' },
  ],
  save_game: [
    { label: '🏃 试玩保存', message: '运行游戏' },
    { label: '🚀 准备发布', message: '发布上线' },
  ],
  explore_community: [
    { label: '🚀 复刻热门', message: '创建一个roguelike游戏' },
    { label: '💡 生成灵感', message: '给我5个游戏创意' },
  ],
  install_snippet: [
    { label: '🏃 验证逻辑', message: '运行游戏' },
    { label: '📖 查看脚本', message: '查看代码脚本' },
  ],
  update_basic_info: [
    { label: '🏃 试玩新版本', message: '运行游戏' },
    { label: '🎨 换主题', message: '应用赛博朋克主题' },
  ],
  dispatch_crew: [
    { label: '🚀 落地蓝图', message: '落地这个创作团蓝图' },
    { label: '💡 再来一版', message: '创作团重新构思一个roguelike游戏' },
  ],
  remix_game: [
    { label: '🎨 换主题', message: '应用赛博朋克主题' },
    { label: '⚡ 一键优化', message: '快速迭代优化平衡性' },
    { label: '🏃 试玩复刻', message: '运行游戏' },
  ],
};

// Inspiration prompt gallery for empty state
const INSPIRATIONS = [
  { icon: '🚀', title: '星际远征', hint: '太空射击，生存关卡', prompt: '创建一个叫星际远征的射击游戏' },
  { icon: '🦘', title: '跳跃冒险', hint: '平台跳跃，收集宝箱', prompt: '创建一个叫跳跃冒险的平台跳跃游戏' },
  { icon: '⚔️', title: '黎明之剑', hint: 'RPG回合制，剧情驱动', prompt: '创建一个叫黎明之剑的RPG回合制游戏' },
  { icon: '🧩', title: '星辰谜境', hint: '解谜挑战，神秘机关', prompt: '创建一个叫星辰谜境的解谜游戏' },
  { icon: '🏎️', title: '霓虹狂飙', hint: '赛车竞速，赛博都市', prompt: '创建一个叫霓虹狂飙的赛车游戏' },
  { icon: '🃏', title: '命运之牌', hint: '卡牌构筑，roguelike', prompt: '创建一个叫命运之牌的roguelike游戏' },
  { icon: '🤖', title: '机甲战线', hint: '自动战斗，编队策略', prompt: '创建一个叫机甲战线的auto_battler游戏' },
  { icon: '🏖️', title: '桃源小镇', hint: '沙盒模拟，自由建造', prompt: '创建一个叫桃源小镇的sandbox游戏' },
];

export default function ChatPanel({ sessionId, onSessionChange, onGamesChanged, selectedGameId, onSelectGame }) {
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamTrace, setStreamTrace] = useState([]); // streaming tool log lines
  const [plan, setPlan] = useState(null); // compound plan card (tool list)
  const [crewBlueprint, setCrewBlueprint] = useState(null); // dispatch_crew blueprint
  const [crewSpecialists, setCrewSpecialists] = useState(null); // specialist breakdown
  const [remixInfo, setRemixInfo] = useState(null); // remix_game source info
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, suggestions, streamTrace, plan, crewBlueprint]);

  // Pre-fill input when user has a selected game but no ID in message text
  const buildMessageFor = (raw) => {
    const text = String(raw || '');
    if (selectedGameId && !/game[:\s#_-]|\s#\w/i.test(text) && needsGameId(text)) {
      return `${text} game#${selectedGameId}`;
    }
    return text;
  };

  const send = async (rawText) => {
    const text = buildMessageFor(rawText);
    if (!text || loading) return;
    setMessages((m) => [...m, { role: 'user', content: rawText }]);
    setInput('');
    setSuggestions([]);
    setStreamTrace([]);
    setPlan(null);
    setCrewBlueprint(null);
    setCrewSpecialists(null);
    setRemixInfo(null);
    setLoading(true);

    // Track tool indices so tool_end can update the matching trace line.
    let traceIdx = 0;

    try {
      const res = await api.chatStream(text, sessionId, {
        onEvent: (evt) => {
          const { type, data } = evt;
          if (type === 'plan' && data?.tools?.length) {
            setPlan({ tools: data.tools });
          } else if (type === 'tool_start' && data?.tool) {
            const i = traceIdx++;
            setStreamTrace((prev) => [...prev, {
              idx: i, tool: data.tool, ok: null, status: 'run',
              message: data.args ? `${data.tool} · ${_shortArgs(data.args)}` : `执行 ${data.tool}`,
            }]);
          } else if (type === 'tool_end' && data?.tool) {
            setStreamTrace((prev) => {
              // Update the latest matching 'run' line for this tool.
              for (let j = prev.length - 1; j >= 0; j--) {
                if (prev[j].tool === data.tool && prev[j].status === 'run') {
                  const next = [...prev];
                  next[j] = { ...next[j], ok: data.ok, status: data.ok ? 'ok' : 'bad', message: data.summary || next[j].message };
                  return next;
                }
              }
              return prev;
            });
          } else if (type === 'reply_token' && data?.chunk) {
            // Incremental token streaming: append to the in-progress assistant bubble.
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last._streaming) {
                return [...prev.slice(0, -1), { ...last, content: (last.content || '') + data.chunk }];
              }
              return [...prev, { role: 'assistant', content: data.chunk, _streaming: true }];
            });
          } else if (type === 'reply' && data?.reply) {
            // Final consolidated reply replaces any streamed partial.
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last._streaming) {
                return [...prev.slice(0, -1), { role: 'assistant', content: data.reply, _streaming: false }];
              }
              return [...prev, { role: 'assistant', content: data.reply, _streaming: false }];
            });
          } else if (type === 'done' && data?.result) {
            // Dispatch editor actions surfaced in the final result early.
            dispatchEditorActions(data.result.editorActions || [], data.result.currentGameId, onSelectGame, onGamesChanged);
            // Stash crew blueprint / remix metadata for rich rendering.
            if (data.result.blueprint) setCrewBlueprint(data.result.blueprint);
            if (data.result.specialists) setCrewSpecialists(data.result.specialists);
            if (data.result.remixOf) setRemixInfo({ remixOf: data.result.remixOf, sourceTitle: data.result.remixSourceTitle });
          }
        },
      });

      if (!sessionId && res.sessionId) onSessionChange(res.sessionId);

      // Dispatch editor actions (in case the 'done' event didn't carry them).
      dispatchEditorActions(res.editorActions || [], res.currentGameId, onSelectGame, onGamesChanged);

      const nextSuggestions = buildSuggestions(res.toolResults || []);
      setSuggestions(nextSuggestions);

      // Ensure the assistant message is present (covers fallback + no 'reply' event).
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const meta = {
          intent: res.intent,
          toolTrace: res.toolResults?.map?.((t) => ({ tool: t.tool, ok: t.result.ok })),
          currentGameId: res.currentGameId,
        };
        if (res.blueprint) meta.blueprint = res.blueprint;
        if (res.specialists) meta.specialists = res.specialists;
        if (res.remixOf) meta.remix = { remixOf: res.remixOf, sourceTitle: res.remixSourceTitle };
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: res.reply || last.content, meta }];
        }
        return [...prev, { role: 'assistant', content: res.reply || '', meta }];
      });
      if (onGamesChanged && res.intent?.name && res.intent.name !== 'chat') onGamesChanged();
    } catch (err) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?._streaming) return [...prev.slice(0, -1), { role: 'assistant', content: `⚠️ ${err.message}` }];
        return [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }];
      });
      setStreamTrace([{ idx: 0, tool: 'error', ok: false, status: 'bad', message: err.message }]);
    } finally {
      setLoading(false);
      setPlan(null);
      setTimeout(() => setStreamTrace([]), 6000);
    }
  };

  // Load a past session from the history sidebar: fetch full message list
  // and restore it into the chat view so the user can continue the thread.
  const loadSession = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const data = await api.getSession(sid);
      if (data?.ok && data.session) {
        const msgs = (data.session.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
          meta: m.meta,
        }));
        setMessages(msgs);
        setSuggestions([]);
        setStreamTrace([]);
        setPlan(null);
        setCrewBlueprint(null);
        setCrewSpecialists(null);
        setRemixInfo(null);
        onSessionChange(sid);
      }
    } catch (err) {
      console.error('Failed to load session', err);
    }
  }, [onSessionChange]);

  return (
    <div className="chat-panel warm-panel">
      <header className="panel-header warm-header">
        <div className="panel-title-row">
          <span className="panel-accent warm-dot" />
          <h2>Agent 对话</h2>
        </div>
        <div className="panel-header-actions">
          <SessionHistory
            currentSessionId={sessionId}
            onLoadSession={loadSession}
            onDeleteSession={(deletedId) => {
              if (deletedId === sessionId) {
                setMessages([]);
                onSessionChange(null);
              }
            }}
          />
        </div>
        <span className="panel-hint">自然语言操控整个创作工坊</span>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-mark bounce">◆</div>
            <p>告诉 GenPlay Agent 你想创作什么</p>
            <p className="chat-empty-sub">例如：创建一个叫「星空冒险」的射击游戏</p>
            <div className="quick-prompts">
              <button className="chip" onClick={() => send('创建一个叫跳跃冒险的平台跳跃游戏')}>
                🎮 创建跳跃冒险
              </button>
              <button className="chip" onClick={() => send('创建一个叫星空远征的射击游戏')}>
                🚀 创建星空远征
              </button>
              <button className="chip" onClick={() => send('创建一个叫黎明之剑的RPG回合制游戏')}>
                ⚔️ 创建黎明之剑
              </button>
              <button className="chip" onClick={() => send('列出所有游戏')}>
                📋 列出游戏
              </button>
              <button className="chip" onClick={() => send('给我5个游戏创意')}>
                💡 创意灵感
              </button>
            </div>
            <div className="inspire-grid">
              {INSPIRATIONS.map((ins, i) => (
                <button key={i} className="inspire-card" onClick={() => send(ins.prompt)} style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="inspire-ic">{ins.icon}</span>
                  <span className="inspire-title">{ins.title}</span>
                  <span className="inspire-hint">{ins.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-avatar" aria-hidden>
              {m.role === 'user' ? '我' : 'AI'}
            </div>
            <div className="msg-body">
              <div className="msg-bubble">{m.content}</div>
              {m.meta?.remix && <RemixBadge remix={m.meta.remix} />}
              {m.meta?.blueprint && <CrewBlueprintCard blueprint={m.meta.blueprint} specialists={m.meta.specialists} onApply={() => send('落地这个创作团蓝图')} />}
              {m.meta?.toolTrace?.length > 0 && (
                <div className="msg-trace">
                  {m.meta.toolTrace.map((t, ti) => (
                    <span key={ti} className={`trace-tag ${t.ok ? 'ok' : 'bad'}`}>
                      {t.ok ? '✓' : '✗'} {t.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="msg-avatar" aria-hidden>AI</div>
            <div className="msg-body">
              <div className="msg-bubble typing">
                <span className="dots">
                  <span /><span /><span />
                </span>
                <span className="typing-text">思考规划中…</span>
              </div>
              {plan?.tools?.length > 0 && (
                <div className="plan-card bounce-in">
                  <div className="plan-card-title">📋 执行计划</div>
                  <div className="plan-card-tools">
                    {plan.tools.map((t, i) => (
                      <span key={i} className="plan-step">{i + 1}. {t}</span>
                    ))}
                  </div>
                </div>
              )}
              {streamTrace.length > 0 && (
                <div className="tool-stream">
                  {streamTrace.map((l, i) => (
                    <div key={i} className="tool-stream-line">
                      <span className={`ts-${l.status}`}>
                        {l.status === 'ok' ? '✓' : l.status === 'bad' ? '✗' : '⚙'}
                      </span>
                      <span className="ts-tag">{l.tool}</span>
                      <span>{l.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="suggestions">
          <span className="suggestions-label">建议操作：</span>
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="chip suggest-chip bounce-in"
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => send(s.message)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="输入游戏创作指令，例如：给我3个混搭创意 / 生成程序化工坊关卡 / 设计2个NPC / 配置多人对战…"
          rows={2}
        />
        <button className="btn-primary pulse-on-hover" onClick={() => send(input)} disabled={loading}>
          {loading ? '…' : '发送'}
        </button>
      </div>
    </div>
  );
}

// ---------- Rich content cards ----------

/**
 * CrewBlueprintCard - Visualizes the multi-agent specialist crew's blueprint.
 * Shows each specialist's contribution, the merged blueprint score, and a
 * one-click "apply blueprint" button that dispatches the auto-apply path.
 */
function CrewBlueprintCard({ blueprint, specialists, onApply }) {
  if (!blueprint) return null;
  const score = blueprint.critique?.score;
  const specialistList = Array.isArray(specialists) ? specialists : [];
  const ROLE_ICONS = {
    NarrativeArchitect: '📖',
    VisualDirector: '🎨',
    MechanicsEngineer: '⚙️',
    QualityCritic: '🔍',
  };
  return (
    <div className="crew-card bounce-in">
      <div className="crew-card-head">
        <span className="crew-ic">🎭</span>
        <div className="crew-head-text">
          <div className="crew-title">{blueprint.title || '创作团蓝图'}</div>
          <div className="crew-genre">{blueprint.genre || ''}</div>
        </div>
        {score != null && (
          <span className={`crew-score ${score >= 0.8 ? 'high' : score >= 0.6 ? 'mid' : 'low'}`}>
            {score.toFixed(2)}
          </span>
        )}
      </div>
      {specialistList.length > 0 && (
        <div className="crew-specialists">
          {specialistList.filter((s) => s.ok).map((s, i) => (
            <div key={i} className="crew-specialist">
              <span className="sp-ic">{ROLE_ICONS[s.role] || '◆'}</span>
              <div className="sp-body">
                <div className="sp-role">{s.role}</div>
                <div className="sp-summary">{s.summary}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="crew-card-foot">
        {blueprint.narrative?.scenarioKey && <span className="crew-tag">📖 {blueprint.narrative.scenarioKey}</span>}
        {blueprint.visual?.themeKey && <span className="crew-tag">🎨 {blueprint.visual.themeKey}</span>}
        {blueprint.mechanics?.summary && <span className="crew-tag">⚙️ {blueprint.mechanics.summary.slice(0, 40)}</span>}
        {onApply && <button className="btn-primary btn-sm" onClick={onApply}>🚀 落地蓝图</button>}
      </div>
    </div>
  );
}

/**
 * RemixBadge - Shows the source game when a remix was created.
 */
function RemixBadge({ remix }) {
  if (!remix?.remixOf) return null;
  return (
    <div className="remix-badge">
      🔄 复刻自「{remix.sourceTitle || remix.remixOf}」
    </div>
  );
}

function dispatchEditorActions(actions, currentGameId, onSelectGame, onGamesChanged) {
  if (!actions || !actions.length) return;
  for (const action of actions) {
    switch (action.type) {
      case 'studio:select-game':
        onSelectGame?.(action.payload?.gameId);
        events.emit('studio:select-game', action.payload || {});
        break;
      case 'sidebar:refresh-list':
        onGamesChanged?.();
        events.emit('sidebar:refresh-list', action.payload || {});
        break;
      case 'studio:refresh-game':
        events.emit('studio:refresh-game', action.payload || {});
        break;
      case 'studio:patch-config':
        events.emit('studio:patch-config', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:set-theme':
        events.emit('studio:set-theme', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:set-scenario':
        events.emit('studio:set-scenario', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:focus-code':
        events.emit('studio:focus-code', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:apply-diff':
        events.emit('studio:apply-diff', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:set-meta':
        events.emit('studio:set-meta', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:add-asset':
        events.emit('studio:add-asset', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:add-npc':
        events.emit('studio:add-npc', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:update-nodes':
        events.emit('studio:update-nodes', { gameId: action.gameId || currentGameId, payload: action.payload });
        break;
      case 'studio:crew-blueprint':
        events.emit('studio:crew-blueprint', { gameId: currentGameId, payload: action.payload });
        break;
      case 'studio:explore-published':
        events.emit('studio:explore-published', { gameId: currentGameId, payload: action.payload });
        break;
      default:
        events.emit(action.type, {
          gameId: action.gameId || currentGameId,
          payload: action.payload,
          ...action,
        });
    }
  }
}

function buildSuggestions(toolResults) {
  if (!toolResults?.length) return [];
  const out = [];
  const seen = new Set();
  for (let i = toolResults.length - 1; i >= 0 && out.length < 4; i--) {
    const last = toolResults[i];
    const arr = SUGGESTION_MAP[last.tool] || [];
    for (const s of arr) {
      if (!seen.has(s.message)) {
        seen.add(s.message);
        out.push(s);
        if (out.length >= 4) break;
      }
    }
  }
  return out;
}

function needsGameId(text) {
  const t = String(text || '').toLowerCase();
  return /(修改|编辑|改|调参|调试|排错|bug|运行|试玩|test|run|发布|上线|publish|deploy|详情|describe|代码|脚本|config|参数|主题|风格|剧情|场景|修复|diff|关卡|资产|npc|角色|成就|多人|节点|逻辑|快速迭代|优化)/i.test(t)
    && !/创建|生成|列出|list|有哪些|你能|帮助|你好|hi|hello|谢谢|创意|灵感|混搭/i.test(t);
}

// Compact one-line preview of tool args for the streaming trace.
function _shortArgs(args = {}) {
  const entries = Object.entries(args).filter(([k]) => k !== 'gameId');
  if (!entries.length) return '';
  return entries.slice(0, 3).map(([k, v]) => {
    let val = typeof v === 'string' ? v : JSON.stringify(v);
    if (val.length > 24) val = val.slice(0, 22) + '…';
    return `${k}=${val}`;
  }).join(' ');
}
