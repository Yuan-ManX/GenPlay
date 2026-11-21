import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const STATUS_LABELS = { draft: '草稿', published: '已发布' };

/**
 * LibraryPanel - workspace-level game library.
 * Closes the portability loop that the agent tools already support but the
 * studio had no entry for: export a game bundle, import one back, fork a copy,
 * publish, open the standalone build, or remove a work in progress.
 */
export default function LibraryPanel({ selectedGameId, onSelectGame, onGamesChange, flash }) {
  const [games, setGames] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importName, setImportName] = useState('');
  const [importing, setImporting] = useState(false);

  const load = async () => {
    try {
      const data = await api.listGames();
      setGames(data.games || []);
    } catch (e) { /* library unavailable */ }
  };

  useEffect(() => { load(); }, [selectedGameId]);

  const refresh = async () => {
    await load();
    onGamesChange?.();
  };

  const visible = games.filter((g) => {
    if (statusFilter !== 'all' && (g.status || 'draft') !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return String(g.name || '').toLowerCase().includes(q)
      || String(g.genre || '').toLowerCase().includes(q)
      || String(g.description || '').toLowerCase().includes(q);
  });

  // Download the exported bundle as a JSON file straight from the browser.
  const handleExport = async (game) => {
    setBusyId(game.id);
    try {
      const res = await api.exportGame(game.id);
      if (!res?.ok) { flash?.(res?.error || '导出失败'); return; }
      const json = res.bundleJson || JSON.stringify(res.bundle);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${game.name || game.id}.genplay.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash?.(res.summary || `已导出《${game.name}》`);
    } catch (e) {
      flash?.(`导出失败：${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemix = async (game) => {
    setBusyId(game.id);
    try {
      const res = await api.remixGame(game.id, { name: `${game.name} 副本` });
      if (res?.ok) {
        flash?.(res.summary || '已创建副本');
        await refresh();
        onSelectGame?.(res.game?.id || res.gameId);
      } else {
        flash?.(res?.error || '创建副本失败');
      }
    } catch (e) {
      flash?.(`创建副本失败：${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handlePublish = async (game) => {
    setBusyId(game.id);
    try {
      const res = await api.publishGame(game.id);
      flash?.(res?.summary || '已发布');
      await refresh();
    } catch (e) {
      flash?.(`发布失败：${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (game) => {
    if (!window.confirm(`确定删除《${game.name}》？此操作不可撤销。`)) return;
    setBusyId(game.id);
    try {
      await api.deleteGame(game.id);
      flash?.(`已删除《${game.name}》`);
      await refresh();
    } catch (e) {
      flash?.(`删除失败：${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const runImport = async (rawText) => {
    if (importing) return;
    const text = String(rawText || '').trim();
    if (!text) { flash?.('请粘贴游戏包 JSON 或选择文件'); return; }
    let bundle;
    try { bundle = JSON.parse(text); } catch { flash?.('游戏包 JSON 格式错误'); return; }
    setImporting(true);
    try {
      const res = await api.importGame(bundle, { newName: importName.trim() || undefined });
      if (res?.ok) {
        flash?.(res.summary || '导入成功');
        setPasteText('');
        setImportName('');
        setShowImport(false);
        await refresh();
        onSelectGame?.(res.game?.id);
      } else {
        flash?.(res?.error || '导入失败');
      }
    } catch (e) {
      flash?.(`导入失败：${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => runImport(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const draftCount = games.filter((g) => (g.status || 'draft') !== 'published').length;
  const publishedCount = games.length - draftCount;

  return (
    <section className="tab-section library-panel">
      <h4 className="tab-h">📚 作品库</h4>
      <p className="hub-sub">集中管理全部作品：导出游戏包备份、导入他人作品、派生副本、发布或清理草稿。</p>

      <div className="library-stats">
        <div className="library-stat"><strong>{games.length}</strong><span>作品总数</span></div>
        <div className="library-stat"><strong>{draftCount}</strong><span>草稿</span></div>
        <div className="library-stat"><strong>{publishedCount}</strong><span>已发布</span></div>
        <div className="library-stat">
          <strong>{new Set(games.map((g) => g.genre)).size}</strong><span>玩法类型</span>
        </div>
      </div>

      <div className="library-toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索名称 / 类型 / 描述"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
        </select>
        <button className="btn-primary" onClick={() => setShowImport((v) => !v)}>
          {showImport ? '收起导入' : '📥 导入游戏包'}
        </button>
      </div>

      {showImport && (
        <div className="library-import fade-in-slide">
          <div className="library-import-row">
            <input
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="导入后的名称（可选）"
            />
            <label className="btn-ghost library-file-label">
              📄 选择 .json 文件
              <input type="file" accept=".json,application/json" onChange={handleFile} hidden />
            </label>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="或直接粘贴游戏包 JSON（export_game 导出的内容）"
            rows={4}
          />
          <button className="btn-primary" onClick={() => runImport(pasteText)} disabled={importing || !pasteText.trim()}>
            {importing ? '导入中…' : '导入为新作品'}
          </button>
        </div>
      )}

      <div className="library-list">
        {visible.map((g) => (
          <div key={g.id} className={`library-item ${selectedGameId === g.id ? 'active' : ''}`}>
            <button className="library-item-main" onClick={() => onSelectGame?.(g.id)}>
              <div className="library-item-name">{g.name}</div>
              <div className="library-item-meta">
                <span className="library-badge">{g.genre || 'adventure'}</span>
                <span className={`library-status ${(g.status || 'draft') === 'published' ? 'published' : ''}`}>
                  {STATUS_LABELS[g.status] || g.status || '草稿'}
                </span>
                {typeof g.runCount === 'number' && <span>{g.runCount} 次运行</span>}
                {g.updatedAt && <span>{new Date(g.updatedAt).toLocaleDateString('zh-CN')}</span>}
              </div>
            </button>
            <div className="library-item-actions">
              <button className="chip" onClick={() => handleExport(g)} disabled={busyId === g.id}>⬇ 导出</button>
              <button className="chip" onClick={() => handleRemix(g)} disabled={busyId === g.id}>⧉ 副本</button>
              <a className="chip" href={api.playableUrl(g.id)} target="_blank" rel="noreferrer">▶ 试玩</a>
              {(g.status || 'draft') !== 'published' && (
                <button className="chip" onClick={() => handlePublish(g)} disabled={busyId === g.id}>🚀 发布</button>
              )}
              <button className="chip danger" onClick={() => handleDelete(g)} disabled={busyId === g.id}>🗑 删除</button>
            </div>
          </div>
        ))}
        {!visible.length && (
          <p className="hub-empty">
            {games.length ? '没有符合条件的作品，换个关键词试试。' : '还没有作品。先创建一款游戏，或导入一个游戏包。'}
          </p>
        )}
      </div>
    </section>
  );
}
