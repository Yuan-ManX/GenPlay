/**
 * run_playbook - executes a task-level recipe as one agent action.
 *
 * Each step is dispatched through the orchestrator's runTool path so it gets
 * the same undo snapshots, editor actions and repair pipeline as a direct
 * call. A failed step is recorded and, unless stopOnError is set, the recipe
 * continues so a partial win is still delivered instead of an all-or-nothing
 * abort.
 */
import { PLAYBOOKS, getPlaybook, listPlaybooks } from '../core/playbooks.js';

export function runPlaybookTool({ orchestrator, tools } = {}) {
  return {
    name: 'run_playbook',
    description: '按已成型的创作剧本执行一组工具（打磨体验/发布验收/世界构建/手感调校），一次调用完成多步操作并汇总每步结果。',
    parameters: {
      type: 'object',
      properties: {
        playbook: {
          type: 'string',
          enum: PLAYBOOKS.map((p) => p.key),
          description: `剧本名称：${listPlaybooks().map((p) => `${p.key}(${p.label})`).join('、')}`,
        },
        gameId: { type: 'string', description: '目标游戏 ID' },
        stopOnError: { type: 'boolean', description: '任一步失败即中止，默认 false', default: false },
      },
      required: ['playbook', 'gameId'],
    },
    async execute({ playbook, gameId, stopOnError = false, sessionId } = {}) {
      const def = getPlaybook(playbook);
      if (!def) return { ok: false, error: `未知剧本：${playbook}` };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      // Prefer the orchestrator so steps get undo snapshots + trace recording;
      // fall back to the raw registry when the tool runs outside a session.
      const dispatch = orchestrator?.runTool
        ? (tool, args) => orchestrator.runTool(tool, args, { sessionId }, sessionId)
        : (tool, args) => tools.invoke(tool, args, { sessionId });

      const editorActions = [];
      const steps = [];
      let aborted = false;

      for (const step of def.steps) {
        if (aborted) {
          steps.push({ tool: step.tool, label: step.label, ok: false, skipped: true, error: '已跳过的后续步骤' });
          continue;
        }
        const startedAt = Date.now();
        const result = await dispatch(step.tool, { gameId, sessionId });
        const ok = !!result?.ok;
        steps.push({
          tool: step.tool,
          label: step.label,
          ok,
          summary: result?.summary || null,
          error: ok ? null : (result?.error || '执行失败'),
          durationMs: Date.now() - startedAt,
        });
        if (Array.isArray(result?.editorActions)) editorActions.push(...result.editorActions);
        if (!ok && stopOnError) aborted = true;
      }

      const done = steps.filter((s) => s.ok).length;
      const total = steps.length;
      const failed = steps.filter((s) => !s.ok && !s.skipped);
      return {
        ok: done > 0,
        playbook: def.key,
        playbookLabel: def.label,
        gameId,
        steps,
        editorActions,
        summary: [
          `剧本「${def.label}」执行完成：${done}/${total} 步成功。`,
          done < total ? `未完成步骤：${failed.map((s) => `${s.label}（${s.error}）`).join('；')}` : '全部步骤通过。',
        ].join(' '),
      };
    },
  };
}

export default runPlaybookTool;
