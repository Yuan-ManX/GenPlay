import { Router } from 'express';
import { GameController } from '../controllers/GameController.js';
import { validateBody } from '../middlewares/validate.js';

export function gameRoutes(gameService) {
  const router = Router();
  const c = new GameController(gameService);

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

  // ---- By-id endpoints ----
  router.get('/:id', c.getById);
  router.put('/:id', c.update);
  router.patch('/:id', c.update);
  router.post('/:id/run', c.run);
  router.post('/:id/publish', c.publish);
  router.post('/:id/multiplayer', c.setMultiplayer);
  router.delete('/:id', c.remove);

  return router;
}
