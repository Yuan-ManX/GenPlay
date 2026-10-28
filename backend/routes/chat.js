import { Router } from 'express';
import { ChatController } from '../controllers/ChatController.js';
import { validateBody } from '../middlewares/validate.js';

export function chatRoutes(agentService) {
  const router = Router();
  const c = new ChatController(agentService);

  router.get('/tools', c.listTools);
  router.get('/sessions', c.listSessions);
  // Long-term memory recall endpoint (wraps the recall_memory agent tool).
  router.get('/memory/recall', async (req, res) => {
    try {
      const result = await agentService.runTool({
        toolName: 'recall_memory',
        args: {
          query: req.query.q || '',
          scope: req.query.scope || 'all',
          limit: Number(req.query.limit) || 6,
        },
        sessionId: req.query.sessionId,
      });
      res.json(result.result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  router.get('/sessions/:id', c.getSession);
  router.post('/sessions/:id/reset', c.reset);
  router.delete('/sessions/:id', c.deleteSession);
  router.post('/', validateBody({ required: ['message'] }), c.chat);
  // SSE streaming chat: lifecycle events (plan/tool_start/tool_end/reply/done).
  router.post('/stream', validateBody({ required: ['message'] }), c.stream);

  return router;
}
