import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import { BusinessActivity } from '../../src/types/dzpos.js';

const router = Router();

// GET /api/activities - List all activities
router.get('/', (req, res) => {
  const { status } = req.query;
  let activities = [...db.getActivities()];

  if (status === 'active') {
    activities = activities.filter(a => a.status === 'active');
  }

  // Calculate live product count and latest version
  const enriched = activities.map(act => {
    const actProducts = db.getProducts().filter(p => p.activity_code === act.code);
    const versions = db.getProductPackVersions().filter(v => v.activity_code === act.code && v.status === 'published');
    const maxVer = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : act.latest_pack_version || 0;
    return {
      ...act,
      total_products: actProducts.length,
      latest_pack_version: maxVer
    };
  }).sort((a, b) => a.sort_order - b.sort_order);

  res.json({
    success: true,
    data: enriched,
    count: enriched.length
  });
});

// GET /api/activities/:code - Single activity details
router.get('/:code', (req, res) => {
  const activity = db.getActivities().find(a => a.code === req.params.code || a.id === req.params.code);
  if (!activity) {
    return apiError(res, 404, 'ACTIVITY_NOT_FOUND', 'Business activity not found');
  }

  const versions = db.getProductPackVersions().filter(v => v.activity_code === activity.code);
  const products = db.getProducts().filter(p => p.activity_code === activity.code);
  const customers = db.getCustomers().filter(c => c.activity_code === activity.code);

  res.json({
    success: true,
    data: {
      activity,
      pack_versions: versions,
      total_products: products.length,
      active_customers_count: customers.length
    }
  });
});

// POST /api/activities - Create new activity
router.post('/', authMiddleware(['MAIN_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { code, name_ar, name_fr, name_en, icon = 'Store', sort_order = 99 } = req.body;

  if (!code || !name_ar || !name_fr) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Missing required fields: code, name_ar, name_fr');
  }

  const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const exists = db.getActivities().some(a => a.code === cleanCode);
  if (exists) {
    return apiError(res, 400, 'DUPLICATE_KEY', `Activity with code '${cleanCode}' already exists`);
  }

  const newActivity: BusinessActivity = {
    id: `act_${cleanCode}`,
    code: cleanCode,
    name_ar: name_ar.trim(),
    name_fr: name_fr.trim(),
    name_en: name_en ? name_en.trim() : name_fr.trim(),
    icon,
    status: 'active',
    sort_order: parseInt(sort_order, 10) || 99,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    latest_pack_version: 0,
    total_products: 0
  };

  db.getActivities().push(newActivity);
  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'MAIN_ADMIN',
    'ACTIVITY_CREATED',
    'activities',
    newActivity.code,
    { name_ar: newActivity.name_ar, name_fr: newActivity.name_fr },
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'Business activity created successfully',
    data: newActivity
  });
});

// PUT /api/activities/:code - Update activity
router.put('/:code', authMiddleware(['MAIN_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const activity = db.getActivities().find(a => a.code === req.params.code || a.id === req.params.code);
  if (!activity) {
    return apiError(res, 404, 'ACTIVITY_NOT_FOUND', 'Business activity not found');
  }

  const { name_ar, name_fr, name_en, icon, sort_order, status } = req.body;

  if (name_ar) activity.name_ar = name_ar.trim();
  if (name_fr) activity.name_fr = name_fr.trim();
  if (name_en !== undefined) activity.name_en = name_en.trim();
  if (icon) activity.icon = icon;
  if (sort_order !== undefined) activity.sort_order = parseInt(sort_order, 10);
  if (status && ['active', 'disabled'].includes(status)) {
    activity.status = status as 'active' | 'disabled';
  }

  activity.version += 1;
  activity.updated_at = new Date().toISOString();
  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'MAIN_ADMIN',
    'ACTIVITY_UPDATED',
    'activities',
    activity.code,
    { updated_fields: Object.keys(req.body) },
    req.ip
  );

  res.json({
    success: true,
    message: 'Business activity updated successfully',
    data: activity
  });
});

// DELETE /api/activities/:code - Delete activity (if no customers or products exist)
router.delete('/:code', authMiddleware(['MAIN_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const index = db.getActivities().findIndex(a => a.code === req.params.code || a.id === req.params.code);
  if (index === -1) {
    return apiError(res, 404, 'ACTIVITY_NOT_FOUND', 'Business activity not found');
  }

  const activity = db.getActivities()[index];
  const linkedCustomers = db.getCustomers().some(c => c.activity_code === activity.code);
  if (linkedCustomers) {
    return apiError(res, 400, 'FORBIDDEN', 'Cannot delete activity linked to existing customers. Disable it instead.');
  }

  db.getActivities().splice(index, 1);
  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'MAIN_ADMIN',
    'ACTIVITY_DELETED',
    'activities',
    activity.code,
    { code: activity.code, name_fr: activity.name_fr },
    req.ip
  );

  res.json({
    success: true,
    message: `Activity ${activity.code} deleted successfully`
  });
});

export default router;
