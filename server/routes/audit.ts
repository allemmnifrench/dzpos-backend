import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/audit - Search and list audit logs
router.get('/', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { action, entity, actor, search, limit = '100' } = req.query;

  let logs = [...db.getAuditLogs()];

  if (action && typeof action === 'string') {
    logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
  }
  if (entity && typeof entity === 'string') {
    logs = logs.filter(l => l.entity === entity);
  }
  if (actor && typeof actor === 'string') {
    logs = logs.filter(l => l.actor === actor);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    logs = logs.filter(l =>
      l.action.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      l.entity_id.toLowerCase().includes(q) ||
      l.actor.toLowerCase().includes(q) ||
      (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
    );
  }

  const l = parseInt(limit as string, 10) || 100;

  res.json({
    success: true,
    data: logs.slice(0, l),
    total: logs.length
  });
});

export default router;
