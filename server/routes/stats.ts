import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/stats/overview - Dashboard stats
router.get('/overview', authMiddleware(['MAIN_ADMIN', 'ADMIN', 'SUPPORT']), (req: AuthenticatedRequest, res: Response) => {
  const customers = db.getCustomers();
  const licenses = db.getLicenses();
  const requests = db.getLicenseRequests();
  const activities = db.getActivities();
  const packs = db.getProductPacks();
  const versions = db.getProductPackVersions();
  const products = db.getProducts();

  const activeLicenses = licenses.filter(l => l.status === 'active');
  const expiredLicenses = licenses.filter(l => l.status === 'expired');
  const suspendedLicenses = licenses.filter(l => l.status === 'suspended');
  const pendingRequests = requests.filter(r => r.status === 'pending');

  const totalDevices = licenses.reduce((sum, l) => sum + (l.devices?.filter(d => d.status === 'active').length || 0), 0);

  // Licenses by plan
  const planDistribution = {
    trial: licenses.filter(l => l.plan === 'trial').length,
    basic: licenses.filter(l => l.plan === 'basic').length,
    pro: licenses.filter(l => l.plan === 'pro').length,
    enterprise: licenses.filter(l => l.plan === 'enterprise').length
  };

  // Wilaya distribution (Top wilayas)
  const wilayaCounts: Record<string, { name: string; count: number }> = {};
  customers.forEach(c => {
    if (!wilayaCounts[c.wilaya_code]) {
      wilayaCounts[c.wilaya_code] = { name: c.wilaya_name, count: 0 };
    }
    wilayaCounts[c.wilaya_code].count += 1;
  });

  const topWilayas = Object.entries(wilayaCounts)
    .map(([code, val]) => ({ code, name: val.name, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Recent sync & activity timeline
  const recentAudit = db.getAuditLogs().slice(0, 10);

  res.json({
    success: true,
    data: {
      metrics: {
        total_customers: customers.length,
        active_customers: customers.filter(c => c.status === 'active').length,
        total_licenses: licenses.length,
        active_licenses: activeLicenses.length,
        expired_licenses: expiredLicenses.length,
        suspended_licenses: suspendedLicenses.length,
        pending_requests: pendingRequests.length,
        total_active_devices: totalDevices,
        total_activities: activities.length,
        total_product_packs: packs.length,
        total_versions: versions.length,
        total_products: products.length
      },
      plan_distribution: planDistribution,
      top_wilayas: topWilayas,
      recent_audit_logs: recentAudit,
      server_health: {
        uptime_seconds: Math.floor(process.uptime()),
        node_version: process.version,
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: new Date().toISOString()
      }
    }
  });
});

export default router;
