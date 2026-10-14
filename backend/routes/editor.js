import { Router } from 'express';
import { EditorController } from '../controllers/EditorController.js';
import { validateBody } from '../middlewares/validate.js';

export function editorRoutes(agentService) {
  const router = Router();
  const c = new EditorController(agentService);

  router.get('/tools', c.listTools);
  router.post('/action', validateBody({ required: ['tool'] }), c.runAction);
  router.post('/action/stream', validateBody({ required: ['tool'] }), c.runActionStream);
  router.post('/batch', c.runBatch);
  router.get('/suggestions/:gameId', c.suggestions);

  return router;
}
