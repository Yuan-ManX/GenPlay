import { Router } from 'express';
import { CommunityController } from '../controllers/CommunityController.js';

export function communityRoutes(agentService) {
  const router = Router();
  const c = new CommunityController(agentService);

  // Community game gallery listing
  router.get('/', c.list);
  // Comments for one work
  router.get('/:id/comments', c.comments);
  router.post('/:id/comments', c.addComment);
  // Interaction counters
  router.post('/:id/like', c.like);
  router.post('/:id/play', c.play);
  // Remix a community game into a fresh editable draft
  router.post('/:id/remix', c.remix);
  // Work detail (stats + comments)
  router.get('/:id', c.detail);

  return router;
}
