import { Router } from 'express';
import { CrewController } from '../controllers/CrewController.js';

export function crewRoutes(agentService) {
  const router = Router();
  const c = new CrewController(agentService);

  // Dispatch the multi-agent specialist crew for a creative brainstorm
  router.post('/dispatch', c.dispatch);

  return router;
}
