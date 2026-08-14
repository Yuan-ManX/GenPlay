import { Router } from 'express';
import { ChatController } from '../controllers/ChatController.js';
import { validateBody } from '../middlewares/validate.js';

export function chatRoutes(agentService) {
  const router = Router();
  const c = new ChatController(agentService);

  router.get('/sessions', c.listSessions);
  router.get('/sessions/:id', c.getSession);
  router.post('/sessions/:id/reset', c.reset);
  router.post('/', validateBody({ required: ['message'] }), c.chat);

  return router;
}
