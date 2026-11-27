import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: '简单' },
  { key: 'normal', label: '普通' },
  { key: 'hard', label: '困难' },
  { key: 'hell', label: '地狱' },
];

/**
 * CreationHub - creation acceleration panels.
 * TemplateGallery instantiates a fully-configured game from the live genre
 * catalog; CrewStudio dispatches the multi-agent specialist crew on a creative
 * brief and lands the resulting blueprint into a real game.
 */
export function TemplateGallery({ onGamesChange, onSelectGame, flash }) {
  const [genres, setGenres] = useState([]);
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('normal');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listTemplates();
        setGenres(data.genres || []);
      } catch (e) { /* catalog unavailable */ }
    })();
  }, []);

  const apply = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const res = await api.applyTemplate(picked.key, {
        name: name.trim() || undefined,
        difficulty,
      });
      if (res?.ok && (res.game?.id || res.gameId)) {
        flash?.(res.summary || `已从模板创建「${res.game?.name || name}」`);
        onGamesChange?.();
        onSelectGame?.(res.game?.id || res.gameId);
        setPicked(null);
        setName('');
      } else {
        flash?.(res?.error || '模板应用失败');
      }
    } catch (e) {
      flash?.(`模板应用失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tab-section">
      <h4 className="tab-h">🧩 模板库 · 一键起稿</h4>
      <p className="hub-sub">每个模板预置数值、主题、剧情、NPC、资产与成就，选中即得可玩的完整游戏。</p>
      <div className="tpl-grid">
        {genres.map((g) => (
          <button
            key={g.key}
            className={`tpl-card ${picked?.key === g.key ? 'active' : ''}`}
            onClick={() => { setPicked(g); setName((prev) => prev || `${g.label}新作`); }}
          >
            <span className="tpl-icon">{g.icon}</span>
            <span className="tpl-label">{g.label}</span>
            <span className="tpl-tagline">{g.tagline}</span>
          </button>
        ))}
        {!genres.length && <p className="hub-empty">模板目录加载中…</p>}
      </div>
      {picked && (
        <div className="tpl-form fade-in-slide">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="游戏名称（留空自动生成）"
          />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTY_OPTIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <button className="btn-primary" onClick={apply} disabled={busy}>
            {busy ? '创建中…' : `✨ 用「${picked.label}」模板创建`}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * CrewStudio - brief in, blueprint out. The blueprint can be landed into a
 * real game either immediately (autoApply) or after preview (parked blueprint
 * round-trip through the backend, skipping a second specialist run).
 */
export function CrewStudio({ onGamesChange, onSelectGame, crewBlueprint, flash }) {
  const [brief, setBrief] = useState('');
  const [genre, setGenre] = useState('');
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(null); // last dispatch result from this panel

  // External blueprint injected from the chat side (studio:crew-blueprint event)
  // takes precedence so the user sees the same card they saw in conversation.
  const blueprint = local?.blueprint || crewBlueprint?.blueprint || null;
  const specialists = local?.specialists || crewBlueprint?.specialists || [];
  const landedGame = local?.game || null;

  const dispatch = async ({ autoApply = false, parked = null } = {}) => {
    if (busy) return;
    if (!parked && !brief.trim()) return;
    setBusy(true);
    try {
      const res = await api.dispatchCrew({
        brief: parked ? (local?.brief || brief) : brief.trim(),
        genre: genre || undefined,
        autoApply,
        parkedBlueprint: parked || undefined,
      });
      if (res?.ok) {
        setLocal({ ...res, brief: brief.trim() });
        if (res.game?.id || res.gameId) {
          flash?.(res.summary || '蓝图已落地');
          onGamesChange?.();
          onSelectGame?.(res.game?.id || res.gameId);
        } else {
          flash?.('蓝图已构思完成，可一键落地');
        }
      } else {
        flash?.(res?.error || '创作团调度失败');
      }
    } catch (e) {
      flash?.(`创作团调度失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tab-section">
      <h4 className="tab-h">🎬 创作团 · 协同构思</h4>
      <p className="hub-sub">叙事架构师、视觉总监、机制工程师与质量评审协同出案，蓝图确认后一键落地成游戏。</p>
      <div className="crew-form">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="创作简报，例如：一个太空站救援题材的俯视角射击，强调资源管理与紧迫感"
          rows={3}
        />
        <div className="crew-form-row">
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">自动推断类型</option>
            <option value="adventure">冒险</option>
            <option value="shooter">射击</option>
            <option value="rpg">RPG</option>
            <option value="puzzle">解谜</option>
            <option value="platformer">平台跳跃</option>
            <option value="tower">塔防</option>
            <option value="racing">赛车</option>
            <option value="roguelike">Roguelike</option>
          </select>
          <button className="btn-primary" onClick={() => dispatch({ autoApply: false })} disabled={busy || !brief.trim()}>
            {busy ? '构思中…' : '🎬 召集创作团'}
          </button>
          <button className="btn-ghost" onClick={() => dispatch({ autoApply: true })} disabled={busy || !brief.trim()}>
            ⚡ 构思并直接落地
          </button>
        </div>
      </div>

      {blueprint && (
        <div className="crew-card hub-blueprint fade-in-slide">
          <div className="crew-card-head">
            <span className="crew-ic">🎬</span>
            <div className="crew-head-text">
              <div className="crew-title">{blueprint.title || '创作团蓝图'}</div>
              <div className="crew-genre">{blueprint.genre || local?.genre || ''}</div>
            </div>
            {typeof blueprint.critique?.score === 'number' && (
              <span className={`crew-score ${blueprint.critique.score >= 0.8 ? 'high' : blueprint.critique.score >= 0.6 ? 'mid' : 'low'}`}>
                {blueprint.critique.score.toFixed(2)}
              </span>
            )}
          </div>
          <div className="crew-specialists">
            {specialists.map((s, i) => (
              <div key={i} className="crew-specialist">
                <strong>{s.role}</strong>
                <span>{(s.summary || s.proposal || '').slice(0, 80)}</span>
              </div>
            ))}
          </div>
          <div className="crew-card-foot">
            {blueprint.narrative?.scenarioKey && <span className="crew-tag">📖 {blueprint.narrative.scenarioKey}</span>}
            {blueprint.visual?.themeKey && <span className="crew-tag">🎨 {blueprint.visual.themeKey}</span>}
            {blueprint.mechanics?.summary && <span className="crew-tag">⚙️ {String(blueprint.mechanics.summary).slice(0, 40)}</span>}
          </div>
          {!landedGame && (
            <button
              className="btn-primary hub-land-btn"
              onClick={() => dispatch({ autoApply: true, parked: blueprint })}
              disabled={busy}
            >
              {busy ? '落地中…' : '🚀 落地这个蓝图（跳过重新构思）'}
            </button>
          )}
          {landedGame && <p className="hub-landed">✅ 已落地为「{landedGame.name}」，可在左侧列表中继续编辑。</p>}
        </div>
      )}
    </section>
  );
}

export default function CreationHub(props) {
  return (
    <div className="creation-hub">
      <TemplateGallery {...props} />
      <CrewStudio {...props} />
    </div>
  );
}
