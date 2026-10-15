import { Router } from 'express';
import { TemplateController } from '../controllers/TemplateController.js';

export function templateRoutes(agentService) {
  const router = Router();
  const c = new TemplateController(agentService);

  // List available genre templates
  router.get('/', c.list);
  // Apply a template to create a new game
  router.post('/:genre/apply', c.apply);

  return router;
}
