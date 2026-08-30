import { Router, Response } from 'express';
import { db, generateSecureLicenseKey } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import { License, LicensePlan, LicenseStatus } from '../../src/types/dzpos.js';

const router = Router();

// GET /api/licenses - List all licenses with filter by status, plan, customer
router.get('/', authMiddleware(['MAIN_ADMIN', 'ADMIN', 'SUPPORT']), (req: AuthenticatedRequest, res: Response) => {
  const { status, plan, customer_id, search, expiring_soon } = req.query;

  let licenses = [...db.getLicenses()];

  if (status && typeof status === 'string') {
    licenses = licenses.filter(l => l.status === status);
  }
  if (plan && typeof plan === 'string') {
    licenses = licenses.filter(l => l.plan === plan);
  }
  if (customer_id && typeof customer_id === 'string') {
    licenses = licenses.filter(l => l.customer_id === customer_id);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    licenses = licenses.filter(l =>
      l.license_key.toLowerCase().includes(q) ||
      l.customer_name.toLowerCase().includes(q) ||
      l.business_name.toLowerCase().includes(q)
    );
  }
  if (expiring_soon === 'true') {
    const now = Date.now();
    const fifteenDaysFromNow = now + 15 * 86400000;
    licenses = licenses.filter(l => {
      const exp = new Date(l.expires_at).getTime();
      return exp > now && exp <= fifteenDaysFromNow && l.status === 'active';
    });
  }

  res.json({
    success: true,
    data: licenses,
    count: licenses.length
  });
});

// GET /api/licenses/:id - License detail
router.get('/:id', authMiddleware(['MAIN_ADMIN', 'ADMIN', 'SUPPORT']), (req: AuthenticatedRequest, res: Response) => {
  const license = db.getLicenses().find(l => l.license_id === req.params.id || l.license_key === req.params.id);
  if (!license) {
    return apiError(res, 404, 'INVALID_LICENSE', 'License not found');
  }

  const customer = db.getCustomers().find(c => c.id === license.customer_id);

  res.json({
    success: true,
    data: {
      license,
      customer
    }
  });
});

