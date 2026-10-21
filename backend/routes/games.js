import { Router } from 'express';
import { GameController } from '../controllers/GameController.js';
import { validateBody } from '../middlewares/validate.js';

export function gameRoutes(gameService, agentService) {
  const router = Router();
  const c = new GameController(gameService);

  // Helper to invoke an agent tool and return its result as JSON.
  // Used by the tool-backed REST sub-routes below.
  const invokeTool = async (req, res, toolName, argMapper) => {
    try {
      if (!agentService) return res.status(503).json({ error: 'Agent service not available' });
      const args = argMapper(req);
      const result = await agentService.runTool({
        toolName,
        args,
        sessionId: req.body?.sessionId,
      });
      res.json(result.result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // ---- Core CRUD ----
  router.get('/stats', c.stats);
  router.get('/', c.list);
  router.post('/', validateBody({ required: ['name'] }), c.create);

  // ---- Community published listing (before :id so not shadowed) ----
  router.get('/published', c.listPublished);
  router.get('/published/:shareCode', c.getPublished);
  router.post('/published/:shareCode/play', c.playPublished);
  router.post('/published/:shareCode/like', c.likePublished);

  // ---- Asset library endpoints ----
  router.get('/assets/themes', c.listThemes);
  router.get('/assets/scenarios', c.listScenarios);
  router.get('/assets/snippets', c.listSnippets);
  router.get('/assets/node-presets', c.listNodePresets);
  router.get('/assets/search', c.searchAssetLibrary);
  router.post('/assets/install-snippet', c.installSnippet);
  router.get('/assets/user', c.listAssets);
  router.post('/assets/user', c.createAsset);
  router.post('/assets/user/:id/install', c.installAsset);

  // ---- Tool-backed REST sub-routes (direct tool invocation, no /editor/action proxy) ----
  // Each endpoint wraps an agent tool so the frontend can use REST semantics.
  router.post('/:id/export', (req, res) => invokeTool(req, res, 'export_game', (r) => ({ gameId: r.params.id })));
  router.post('/:id/screenshot', (req, res) => invokeTool(req, res, 'screenshot_game', (r) => ({ gameId: r.params.id, label: r.body?.label })));
  router.post('/:id/remix', (req, res) => invokeTool(req, res, 'remix_game', (r) => ({ sourceGameId: r.params.id, name: r.body?.name, tweak: r.body?.tweak })));
  router.post('/:id/profile', (req, res) => invokeTool(req, res, 'profile_game', (r) => ({ gameId: r.params.id, duration: r.body?.duration })));
  router.post('/:id/playtest', (req, res) => invokeTool(req, res, 'play_test', (r) => ({ gameId: r.params.id, duration: r.body?.duration, seed: r.body?.seed })));
  router.post('/:id/lint', (req, res) => invokeTool(req, res, 'lint_scripts', (r) => ({ gameId: r.params.id, scope: r.body?.scope })));
  router.post('/:id/translate', (req, res) => invokeTool(req, res, 'translate_game', (r) => ({ gameId: r.params.id, targetLang: r.body?.targetLang, sourceLang: r.body?.sourceLang, scope: r.body?.scope })));
  router.post('/:id/balance', (req, res) => invokeTool(req, res, 'balance_game', (r) => ({ gameId: r.params.id, targetDifficulty: r.body?.targetDifficulty, duration: r.body?.duration, seed: r.body?.seed })));
  router.post('/:id/fun-factor', (req, res) => invokeTool(req, res, 'analyze_fun_factor', (r) => ({ gameId: r.params.id })));
  router.post('/:id/tutorial', (req, res) => invokeTool(req, res, 'generate_tutorial', (r) => ({ gameId: r.params.id, steps: r.body?.steps, style: r.body?.style })));
  router.post('/:id/dialogue-tree', (req, res) => invokeTool(req, res, 'generate_dialogue_tree', (r) => ({ gameId: r.params.id, character: r.body?.character, topic: r.body?.topic, branches: r.body?.branches, depth: r.body?.depth, title: r.body?.title })));
  router.post('/:id/compose-music', (req, res) => invokeTool(req, res, 'compose_music', (r) => ({ gameId: r.params.id, moods: r.body?.moods, mood: r.body?.mood, seed: r.body?.seed, bars: r.body?.bars })));
  router.post('/:id/undo', (req, res) => invokeTool(req, res, 'undo_redo', (r) => ({ gameId: r.params.id, action: 'undo' })));
  router.post('/:id/redo', (req, res) => invokeTool(req, res, 'undo_redo', (r) => ({ gameId: r.params.id, action: 'redo' })));
  router.get('/:id/history', (req, res) => invokeTool(req, res, 'undo_redo', (r) => ({ gameId: r.params.id, action: 'history' })));

  // ---- By-id endpoints (must come after tool-backed sub-routes) ----
  router.get('/:id', c.getById);
  router.put('/:id', c.update);
  router.patch('/:id', c.update);
  router.post('/:id/run', c.run);
  router.post('/:id/publish', c.publish);
  router.post('/:id/multiplayer', c.setMultiplayer);
  router.delete('/:id', c.remove);

  return router;
}
