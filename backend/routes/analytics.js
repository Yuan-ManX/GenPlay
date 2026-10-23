/**
 * Analytics routes - AI-native player behavior simulation.
 * Delegates to the game_analytics agent tool so retention, session,
 * difficulty, and drop-off modeling stays consistent across chat and API.
 */
import { Router } from 'express';

export function analyticsRoutes(agentService) {
  const router = Router();

  // GET /api/analytics/:gameId - return latest persisted report (if any)
  router.get('/:gameId', async (req, res, next) => {
    try {
      const { gameId } = req.params;
      const game = await agentService.gameService.getById(gameId);
      if (!game) return res.status(404).json({ ok: false, error: 'Game not found' });
      const latest = game.meta?.analytics?.latest || null;
      const history = game.meta?.analytics?.history?.length || 0;
      res.json({ ok: true, report: latest, reportCount: history });
    } catch (err) { next(err); }
  });

  // POST /api/analytics/:gameId/simulate - run a fresh simulation
  router.post('/:gameId/simulate', async (req, res, next) => {
    try {
      const { gameId } = req.params;
      const { seed, useLlm } = req.body || {};
      const data = await agentService.runTool({
        toolName: 'game_analytics',
        args: { gameId, seed, useLlm: useLlm !== false },
      });
      res.json({ ok: true, ...data });
    } catch (err) { next(err); }
  });

  return router;
}
