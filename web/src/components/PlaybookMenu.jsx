import { useState } from 'react';
import { api } from '../services/api.js';

// Mirrors agent/core/playbooks.js keys. Kept as a light client-side catalog so
// the editor can launch recipes without importing agent code into the bundle.
const RECIPES = [
  { key: 'polish', label: '打磨体验', icon: '✨', steps: '诊断 → 建议 → 平衡 → 试玩' },
  { key: 'ship', label: '发布验收', icon: '🚀', steps: '脚本 → 调试 → 无障碍 → 可玩版 → 发布' },
  { key: 'world', label: '世界构建', icon: '🌍', steps: '剧情 → 分支对话' },
  { key: 'feel', label: '手感调校', icon: '🎮', steps: '物理 → 操控 → 呈现' },
];

/**
 * PlaybookMenu - one-click task recipes from the editor header.
 * Runs the same agent tool the conversation uses, so results, undo snapshots
 * and editor actions stay identical across both entry points.
 */
export default function PlaybookMenu({ gameId, onFinished, flash, sessionId }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(null);
  const [last, setLast] = useState(null);

  const run = async (recipe) => {
    if (running) return;
    setRunning(recipe.key);
    setOpen(false);
    try {
      const res = await api.editorAction('run_playbook', { playbook: recipe.key, gameId }, sessionId);
      const result = res.result || res;
      const ok = result?.steps?.filter((s) => s.ok).length || 0;
      const total = result?.steps?.length || 0;
      setLast({ key: recipe.key, ok, total });
      flash?.(result?.summary || `${recipe.label}：${ok}/${total} 步完成`);
      onFinished?.(result);
    } catch (e) {
      flash?.(`${recipe.label}失败：${e.message}`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="pb-menu-wrap">
      <button
        className="btn-ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="执行多步创作剧本"
      >
        🎬 {running ? (RECIPES.find((r) => r.key === running)?.label || '执行中') + '…' : '剧本'}
      </button>
      {open && (
        <div className="pb-menu">
          {RECIPES.map((r) => (
            <button key={r.key} className="pb-item" onClick={() => run(r)} disabled={!!running}>
              <span className="pb-item-icon">{r.icon}</span>
              <span className="pb-item-text">
                <strong>{r.label}</strong>
                <em>{r.steps}</em>
              </span>
              {last?.key === r.key && (
                <span className={`pb-badge ${last.ok === last.total ? 'ok' : ''}`}>{last.ok}/{last.total}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
