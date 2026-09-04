/**
 * dispatch_crew - multi-agent specialist team tool.
 * Spins up the GenPlay SpecialistCrew (NarrativeArchitect, VisualDirector,
 * MechanicsEngineer, QualityCritic) to co-design a creative blueprint from a
 * user brief. Each specialist proposes a slice in parallel; the merged
 * blueprint is surfaced to the studio and can optionally be auto-applied
 * (create_game + apply_style_theme + apply_scenario) in one shot.
 *
 * This tool is the entry point that lets the orchestrator hand a complex
 * creative brief to a coordinated team rather than a single planner.
 */
import { SpecialistCrew } from '../core/crew.js';

export function dispatchCrewTool({ gameService, provider, assetLibrary } = {}) {
  // Crew is cheap to construct (no I/O), so we hold a single shared instance
  // and inject the live provider/assetLibrary at call time.
  const crew = new SpecialistCrew({ provider, assetLibrary });
  return {
    name: 'dispatch_crew',
    description: '召集多智能体创作团（叙事/视觉/机制/评审）对一个创作简报进行协同构思，输出结构化创意蓝图，可选自动落地。',
    parameters: {
      type: 'object',
      properties: {
        brief: { type: 'string', description: '创作简报（用户想做什么游戏/方向）' },
        genre: { type: 'string', description: '可选：指定主类型，否则由简报推断' },
        gameId: { type: 'string', description: '可选：聚焦已有游戏，蓝图围绕它展开' },
        autoApply: { type: 'boolean', description: '是否自动落地蓝图（创建+主题+场景）', default: false },
      },
    },
    async execute({ brief = '', genre, gameId, autoApply = false } = {}) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      // Keep crew wired to the latest services (provider may be set after boot)
      crew.provider = provider;
      crew.assetLibrary = assetLibrary;

      let focusGame = null;
      if (gameId) focusGame = await gameService.getById(gameId);
      const ctx = {
        genre,
        gameId,
        title: focusGame?.name,
        brief,
      };
      const { blueprint, specialists, genre: pickedGenre } = await crew.run(brief, ctx);

      const editorActions = [
        { type: 'studio:crew-blueprint', payload: { genre: pickedGenre, blueprint, specialists } },
      ];

      let applied = null;
      if (autoApply && blueprint.ready) {
        // Cascade: create (or reuse) game, then apply theme + scenario.
        // We delegate to the sibling tools via the shared services so the
        // same execution chain + editor actions fire as if the user asked.
        // Each step is guarded so a partial failure still returns the blueprint
        // + whatever was applied, rather than throwing the whole call.
        applied = [];
        let targetGame = focusGame;
        try {
          if (!targetGame) {
            const tpl = (await import('../templates/gameTemplates.js')).getTemplate(pickedGenre);
            targetGame = await gameService.create({
              name: blueprint.title,
              genre: pickedGenre,
              description: brief,
              platform: 'web',
              status: 'draft',
              config: structuredClone(blueprint.mechanics?.config || {}),
              scripts: tpl?.scripts || '',
            });
          }
          applied.push({ step: 'create_game', gameId: targetGame.id });
          editorActions.push({ type: 'studio:select-game', payload: { gameId: targetGame.id, name: targetGame.name, genre: pickedGenre } });
          editorActions.push({ type: 'sidebar:refresh-list', payload: { reason: 'crew-create' } });
        } catch (e) {
          applied.push({ step: 'create_game', error: e.message });
        }
        if (targetGame && blueprint.visual?.themeKey) {
          try {
            await gameService.update(targetGame.id, { theme: blueprint.visual.themeKey });
            applied.push({ step: 'apply_theme', themeKey: blueprint.visual.themeKey });
            editorActions.push({ type: 'studio:set-theme', gameId: targetGame.id, payload: { theme: blueprint.visual.themeKey, palette: blueprint.visual.palette } });
          } catch (e) {
            applied.push({ step: 'apply_theme', error: e.message });
          }
        }
        if (targetGame && blueprint.narrative?.scenarioKey) {
          try {
            await gameService.update(targetGame.id, { scenario: blueprint.narrative.scenarioKey });
            applied.push({ step: 'apply_scenario', scenarioKey: blueprint.narrative.scenarioKey });
            editorActions.push({ type: 'studio:set-scenario', gameId: targetGame.id, payload: { scenario: blueprint.narrative.scenarioKey } });
          } catch (e) {
            applied.push({ step: 'apply_scenario', error: e.message });
          }
        }
        const okCount = applied.filter((s) => !s.error).length;
        return {
          ok: true, blueprint, specialists, applied,
          game: targetGame, gameId: targetGame?.id,
          editorActions,
          summary: targetGame
            ? `创作团已构思《${blueprint.title}》蓝图并自动落地为新游戏（ID：${targetGame.id}），${okCount}/${applied.length} 步成功。`
            : `创作团已构思《${blueprint.title}》蓝图，但自动落地失败：${applied.find((s) => s.error)?.error}`,
        };
      }

      return {
        ok: true, blueprint, specialists,
        editorActions,
        summary: `多智能体创作团完成《${blueprint.title}》构思：${specialists.map((s) => `${s.role}`).join('、')} 协同出案，评审分 ${blueprint.critique?.score?.toFixed?.(2) || 'N/A'}。回复"落地这个蓝图"即可一键创建。`,
      };
    },
  };
}

export default dispatchCrewTool;
