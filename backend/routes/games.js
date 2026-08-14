import { Router } from 'express';
import { GameController } from '../controllers/GameController.js';
import { validateBody } from '../middlewares/validate.js';

export function gameRoutes(gameService) {
  const router = Router();
  const c = new GameController(gameService);

  router.get('/', c.list);
  router.get('/stats', c.stats);
  router.post('/', validateBody({ required: ['name'] }), c.create);
  router.get('/:id', c.getById);
  router.put('/:id', c.update);
  router.post('/:id/run', c.run);
  router.delete('/:id', c.remove);

  return router;
}