// POST /api/licenses - Create / Issue a new license
router.post('/', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const {
    customer_id,
    plan = 'pro',
    duration_days = 365,
    custom_key,
    max_devices,
    device_id,
    device_name = 'POS Terminal',
    os = 'Android POS',
    notes,
    features
  } = req.body;

  if (!customer_id) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'customer_id is required');
  }

  const customer = db.getCustomers().find(c => c.id === customer_id);
  if (!customer) {
    return apiError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  const settings = db.getSettings();
  let defaultDevices = settings.max_devices_pro;
  if (plan === 'trial') defaultDevices = settings.max_devices_trial;
  if (plan === 'basic') defaultDevices = settings.max_devices_basic;
  if (plan === 'enterprise') defaultDevices = settings.max_devices_enterprise;

  const licenseKey = custom_key && custom_key.trim() ? custom_key.trim().toUpperCase() : generateSecureLicenseKey(plan as LicensePlan);

  // Check key uniqueness
  const keyExists = db.getLicenses().some(l => l.license_key === licenseKey);
  if (keyExists) {
    return apiError(res, 400, 'DUPLICATE_KEY', 'License key already exists in database');
  }

  const now = new Date();
  const expiresDate = new Date(now.getTime() + (parseInt(duration_days, 10) || 365) * 86400000);

  const defaultFeatures = ['pos_standard', 'offline_sync', 'barcode_scanner'];
  if (plan === 'pro' || plan === 'enterprise') {
    defaultFeatures.push('multi_device', 'inventory_reports', 'promotions', 'customer_loyalty');
  }
  if (plan === 'enterprise') {
    defaultFeatures.push('multi_branch', 'custom_exports', 'api_access');
  }

  const newLicense: License = {
    license_id: `lic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    license_key: licenseKey,
    customer_id: customer.id,
    customer_name: customer.name,
    business_name: customer.business_name,
    activity_code: customer.activity_code,
    plan: (plan as LicensePlan) || 'pro',
    status: 'active',
    max_devices: max_devices ? parseInt(max_devices, 10) : defaultDevices,
    devices: [],
    created_at: now.toISOString(),
    activated_at: now.toISOString(),
    expires_at: expiresDate.toISOString(),
    features: Array.isArray(features) ? features : defaultFeatures,
    notes: notes ? notes.trim() : undefined
  };

  if (device_id && device_id.trim()) {
    newLicense.devices.push({
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      license_id: newLicense.license_id,
      device_id: device_id.trim(),
      device_name: device_name || 'POS Terminal',
      os: os || 'Android POS',
      app_version: 'v2.4.0',
      ip_address: req.ip,
      activated_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      status: 'active'
    });
    customer.device_count = (customer.device_count || 0) + 1;
  }

  db.getLicenses().unshift(newLicense);
  customer.active_license_key = licenseKey;
  customer.updated_at = now.toISOString();
  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'LICENSE_CREATED',
    'licenses',
    newLicense.license_id,
    { key: licenseKey, customer: customer.name, plan, expires_at: newLicense.expires_at },
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'License created and activated successfully',
    data: newLicense
  });
});

// POST /api/licenses/:id/extend - Extend license duration
router.post('/:id/extend', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const license = db.getLicenses().find(l => l.license_id === req.params.id || l.license_key === req.params.id);
  if (!license) {
    return apiError(res, 404, 'INVALID_LICENSE', 'License not found');
  }

  const { additional_days = 365, notes } = req.body;
  const currentExpiry = new Date(license.expires_at).getTime();
  const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
  const newExpiry = new Date(baseTime + (parseInt(additional_days, 10) || 365) * 86400000);

  const oldExpiry = license.expires_at;
  license.expires_at = newExpiry.toISOString();
  if (license.status === 'expired') {
    license.status = 'active';
  }
  if (notes) {
    license.notes = `${license.notes || ''}\n[Extended +${additional_days}d by ${req.user?.username} on ${new Date().toLocaleDateString()}]: ${notes}`.trim();
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'LICENSE_EXTENDED',
    'licenses',
    license.license_id,
    { oldExpiry, newExpiry: license.expires_at, additional_days },
    req.ip
  );

  res.json({
    success: true,
    message: `License extended by ${additional_days} days`,
    data: license
  });
});

// PATCH /api/licenses/:id/status - Change status (active, suspended, revoked)
router.patch('/:id/status', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const license = db.getLicenses().find(l => l.license_id === req.params.id || l.license_key === req.params.id);
  if (!license) {
    return apiError(res, 404, 'INVALID_LICENSE', 'License not found');
  }

  const { status, reason } = req.body;
  if (!status || !['active', 'suspended', 'revoked', 'expired', 'pending'].includes(status)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Invalid license status');
  }

  const oldStatus = license.status;
  license.status = status as LicenseStatus;
  if (reason) {
    license.notes = `${license.notes || ''}\n[Status changed to ${status} on ${new Date().toLocaleDateString()}]: ${reason}`.trim();
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    `LICENSE_STATUS_${status.toUpperCase()}`,
    'licenses',
    license.license_id,
    { oldStatus, newStatus: status, reason },
    req.ip
  );

  res.json({
    success: true,
    message: `License status changed to ${status}`,
    data: license
  });
});

// DELETE /api/licenses/:id/devices/:deviceId - Unbind / kick a device from license
router.delete('/:id/devices/:deviceId', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const license = db.getLicenses().find(l => l.license_id === req.params.id || l.license_key === req.params.id);
  if (!license) {
    return apiError(res, 404, 'INVALID_LICENSE', 'License not found');
  }

  const deviceIndex = license.devices.findIndex(d => d.device_id === req.params.deviceId || d.id === req.params.deviceId);
  if (deviceIndex === -1) {
    return apiError(res, 404, 'DEVICE_NOT_AUTHORIZED', 'Device not found on this license');
  }

  const [removed] = license.devices.splice(deviceIndex, 1);
  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'DEVICE_UNBOUND',
    'license_devices',
    removed.device_id,
    { license_id: license.license_id, device_name: removed.device_name },
    req.ip
  );

  res.json({
    success: true,
    message: `Device ${removed.device_name || removed.device_id} unbound successfully`,
    data: license
  });
});

export default router;
