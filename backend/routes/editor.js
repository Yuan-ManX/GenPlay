import { Router } from 'express';
import { EditorController } from '../controllers/EditorController.js';
import { validateBody } from '../middlewares/validate.js';

export function editorRoutes(agentService) {
  const router = Router();
  const c = new EditorController(agentService);

  router.get('/tools', c.listTools);
  router.post('/action', validateBody({ required: ['tool'] }), c.runAction);

  return router;
}
