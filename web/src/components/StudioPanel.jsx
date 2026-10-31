import { useEffect, useState, useMemo, useRef } from 'react';
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
  { key: 'systems', label: '系统', icon: '⚡' },
  { key: 'explore', label: '社区', icon: '🌐' },
  { key: 'code', label: '源码', icon: '🧾' },
  { key: 'debug', label: '调试', icon: '🛠️' },
  { key: 'history', label: '版本', icon: '🗂️' },
  { key: 'analytics', label: '分析', icon: '📊' },
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
  const saveGameRef = useRef(null);
  const [runResult, setRunResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [codeView, setCodeView] = useState({ sections: null, section: 'all' });
  const [exploreFilter, setExploreFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, published: 0, runs: 0, genres: 0 });
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [playtestReport, setPlaytestReport] = useState(null);
  const [flashField, setFlashField] = useState(null);
  const [composedTracks, setComposedTracks] = useState(null);
  const [dialogueTrees, setDialogueTrees] = useState(null);
  const [undoStatus, setUndoStatus] = useState({ canUndo: false, canRedo: false, pastCount: 0, futureCount: 0 });
  const [undoHistory, setUndoHistory] = useState(null);
  const [musicPlaying, setMusicPlaying] = useState(null);
  const [playableInfo, setPlayableInfo] = useState(null);

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
      else setGame((g) => g ? ({ ...g, meta: payload.meta || payload }) : g);
      setTab('meta');
      flash('游戏元设置已更新');
    }));
    // Achievements patch (manage_achievements tool).
    offs.push(events.on('studio:patch-achievements', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, meta: { ...(g.meta || {}), achievements: payload.achievements } }) : g);
      setTab('meta');
      flash(`成就列表已更新（${payload.action}）`);
    }));
    // Particle effects patch (manage_vfx tool).
    offs.push(events.on('studio:patch-vfx', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, vfx: payload.vfx }) : g);
      setTab('systems');
      flash(`粒子特效已更新（${payload.action}）`);
    }));
    // Environment ambience (manage_environment tool).
    offs.push(events.on('studio:set-environment', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, environment: payload.environment }) : g);
      setTab('systems');
      flash('环境氛围已更新');
    }));
    // Quests patch (manage_quests tool).
    offs.push(events.on('studio:patch-quests', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, quests: payload.quests }) : g);
      setTab('systems');
      flash(`任务列表已更新（${payload.action}）`);
    }));
    // Economy patch (manage_economy tool).
    offs.push(events.on('studio:patch-economy', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, economy: payload.economy }) : g);
      setTab('systems');
      flash(`经济系统已更新（${payload.action}）`);
    }));
    // Scenes patch (manage_scenes tool).
    offs.push(events.on('studio:patch-scenes', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, scenes: payload.scenes }) : g);
      setTab('scenario');
      flash(`场景列表已更新（${payload.action}）`);
    }));
    // Leaderboards patch (manage_leaderboard tool).
    offs.push(events.on('studio:patch-leaderboards', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, meta: { ...(g.meta || {}), leaderboards: payload.boards } }) : g);
      setTab('meta');
      flash(`排行榜已更新（${payload.action}）`);
    }));
    // Audio patch (manage_audio tool).
    offs.push(events.on('studio:patch-audio', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else {
        const field = payload.kind === 'music' ? 'playlist' : 'sfx';
        setGame((g) => g ? ({ ...g, audio: { ...(g.audio || {}), [field]: payload[field] } }) : g);
      }
      setTab('assets');
      flash(`音频已更新（${payload.kind}.${payload.action}）`);
    }));
    // Story generation (generate_story tool).
    offs.push(events.on('studio:set-story', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, story: payload.story }) : g);
      setTab('scenario');
      flash(`已生成剧情《${payload.story?.title}》`);
    }));
    // Performance profile (profile_game tool).
    offs.push(events.on('studio:show-profile', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, lastProfile: payload }) : g);
      setTab('analytics');
      flash(`性能评估：${payload.grade} 级（${payload.score} 分）`);
    }));
    // Lint report (lint_scripts tool).
    offs.push(events.on('studio:show-lint', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, lastLint: payload }) : g);
      setTab('scripts');
      flash(`脚本检查：${payload.summary.errors} 错误，${payload.summary.warnings} 警告`);
    }));
    // Accessibility audit (audit_accessibility tool).
    offs.push(events.on('studio:show-accessibility', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, lastAccessibility: payload }) : g);
      setTab('analytics');
      flash(`无障碍评估：${payload.grade} 级（${payload.score} 分）`);
    }));
    // Progression design (design_progression tool).
    offs.push(events.on('studio:set-progression', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, progression: payload.progression }) : g);
      setTab('scenario');
      flash(`已设计 ${payload.progression?.levelCount} 关进度`);
    }));
    // Checkpoint state (checkpoint_state tool).
    offs.push(events.on('studio:save-checkpoint', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, checkpoints: payload.checkpoints }) : g);
      if (game && game.id === id) events.emit('runtime:save-checkpoint', { gameId: id, checkpoint: payload.checkpoint });
      flash(`已保存检查点「${payload.checkpoint?.name}」`);
    }));
    offs.push(events.on('studio:load-checkpoint', ({ gameId: id, payload }) => {
      if (game && game.id === id) events.emit('runtime:load-checkpoint', { gameId: id, checkpoint: payload.checkpoint });
      flash(`已加载检查点「${payload.checkpoint?.name}」`);
    }));
    offs.push(events.on('studio:list-checkpoints', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, checkpoints: payload.checkpoints }) : g);
      flash(`共 ${payload.checkpoints?.length || 0} 个检查点`);
    }));
    offs.push(events.on('studio:delete-checkpoint', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, checkpoints: payload.checkpoints }) : g);
      flash('检查点已删除');
    }));
    offs.push(events.on('studio:clear-checkpoints', ({ gameId: id }) => {
      if (game && game.id === id) setGame((g) => g ? ({ ...g, checkpoints: [] }) : g);
      flash('已清除所有检查点');
    }));
    // Fun factor analysis (analyze_fun_factor tool).
    offs.push(events.on('studio:show-fun-factor', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, lastFunFactor: payload }) : g);
      setTab('analytics');
      flash(`趣味评估：${payload.grade} 级（${payload.total} 分）`);
    }));
    // Tutorial generation (generate_tutorial tool).
    offs.push(events.on('studio:show-tutorial', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, tutorial: payload.tutorial }) : g);
      setTab('scenario');
      flash(`已生成 ${payload.tutorial?.steps?.length || 0} 步教程`);
    }));
    // Game template creation (generate_game_template tool).
    offs.push(events.on('studio:load-game', ({ gameId: id, payload }) => {
      loadGame(id);
      setTab('config');
      flash(`已从模板创建游戏「${payload?.name}」`);
    }));
    // Runtime control (control_runtime tool) — forward to the preview.
    offs.push(events.on('studio:runtime-command', ({ gameId: id, payload }) => {
      if (game && game.id === id) {
        events.emit('runtime:command', { gameId: id, ...payload });
      }
      flash(`运行时控制：${payload.command}`);
    }));
    offs.push(events.on('studio:add-asset', ({ gameId: id, payload }) => {
      // generate_asset emits the full payload; only the asset itself belongs
      // in game.assets.
      const asset = payload?.asset || payload;
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, assets: [...(g.assets || []), asset] }) : g);
      setTab('assets');
      flash(`已添加资产：${asset?.name || 'asset'}`);
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
    // Agent-driven tab navigation (e.g. analytics tool opens analytics tab).
    offs.push(events.on('studio:open-tab', ({ tab: t }) => {
      if (t) setTab(t);
    }));
    // Keyboard shortcut: Ctrl+S triggers save.
    offs.push(events.on('studio:save-game', () => {
      saveGameRef.current?.();
    }));
    // Granular config field edit (edit_config_field tool).
    offs.push(events.on('studio:patch-config-field', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, config: patchField(g.config, payload.path, payload.after) }) : g);
      setTab('config');
      triggerFlash(payload.path);
      flash(payload.readOnly ? `读取 ${payload.path} = ${JSON.stringify(payload.after)}` : `已修改 ${payload.path} → ${JSON.stringify(payload.after)}`);
    }));
    // Script section edit (edit_script tool).
    offs.push(events.on('studio:patch-script', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, scriptSections: { ...(g.scriptSections || {}), [payload.section]: payload.after } }) : g);
      setTab('scripts');
      flash(`已生成 ${payload.section} 脚本（${payload.diff?.length || 0} 行变更）`);
    }));
    // NPC add/update/remove (manage_npc tool).
    offs.push(events.on('studio:patch-npcs', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, npcs: payload.npcs }) : g);
      setTab('assets');
      flash(`NPC 列表已更新（${payload.action}）`);
    }));
    // Asset add/update/remove (manage_asset tool).
    offs.push(events.on('studio:patch-assets', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, assets: payload.assets }) : g);
      setTab('assets');
      flash(`资产列表已更新（${payload.action}）`);
    }));
    // Playtest report (play_test tool).
    offs.push(events.on('studio:show-playtest', ({ gameId: id, payload }) => {
      setPlaytestReport(payload);
      setTab('analytics');
      flash(`模拟完成：得分 ${payload.score}，${payload.issues?.length || 0} 项问题`);
    }));
    // AI suggestions (ai_suggest tool).
    offs.push(events.on('studio:show-suggestions', ({ gameId: id, payload }) => {
      setAiSuggestions(payload.suggestions || []);
      flash(`已生成 ${payload.suggestions?.length || 0} 条改进建议`);
    }));
    // Composed music tracks (compose_music tool).
    offs.push(events.on('studio:patch-music', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else setGame((g) => g ? ({ ...g, audio: { ...(g.audio || {}), composed: payload.tracks } }) : g);
      setComposedTracks(payload.tracks);
      setTab('assets');
      flash(`已作曲 ${payload.tracks?.length || 0} 首背景音乐`);
    }));
    // Dialogue tree generation (generate_dialogue_tree tool).
    offs.push(events.on('studio:patch-dialogue', ({ gameId: id, payload }) => {
      if (!game || game.id !== id) loadGame(id);
      else {
        setGame((g) => {
          if (!g) return g;
          const existing = Array.isArray(g.dialogueTrees) ? g.dialogueTrees : [];
          return { ...g, dialogueTrees: [...existing, payload.tree] };
        });
      }
      setDialogueTrees(payload.tree);
      setTab('scenario');
      flash(`已生成对话树「${payload.tree?.title}」（${payload.tree?.nodeCount} 节点）`);
    }));
    // Undo/redo status updates (undo_redo tool).
    offs.push(events.on('studio:undo-status', ({ gameId: id, payload }) => {
      if (!game || game.id === id) setUndoStatus(payload);
    }));
    offs.push(events.on('studio:undo-history', ({ gameId: id, payload }) => {
      if (!game || game.id === id) setUndoHistory(payload);
    }));
    // Standalone playable build (build_playable tool).
    offs.push(events.on('studio:playable-ready', ({ gameId: id, payload }) => {
      if (!game || game.id === id) setPlayableInfo(payload);
      flash(`已构建可玩 HTML：${payload?.fileName || 'game.html'}（${payload?.sizeKb || 0} KB）`);
    }));
    // Keyboard shortcut signals from App.jsx.
    offs.push(events.on('chat:trigger-undo', () => {
      if (game?.id) handleUndoRedo('undo');
    }));
    offs.push(events.on('chat:trigger-redo', () => {
      if (game?.id) handleUndoRedo('redo');
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

  // Flash a specific config field with a highlight animation when the
  // agent edits it via edit_config_field.
  const triggerFlash = (path) => {
    setFlashField(path);
    setTimeout(() => setFlashField(null), 1600);
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
  // Keep ref in sync so keyboard shortcut can call the latest saveGame.
  saveGameRef.current = saveGame;

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

  // Fetch AI improvement suggestions for the current game and display them
  // as clickable chips that send follow-up messages to the chat.
  const fetchSuggestions = async () => {
    if (!game?.id) return;
    try {
      const res = await api.editorAction('ai_suggest', { gameId: game.id }, sessionId);
      const sugs = res.result?.suggestions || [];
      setAiSuggestions(sugs);
      flash(`已生成 ${sugs.length} 条改进建议`);
    } catch (err) { alert(err.message); }
  };

  // Undo/Redo handler — calls the direct REST endpoint and refreshes state.
  const handleUndoRedo = async (action) => {
    if (!game?.id) return;
    try {
      const res = action === 'undo' ? await api.undoGame(game.id) : await api.redoGame(game.id);
      if (res.ok) {
        loadGame(game.id);
        flash(res.summary || (action === 'undo' ? '已撤销' : '已重做'));
        // Refresh undo status
        try {
          const statusRes = await api.editorAction('undo_redo', { gameId: game.id, action: 'peek' }, sessionId);
          if (statusRes.result?.status) setUndoStatus(statusRes.result.status);
        } catch (_) {}
      } else {
        flash(res.error || '操作失败');
      }
    } catch (err) { flash(err.message); }
  };

  // Compose music via direct REST endpoint.
  const handleComposeMusic = async (mood) => {
    if (!game?.id) return;
    try {
      const res = await api.composeMusic(game.id, { mood: mood || undefined });
      if (res.ok) {
        setComposedTracks(res.tracks);
        flash(res.summary || '已生成背景音乐');
      } else {
        flash(res.error || '作曲失败');
      }
    } catch (err) { flash(err.message); }
  };

  // Generate dialogue tree via direct REST endpoint.
  const handleGenerateDialogue = async () => {
    if (!game?.id) return;
    try {
      const res = await api.generateDialogueTree(game.id);
      if (res.ok) {
        setDialogueTrees(res.tree);
        flash(res.summary || '已生成对话树');
      } else {
        flash(res.error || '生成失败');
      }
    } catch (err) { flash(err.message); }
  };

  // Build a standalone HTML5 game file and trigger a browser download.
  const handleDownloadPlayable = async () => {
    if (!game?.id) return;
    try {
      const built = await api.buildPlayable(game.id);
      if (!built.ok || !built.html) {
        flash(built.error || '构建失败');
        return;
      }
      const blob = new Blob([built.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = built.fileName || `${game.name || 'genplay'}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setPlayableInfo(built);
      flash(`已导出可玩文件 ${built.fileName}（${built.sizeKb} KB）`);
    } catch (err) { flash(err.message); }
  };

  // Simple Web Audio API player for composed tracks.
  const audioCtxRef = useRef(null);
  const playTrack = (track) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const beatDur = 60 / track.tempo;
      const playNotes = (notes, type, gainVal) => {
        if (!Array.isArray(notes)) return;
        for (const n of notes) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          // Parse note name like "C4" to frequency
          const noteMap = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
          const match = n.note?.match(/^([A-G]#?)(\d+)$/);
          if (match) {
            const semitone = noteMap[match[1]] + (parseInt(match[2]) - 4) * 12;
            osc.frequency.value = 440 * Math.pow(2, semitone / 12);
          }
          gain.gain.value = (n.velocity || 0.5) * gainVal;
          const start = ctx.currentTime + n.start * beatDur;
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + (n.duration || 0.25) * beatDur);
        }
      };
      if (track.tracks?.melody) playNotes(track.tracks.melody, 'sine', 0.3);
      if (track.tracks?.bass) playNotes(track.tracks.bass, 'triangle', 0.25);
      // Drums — use noise for snare/hihat, low sine for kick
      if (Array.isArray(track.tracks?.drums)) {
        for (const d of track.tracks.drums) {
          const start = ctx.currentTime + d.start * beatDur;
          if (d.hit === 'kick') {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.frequency.value = 80; gain.gain.value = (d.velocity || 0.5) * 0.4;
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(start); osc.stop(start + 0.1);
          } else if (d.hit === 'snare' || d.hit === 'hihat') {
            const buf = ctx.createBuffer(1, 1024, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < 1024; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource(); const gain = ctx.createGain();
            src.buffer = buf; gain.gain.value = (d.velocity || 0.3) * 0.15;
            src.connect(gain); gain.connect(ctx.destination);
            src.start(start);
          }
        }
      }
      setMusicPlaying(track.name);
      flash(`播放「${track.name}」`);
    } catch (err) { flash('播放失败：' + err.message); }
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
                <button className="btn-ghost" onClick={fetchSuggestions}>💡 AI 建议</button>
                <button className="btn-ghost" onClick={() => runEditorAction('balance_game', { targetDifficulty: 'normal' })}>⚖️ 自动平衡</button>
                <button className="btn-ghost" onClick={() => runEditorAction('translate_game', { targetLang: 'en' })}>🌐 翻译</button>
                <button className="btn-ghost" onClick={() => runEditorAction('generate_story', {})}>📖 生成剧情</button>
                <button className="btn-ghost" onClick={() => runEditorAction('profile_game', {})}>📊 性能分析</button>
                <button className="btn-ghost" onClick={() => runEditorAction('lint_scripts', {})}>🔍 检查脚本</button>
                <button className="btn-danger" onClick={deleteGame}>🗑️</button>
              </div>
            </div>

            {aiSuggestions.length > 0 && (
              <div className="ai-suggestions-card">
                <div className="ai-suggestions-head">
                  <span>💡 AI 改进建议</span>
                  <button className="btn-mini" onClick={() => setAiSuggestions([])}>收起</button>
                </div>
                <div className="ai-suggestions-list">
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      className={`ai-suggest-item cat-${s.category}`}
                      onClick={() => events.emit('chat:send', { message: s.followUp })}
                    >
                      <span className="ai-suggest-cat">{suggestIcon(s.category)}</span>
                      <span className="ai-suggest-text">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              {tab === 'assets' && (
                <div className="tab-section" style={{ marginTop: 16 }}>
                  <h4 className="tab-h">🎵 AI 原创作曲</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button className="btn-primary" onClick={() => handleComposeMusic()}>🎼 自动作曲（全情绪）</button>
                    <button className="btn-ghost" onClick={() => handleComposeMusic('calm')}>宁静</button>
                    <button className="btn-ghost" onClick={() => handleComposeMusic('intense')}>激战</button>
                    <button className="btn-ghost" onClick={() => handleComposeMusic('boss')}>Boss</button>
                    <button className="btn-ghost" onClick={() => handleComposeMusic('menu')}>菜单</button>
                    <button className="btn-ghost" onClick={() => handleComposeMusic('victory')}>凯旋</button>
                  </div>
                  {(composedTracks || game?.audio?.composed) && (
                    <div className="music-tracks">
                      {(composedTracks || game?.audio?.composed || []).map((t, i) => (
                        <div key={i} className="music-track-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border,#333)' }}>
                          <button className="btn-ghost btn-sm" onClick={() => playTrack(t)}>▶</button>
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                          <span style={{ opacity: 0.6, fontSize: '0.85em' }}>{t.mood} · {t.tempo} BPM · {t.key}</span>
                          {musicPlaying === t.name && <span style={{ color: 'var(--accent,#0f0)' }}>♪ 播放中</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tab === 'theme' && <TabTheme game={game} runEditorAction={runEditorAction} />}
              {tab === 'scenario' && <TabScenario game={game} runEditorAction={runEditorAction} />}
              {tab === 'scenario' && (
                <div className="tab-section" style={{ marginTop: 16 }}>
                  <h4 className="tab-h">🌳 分支对话树</h4>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button className="btn-primary" onClick={handleGenerateDialogue}>🌳 生成对话树</button>
                    <button className="btn-ghost" onClick={() => runEditorAction('generate_dialogue_tree', {})}>通过 Agent 生成</button>
                  </div>
                  {(dialogueTrees || (game?.dialogueTrees && game.dialogueTrees[0])) && (() => {
                    const tree = dialogueTrees || game.dialogueTrees[game.dialogueTrees.length - 1];
                    if (!tree) return null;
                    return (
                      <div className="dialogue-tree-view">
                        <h5>「{tree.title}」 · {tree.nodeCount} 节点 · {tree.endings?.length || 0} 结局</h5>
                        <div style={{ fontSize: '0.9em', lineHeight: 1.6 }}>
                          <svg width="100%" height="320" style={{ border: '1px solid var(--border,#333)', borderRadius: 8, background: 'var(--bg-alt,#111)' }}>
                            {(() => {
                              // Simple tree layout: BFS from root, each depth level is a row.
                              const visited = new Set();
                              const levels = [];
                              const queue = [{ id: tree.rootId, depth: 0 }];
                              while (queue.length) {
                                const { id, depth } = queue.shift();
                                if (visited.has(id)) continue;
                                visited.add(id);
                                const node = tree.nodes?.[id];
                                if (!node) continue;
                                if (!levels[depth]) levels[depth] = [];
                                levels[depth].push(node);
                                for (const ch of (node.choices || [])) {
                                  if (ch.next) queue.push({ id: ch.next, depth: depth + 1 });
                                }
                              }
                              const rowH = 80;
                              const maxW = 800;
                              const els = [];
                              levels.forEach((row, d) => {
                                const y = 30 + d * rowH;
                                const colW = maxW / (row.length + 1);
                                row.forEach((node, i) => {
                                  const x = colW * (i + 1);
                                  const isEnd = node.isEnding;
                                  els.push(<circle key={`c-${node.id}`} cx={x} cy={y} r={6} fill={isEnd ? '#f55' : '#5af'} />);
                                  els.push(<text key={`t-${node.id}`} x={x + 10} y={y + 4} fill="#ccc" fontSize="10">{(node.speaker || '').slice(0, 6)}</text>);
                                  // Draw edges to children
                                  (node.choices || []).forEach((ch, ci) => {
                                    if (!ch.next) return;
                                    const child = tree.nodes[ch.next];
                                    if (!child) return;
                                    // Find child position — search next level
                                    const childDepth = d + 1;
                                    const childRow = levels[childDepth] || [];
                                    const childIdx = childRow.findIndex((n) => n.id === ch.next);
                                    if (childIdx >= 0) {
                                      const childX = (maxW / (childRow.length + 1)) * (childIdx + 1);
                                      const childY = 30 + childDepth * rowH;
                                      els.push(<line key={`e-${node.id}-${ci}`} x1={x} y1={y} x2={childX} y2={childY} stroke="#444" strokeWidth="1" />);
                                    }
                                  });
                                });
                              });
                              return els;
                            })()}
                          </svg>
                        </div>
                        {/* Node detail list */}
                        <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
                          {Object.values(tree.nodes || {}).slice(0, 8).map((n) => (
                            <div key={n.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border,#222)' }}>
                              <strong>{n.speaker}:</strong> <span style={{ opacity: 0.85 }}>{n.text?.slice(0, 80)}{n.text?.length > 80 ? '…' : ''}</span>
                              {n.isEnding && <span style={{ color: '#f55', marginLeft: 8 }}>[{n.endingLabel}]</span>}
                              {!n.isEnding && n.choices?.length > 0 && (
                                <ul style={{ margin: '4px 0 0 16px', fontSize: '0.85em', opacity: 0.7 }}>
                                  {n.choices.map((c, i) => (
                                    <li key={i}>{c.text}{c.condition ? ` [需要 ${c.condition.stat}≥${c.condition.gte}]` : ''}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {tab === 'meta' && <TabMeta game={game} setGame={setGame} runEditorAction={runEditorAction} />}
              {tab === 'systems' && <TabSystems game={game} />}
              {tab === 'explore' && <TabExplore exploreFilter={exploreFilter} setExploreFilter={setExploreFilter} onPick={(g) => flash(`社区作品: ${g.name}`)} />}
              {tab === 'code' && <TabCodeView game={game} codeView={codeView} runEditorAction={runEditorAction} />}
              {tab === 'debug' && <TabDebug game={game} runResult={runResult} runEditorAction={runEditorAction} />}
              {tab === 'history' && (
                <>
                  <div className="tab-section" style={{ marginBottom: 12 }}>
                    <h4 className="tab-h">↩️ 撤销 / 重做</h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="btn-primary" disabled={!undoStatus.canUndo} onClick={() => handleUndoRedo('undo')}>↶ 撤销</button>
                      <button className="btn-ghost" disabled={!undoStatus.canRedo} onClick={() => handleUndoRedo('redo')}>↷ 重做</button>
                      <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                        可撤销 {undoStatus.pastCount} 步 · 可重做 {undoStatus.futureCount} 步
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.8em', opacity: 0.5 }}>快捷键: Ctrl+Z / Ctrl+Y</span>
                    </div>
                  </div>
                  <TabHistory game={game} onGamesChange={onGamesChange} flash={flash} />
                </>
              )}
              {tab === 'analytics' && <TabAnalytics game={game} flash={flash} />}
            </div>
          </div>

          <div className="preview-col">
            <div className="preview-col-head">
              <h4>🎯 实时预览</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="preview-col-hint">
                  键盘 · WASD / 方向键 / 空格 交互
                </span>
                <button
                  className="btn-ghost btn-sm"
                  onClick={handleDownloadPlayable}
                  disabled={!game}
                  title="导出可离线运行的单文件 HTML5 游戏"
                >
                  ⬇️ 可玩 HTML
                </button>
              </div>
            </div>
            <GamePreview game={game} />
            {playableInfo && (
              <div className="playable-info">
                <span>🎮 {playableInfo.fileName} · {playableInfo.sizeKb} KB</span>
                <a href={api.playableUrl(game.id)} target="_blank" rel="noreferrer">在新标签页打开</a>
              </div>
            )}
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
  const sections = game.scriptSections || {};
  const sectionNames = Object.keys(sections);
  return (
    <div className="tab-fields">
      <div className="field">
        <label>游戏逻辑脚本（DSL）</label>
        <textarea rows={12} className="code-area" value={game.scripts || ''}
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

      {/* Generated code sections produced by the edit_script tool. */}
      {sectionNames.length > 0 && (
        <div className="field" style={{ marginTop: 16 }}>
          <label>AI 生成脚本片段</label>
          {sectionNames.map((name) => (
            <div key={name} className="code-block-wrap">
              <div className="code-block-title">{name.toUpperCase()}</div>
              <pre className="code-block">{sections[name]}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Lint report from lint_scripts tool. */}
      {game.lastLint && (
        <div className="field" style={{ marginTop: 16 }}>
          <label>脚本检查报告
            <span className={`lint-summary ${game.lastLint.summary.errors > 0 ? 'has-errors' : 'clean'}`}>
              {game.lastLint.summary.errors} 错误 · {game.lastLint.summary.warnings} 警告 · {game.lastLint.summary.infos} 提示
            </span>
          </label>
          <ul className="diag-list">
            {[...(game.lastLint.dslIssues || []), ...(game.lastLint.sectionIssues || [])].map((issue, i) => (
              <li key={i} className={`diag diag-${issue.level}`}>
                <b>[{issue.level}] {issue.section || `第${issue.line || 0}行`}</b>：{issue.message}
                {issue.fix && <span className="lint-fix"> → {issue.fix}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
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
  const scenes = Array.isArray(game.scenes) ? game.scenes : [];
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

      {/* Generated story narrative (generate_story tool). */}
      {game.story && (
        <div className="meta-section" style={{ marginTop: 24 }}>
          <h5>📜 剧情大纲《{game.story.title}》</h5>
          <div className="scenario-backdrop">
            <b>世界观：</b>{game.story.setting}<br />
            <b>主角：</b>{game.story.protagonist} · <b>反派：</b>{game.story.antagonist}
          </div>
          <p className="achievement-desc" style={{ marginTop: 8 }}>{game.story.premise}</p>
          <ul className="scenario-chapters">
            {game.story.chapters?.map((c) => (
              <li key={c.id}>
                <b>第{c.id}章 {c.name}：</b>{c.objective}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generated progression / difficulty curve (design_progression tool). */}
      {game.progression && (
        <div className="meta-section" style={{ marginTop: 24 }}>
          <h5>📈 难度曲线与关卡进度 <span className="analytics-genre">{game.progression.curve} · {game.progression.levelCount} 关</span></h5>
          <div className="kpi-row" style={{ marginTop: 10 }}>
            {game.progression.levels?.map((lvl) => (
              <div key={lvl.index} className={`progression-node ${lvl.isBoss ? 'boss' : ''}`} title={lvl.name}>
                <div className="prog-diff" style={{ width: `${Math.min(100, lvl.difficulty * 25)}%` }} />
                <span className="prog-label">第{lvl.index}关</span>
                <span className="prog-meta">{lvl.isBoss ? '👑 Boss' : `${lvl.enemies}敌`}</span>
              </div>
            ))}
          </div>
          <ul className="scenario-chapters" style={{ marginTop: 12 }}>
            {game.progression.levels?.map((lvl) => (
              <li key={lvl.index}>
                <b>{lvl.name}</b>：{lvl.theme}
                {lvl.narrative && <span style={{ color: 'var(--text-dim)' }}> — {lvl.narrative}</span>}
                <span className="analytics-genre" style={{ marginLeft: 8 }}>难度 {lvl.difficulty} · 奖励 {lvl.reward}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generated tutorial / onboarding (generate_tutorial tool). */}
      {game.tutorial && (
        <div className="meta-section" style={{ marginTop: 24 }}>
          <h5>📖 新手引导教程 <span className="analytics-genre">{game.tutorial.style} · {game.tutorial.steps.length} 步</span></h5>
          <ol className="scenario-chapters" style={{ paddingLeft: 20 }}>
            {game.tutorial.steps?.map((step) => (
              <li key={step.id} style={{ marginBottom: 6 }}>
                <b>{step.text}</b>
                {step.trigger && <span className="analytics-genre" style={{ marginLeft: 8 }}>触发：{step.trigger}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Multi-scene / level list managed by the manage_scenes tool. */}
      <div className="meta-section" style={{ marginTop: 24 }}>
        <h5>🗺️ 关卡 / 场景列表</h5>
        {scenes.length === 0 ? (
          <p className="edit-empty-sub">暂无多场景，可在左侧 Agent 中说「加一个Boss关卡」来创建。</p>
        ) : (
          <div className="achievement-list">
            {scenes.map((s, i) => (
              <div key={s.id} className="achievement-item">
                <span className="achievement-ic">{sceneIcon(s.type)}</span>
                <div className="achievement-body">
                  <div className="achievement-name">#{i + 1} {s.name}</div>
                  <div className="achievement-desc">类型: {s.type} · 背景: {s.background}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function sceneIcon(type) {
  switch (type) {
    case 'menu': return '📋';
    case 'boss': return '👹';
    case 'cutscene': return '🎬';
    case 'shop': return '🛒';
    case 'gameover': return '💀';
    case 'victory': return '🏆';
    default: return '🗺️';
  }
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
              {/* Locally synthesized SVG illustration attached by generate_asset. */}
              {a.svg && (
                <div
                  className="asset-svg"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: a.svg }}
                />
              )}
              <span className={`asset-type-tag at-${a.type || 'sprite'}`}>
                {ASSET_TYPES.find((t) => t.key === a.type)?.label || a.type}
              </span>
              <h5>{a.name}</h5>
              <p>{a.description || a.prompt || '—'}</p>
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

      {/* Audio playlist & SFX bank managed by the manage_audio tool. */}
      {(() => {
        const audio = game.audio || {};
        const playlist = audio.playlist || [];
        const sfxBank = audio.sfx || [];
        return (
          <div>
            <h5 style={{ fontSize: '0.9rem', marginBottom: 10 }}>🎵 音频 ({playlist.length + sfxBank.length})</h5>
            {playlist.length === 0 && sfxBank.length === 0 && (
              <div style={{ color: 'var(--text-faint)', fontSize: '0.82rem', padding: 18, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                暂无音频。可在对话中说「加一个战斗背景音乐」或「添加射击音效」→
              </div>
            )}
            {playlist.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: 6 }}>背景音乐</div>
                <div className="asset-list">
                  {playlist.map((m, i) => (
                    <div key={m.id || i} className="asset-card">
                      <span className="asset-type-tag at-music">🎵 {m.mood || 'music'}</span>
                      <h5>{m.name}</h5>
                      <p>音量 {Math.round((m.volume ?? 0.8) * 100)}% · {m.loop ? '循环' : '单次'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sfxBank.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: 6 }}>音效</div>
                <div className="asset-list">
                  {sfxBank.map((s, i) => (
                    <div key={s.id || i} className="asset-card">
                      <span className="asset-type-tag at-sound">🔊 {s.trigger || 'sfx'}</span>
                      <h5>{s.name}</h5>
                      <p>音量 {Math.round((s.volume ?? 0.8) * 100)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// Runtime systems panel: physics feel, controls, environment, particle
// effects, quests and in-game economy. All sections are agent-controllable
// via the left conversation (configure_physics / configure_controls /
// manage_environment / manage_vfx / manage_quests / manage_economy).
function TabSystems({ game }) {
  const config = game?.config || {};
  const physics = config.physics || {};
  const controls = config.controls || {};
  const env = game?.environment || null;
  const vfx = Array.isArray(game?.vfx) ? game.vfx : [];
  const quests = Array.isArray(game?.quests) ? game.quests : [];
  const economy = game?.economy || {};
  const currencies = Array.isArray(economy.currencies) ? economy.currencies : [];
  const shop = Array.isArray(economy.shop) ? economy.shop : [];

  const PHYS_ROWS = [
    ['gravity', '重力'], ['jumpForce', '跳跃力'], ['moveSpeed', '移动速度'],
    ['bounce', '弹性'], ['friction', '摩擦'], ['maxJumps', '跳跃段数'],
  ];
  const CYCLE_LABELS = { day: '☀️ 白天', night: '🌙 黑夜', dusk: '🌆 黄昏', dawn: '🌅 黎明', auto: '🔄 自动昼夜' };
  const FX_ICONS = { rain: '🌧️', snow: '❄️', petals: '🌸', sparks: '✨', bubbles: '🫧', stars: '⭐', embers: '🔥', confetti: '🎊' };

  return (
    <div className="tab-fields">
      <h4 className="tab-h">⚡ 游戏系统</h4>

      <div className="meta-section">
        <h5>🏀 物理手感</h5>
        {Object.keys(physics).length === 0 ? (
          <p className="field-hint">默认物理参数。对 Agent 说“把重力调成 0.8，跳跃力 13，支持二段跳”即可调整。</p>
        ) : (
          <div className="chip-row">
            {PHYS_ROWS.filter(([k]) => physics[k] !== undefined).map(([k, label]) => (
              <span key={k} className="chip">{label} <b>{physics[k]}</b></span>
            ))}
          </div>
        )}
      </div>

      <div className="meta-section">
        <h5>🎮 操控方案</h5>
        <div className="chip-row">
          <span className="chip">触屏 {controls.touchPad ? '✅' : '➖'}</span>
          <span className="chip">手柄 {controls.gamepad ? '✅' : '➖'}</span>
          {controls.sensitivity !== undefined && <span className="chip">灵敏度 <b>{controls.sensitivity}</b></span>}
        </div>
        {Object.keys(controls.remap || {}).length > 0 && (
          <div className="chip-row">
            {Object.entries(controls.remap).map(([action, key]) => (
              <span key={action} className="chip">{action} → <b>{key === ' ' ? '空格' : key}</b></span>
            ))}
          </div>
        )}
        {!controls.touchPad && !controls.gamepad && !Object.keys(controls.remap || {}).length && controls.sensitivity === undefined && (
          <p className="field-hint">默认键位（方向键 / WASD / 空格）。对 Agent 说“把跳跃键改成 J，开启触屏按键”即可自定义。</p>
        )}
      </div>

      <div className="meta-section">
        <h5>🌦️ 环境氛围</h5>
        {!env ? (
          <p className="field-hint">默认白昼无天气。对 Agent 说“切换到夜晚，下雪天气，加暗角”即可营造氛围。</p>
        ) : (
          <div className="chip-row">
            <span className="chip">{CYCLE_LABELS[env.cycle] || env.cycle}</span>
            {env.weather && env.weather !== 'none' && <span className="chip">{FX_ICONS[env.weather]} {env.weather}</span>}
            {env.grading && <span className="chip">调色 {env.grading}</span>}
            {env.vignette > 0 && <span className="chip">暗角 {Math.round(env.vignette * 100)}%</span>}
          </div>
        )}
      </div>

      <div className="meta-section">
        <h5>✨ 粒子特效</h5>
        {vfx.length === 0 ? (
          <p className="field-hint">暂无特效。对 Agent 说“加一个樱花花瓣粒子特效”即可添加。</p>
        ) : (
          <div className="chip-row">
            {vfx.map((e) => (
              <span key={e.id} className={`chip ${e.enabled === false ? 'chip-off' : ''}`}>
                {FX_ICONS[e.preset] || '✨'} {e.name} ×{e.intensity ?? 1}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="meta-section">
        <h5>📜 任务系统</h5>
        {quests.length === 0 ? (
          <p className="field-hint">暂无任务。对 Agent 说“加一个主线任务叫收集五颗水晶”即可创建。</p>
        ) : (
          quests.map((q) => (
            <div key={q.id} className="quest-card">
              <div className="quest-head">
                <span className={`quest-status ${q.status}`}>
                  {q.status === 'done' ? '✅' : q.status === 'locked' ? '🔒' : '🎯'}
                </span>
                <b>{q.name}</b>
                <span className="quest-rewards">
                  {(q.rewards || []).map((r, i) => <span key={i} className="chip">+{r.amount} {r.type}</span>)}
                </span>
              </div>
              <p className="field-hint">{q.desc}</p>
              <ul className="quest-objs">
                {(q.objectives || []).map((o, i) => (
                  <li key={i} className={o.done ? 'done' : ''}>{o.done ? '☑' : '☐'} {o.text}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="meta-section">
        <h5>💰 经济系统</h5>
        {currencies.length === 0 && shop.length === 0 ? (
          <p className="field-hint">暂无经济配置。对 Agent 说“加一种货币叫水晶，上架商品回血药水售价 50”即可搭建。</p>
        ) : (
          <>
            {currencies.length > 0 && (
              <div className="chip-row">
                {currencies.map((c) => (
                  <span key={c.id} className="chip">{c.icon} {c.name} · 初始 <b>{c.initial}</b></span>
                ))}
              </div>
            )}
            {shop.length > 0 && (
              <div className="chip-row">
                {shop.map((it) => (
                  <span key={it.id} className="chip">{it.icon} {it.name} · <b>{it.price}</b> {it.currency}</span>
                ))}
              </div>
            )}
          </>
        )}
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
    { id: 'ach_first_win', name: '初次胜利', desc: '完成第一局游戏', condition: 'wins >= 1', unlocked: false, icon: '🏆' },
    { id: 'ach_high_score', name: '高分猎手', desc: '单局得分超过 1000', condition: 'score >= 1000', unlocked: false, icon: '🎯' },
    { id: 'ach_perfect', name: '完美通关', desc: '不损失一命通过', condition: 'deaths == 0', unlocked: false, icon: '⭐' },
  ];
  const leaderboards = meta.leaderboards || [];

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
                {a.condition && <div className="achievement-cond">条件: {a.condition}</div>}
              </div>
              <span className="achievement-unlock">{a.unlocked ? '已解锁' : '未解锁'}</span>
            </div>
          ))}
        </div>
      </div>

      {leaderboards.length > 0 && (
        <div className="meta-section">
          <h5>📊 排行榜</h5>
          <div className="achievement-list">
            {leaderboards.map((b) => (
              <div key={b.id} className="achievement-item">
                <span className="achievement-ic">🏅</span>
                <div className="achievement-body">
                  <div className="achievement-name">{b.label}</div>
                  <div className="achievement-desc">计分: {b.scoring} · {b.order === 'asc' ? '越低越好' : '越高越好'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

// ---------- Version History ----------
function TabHistory({ game, onGamesChange, flash }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState(null);

  const refresh = async () => {
    if (!game?.id) return;
    setLoading(true);
    try {
      const data = await api.listVersions(game.id);
      setTimeline(data.result?.timeline || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (game?.id) refresh(); }, [game?.id]);

  const snap = async () => {
    if (!game?.id) return;
    const label = `快照 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
    try {
      await api.createSnapshot(game.id, label);
      flash('已创建版本快照');
      refresh();
    } catch (e) { alert(e.message); }
  };

  const restore = async (snapId) => {
    if (!confirm('确认回滚到该版本？当前状态会自动保存为新快照。')) return;
    try {
      await api.restoreSnapshot(game.id, snapId);
      flash('已回滚到该版本');
      onGamesChange?.();
      refresh();
    } catch (e) { alert(e.message); }
  };

  const showDiff = async (snapId) => {
    try {
      const data = await api.diffSnapshot(game.id, snapId);
      setDiff(data.result?.diff || {});
    } catch (e) { console.error(e); }
  };

  return (
    <div className="tab-history">
      <div className="history-toolbar">
        <button className="btn-primary" onClick={snap}>📷 创建快照</button>
        <span className="history-count">共 {timeline.length} 个版本</span>
      </div>

      {loading && <div className="loading">加载中…</div>}

      <div className="version-timeline">
        {timeline.length === 0 && !loading && (
          <div className="empty-state">还没有快照。点击「创建快照」保存当前游戏状态。</div>
        )}
        {timeline.map((v, i) => (
          <div key={v.id} className="version-item">
            <div className="version-marker">{timeline.length - i}</div>
            <div className="version-body">
              <div className="version-label">{v.label}</div>
              <div className="version-time">{new Date(v.capturedAt).toLocaleString('zh-CN', { hour12: false })}</div>
              {v.digest?.changes && Object.keys(v.digest.changes).length > 0 && (
                <div className="version-changes">
                  {Object.keys(v.digest.changes).map((f) => (
                    <span key={f} className="change-chip">{f}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="version-actions">
              <button className="btn-ghost btn-sm" onClick={() => showDiff(v.id)}>对比</button>
              <button className="btn-ghost btn-sm" onClick={() => restore(v.id)}>回滚</button>
            </div>
          </div>
        ))}
      </div>

      {diff && (
        <div className="diff-panel">
          <h5>字段差异对比</h5>
          {Object.keys(diff).length === 0 ? (
            <p className="muted">无差异</p>
          ) : (
            <table className="diff-table">
              <thead><tr><th>字段</th><th>变化</th><th>快照大小</th><th>当前大小</th></tr></thead>
              <tbody>
                {Object.entries(diff).map(([field, info]) => (
                  <tr key={field}>
                    <td>{field}</td>
                    <td>✓ changed</td>
                    <td>{info.beforeBytes} B</td>
                    <td>{info.afterBytes} B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Analytics (SVG charts) ----------
function TabAnalytics({ game, flash }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadLatest = async () => {
    if (!game?.id) return;
    try {
      const data = await api.getAnalytics(game.id);
      setReport(data.report || null);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (game?.id) loadLatest(); }, [game?.id]);

  const simulate = async () => {
    if (!game?.id) return;
    setLoading(true);
    try {
      const data = await api.simulateAnalytics(game.id);
      setReport(data.result?.report || null);
      flash(data.result?.summary || '分析完成');
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  if (!game) return <div className="empty-state">先选择一个游戏</div>;

  return (
    <div className="tab-analytics">
      <div className="analytics-toolbar">
        <button className="btn-primary" onClick={simulate} disabled={loading}>
          {loading ? '分析中…' : '📊 模拟玩家行为'}
        </button>
        {report && (
          <span className="analytics-genre">{report.genre} · seed {report.seed}</span>
        )}
      </div>

      {/* Performance profile from profile_game tool. */}
      {game.lastProfile && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h5>⚡ 性能评估 <span className="analytics-genre">{game.lastProfile.grade} 级 · {game.lastProfile.score} 分</span></h5>
          <div className="kpi-row">
            <Kpi label="预估 FPS" value={game.lastProfile.fps} />
            <Kpi label="实体总数" value={game.lastProfile.entities?.total} />
            <Kpi label="内存" value={`${game.lastProfile.memoryKB} KB`} />
            <Kpi label="绘制调用" value={game.lastProfile.drawCalls} />
          </div>
          {game.lastProfile.bottlenecks?.length > 0 && (
            <ul className="diag-list" style={{ marginTop: 12 }}>
              {game.lastProfile.bottlenecks.map((b, i) => (
                <li key={i} className={`diag diag-${b.severity}`}>
                  <b>[{b.severity}] {b.area}</b>：{b.suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Accessibility report from audit_accessibility tool. */}
      {game.lastAccessibility && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h5>♿ 无障碍评估 <span className="analytics-genre">{game.lastAccessibility.grade} 级 · {game.lastAccessibility.score} 分</span></h5>
          <div className="kpi-row">
            <Kpi label="严重" value={game.lastAccessibility.summary?.errors} />
            <Kpi label="警告" value={game.lastAccessibility.summary?.warnings} />
            <Kpi label="提示" value={game.lastAccessibility.summary?.infos} />
          </div>
          {game.lastAccessibility.remediation && (
            <p style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: '0.85rem' }}>{game.lastAccessibility.remediation}</p>
          )}
          {game.lastAccessibility.issues?.length > 0 ? (
            <ul className="diag-list" style={{ marginTop: 12 }}>
              {game.lastAccessibility.issues.map((iss, i) => (
                <li key={i} className={`diag diag-${iss.severity}`}>
                  <b>[{iss.severity}] {iss.area}</b>：{iss.message}
                  {iss.fix && <span style={{ color: 'var(--text-dim)' }}> → {iss.fix}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ marginTop: 10, color: 'var(--ok)' }}>✅ 未发现无障碍问题</p>
          )}
        </div>
      )}

      {/* Fun factor report from analyze_fun_factor tool. */}
      {game.lastFunFactor && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h5>🎮 趣味评估 <span className="analytics-genre">{game.lastFunFactor.grade} 级 · {game.lastFunFactor.total} 分</span></h5>
          <div className="kpi-row">
            <Kpi label="机制" value={`${Math.round((game.lastFunFactor.scores?.mechanics || 0) * 100)}`} />
            <Kpi label="反馈" value={`${Math.round((game.lastFunFactor.scores?.feedback || 0) * 100)}`} />
            <Kpi label="进度" value={`${Math.round((game.lastFunFactor.scores?.progression || 0) * 100)}`} />
            <Kpi label="挑战" value={`${Math.round((game.lastFunFactor.scores?.challenge || 0) * 100)}`} />
            <Kpi label="重玩" value={`${Math.round((game.lastFunFactor.scores?.replayability || 0) * 100)}`} />
            <Kpi label="打磨" value={`${Math.round((game.lastFunFactor.scores?.polish || 0) * 100)}`} />
            <Kpi label="创新" value={`${Math.round((game.lastFunFactor.scores?.innovation || 0) * 100)}`} />
          </div>
          {game.lastFunFactor.analysis && (
            <p style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: '0.85rem' }}>{game.lastFunFactor.analysis}</p>
          )}
          {game.lastFunFactor.suggestions?.length > 0 && (
            <ul className="diag-list" style={{ marginTop: 12 }}>
              {game.lastFunFactor.suggestions.map((s, i) => (
                <li key={i} className="diag diag-low">
                  <b>[{s.dimension}] ${s.score}分</b>：{s.suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!report && !loading && (
        <div className="empty-state">点击「模拟玩家行为」生成留存、会话与难度曲线分析。</div>
      )}

      {report && (
        <div className="analytics-grid">
          {/* Retention curve */}
          <div className="chart-card">
            <h5>留存曲线</h5>
            <RetentionChart points={report.retention?.points || []} />
            <div className="kpi-row">
              <Kpi label="D1" value={`${Math.round(report.retention.d1 * 100)}%`} />
              <Kpi label="D7" value={`${Math.round(report.retention.d7 * 100)}%`} />
              <Kpi label="D30" value={`${Math.round(report.retention.d30 * 100)}%`} />
            </div>
          </div>

          {/* Session histogram */}
          <div className="chart-card">
            <h5>会话时长分布</h5>
            <Histogram buckets={report.sessionHistogram?.buckets || []} />
          </div>

          {/* Difficulty heatmap */}
          <div className="chart-card">
            <h5>难度热力图</h5>
            <Heatmap cells={report.difficultyHeatmap?.cells || []} />
          </div>

          {/* Drop-offs & suggestions */}
          <div className="chart-card">
            <h5>流失点 & 改进建议</h5>
            {report.dropOffs?.length ? (
              <ul className="drop-list">
                {report.dropOffs.map((d, i) => (
                  <li key={i}>
                    <span className="drop-level">关卡 {d.level}</span>
                    <span className={`drop-sev ${d.severity > 0.2 ? 'high' : d.severity > 0.1 ? 'mid' : 'low'}`}>
                      {Math.round(d.severity * 100)}%
                    </span>
                    <span className="drop-kind">{d.kind}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">未检测到明显流失点</p>}
            <div className="suggestions">
              {report.suggestions?.map((s, i) => (
                <div key={i} className={`sug sug-${s.severity}`}>
                  <strong>{s.area}</strong> {s.tip}
                  {s.expectedLift && <em> · {s.expectedLift}</em>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  );
}

// Pure SVG retention curve.
function RetentionChart({ points }) {
  const W = 300, H = 120, pad = 28;
  if (!points.length) return <div className="muted">暂无数据</div>;
  const maxDay = Math.max(...points.map((p) => p.day), 30);
  const xs = (d) => pad + (d / maxDay) * (W - pad * 2);
  const ys = (r) => H - pad - r * (H - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(p.day)} ${ys(p.rate)}`).join(' ');
  return (
    <svg width={W} height={H} className="chart-svg">
      <defs>
        <linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ec4899" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ec4899" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} y1={ys(g)} x2={W - pad} y2={ys(g)} stroke="rgba(255,255,255,0.08)" />
      ))}
      <path d={`${path} L ${xs(maxDay)} ${H - pad} L ${xs(0)} ${H - pad} Z`} fill="url(#retFill)" />
      <path d={path} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xs(p.day)} cy={ys(p.rate)} r="3" fill="#fff" stroke="#ec4899" strokeWidth="2" />
      ))}
      <text x={pad} y={H - 6} fontSize="10" fill="#8e82b3">D0</text>
      <text x={W - pad} y={H - 6} fontSize="10" fill="#8e82b3" textAnchor="end">D30</text>
    </svg>
  );
}

// Pure SVG session length histogram.
function Histogram({ buckets }) {
  const W = 300, H = 120, pad = 24;
  if (!buckets.length) return <div className="muted">暂无数据</div>;
  const max = Math.max(...buckets.map((b) => b.share), 0.01);
  const bw = (W - pad * 2) / buckets.length;
  return (
    <svg width={W} height={H} className="chart-svg">
      {buckets.map((b, i) => {
        const h = (b.share / max) * (H - pad * 2);
        const x = pad + i * bw;
        const y = H - pad - h;
        return (
          <g key={i}>
            <rect x={x + 2} y={y} width={bw - 4} height={h} rx="4"
              fill={`rgba(167,139,250,${0.4 + (b.share / max) * 0.6})`} />
            <text x={x + bw / 2} y={H - 6} fontSize="9" fill="#8e82b3" textAnchor="middle">
              {b.rangeMin}m
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Pure SVG difficulty heatmap (horizontal bar per level).
function Heatmap({ cells }) {
  if (!cells.length) return <div className="muted">暂无数据</div>;
  return (
    <div className="heatmap">
      {cells.map((c) => (
        <div key={c.level} className="heat-row">
          <span className="heat-lvl">L{c.level}</span>
          <div className="heat-bar" style={{ width: `${c.difficulty * 100}%`,
            background: `linear-gradient(90deg, #34d399, #fbbf24 ${c.mortality * 100}%, #f43f5e)` }} />
          <span className="heat-mort">{Math.round(c.mortality * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

// Category icon for AI suggestion items.
function suggestIcon(category) {
  switch (category) {
    case 'balance': return '⚖️';
    case 'content': return '📦';
    case 'polish': return '✨';
    case 'accessibility': return '♿';
    default: return '💡';
  }
}

// Immutably set a value at a dotted path inside a config object.
// Used by the edit_config_field editor action to patch the live config
// without a full reload.
function patchField(obj, path, value) {
  const clone = structuredClone(obj || {});
  const keys = String(path || '').split('.');
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}
