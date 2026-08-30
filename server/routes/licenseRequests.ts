import { Router, Request, Response } from 'express';
import { db, WILAYAS_DZ, generateSecureLicenseKey } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import { LicenseRequest, LicensePlan, LicenseRequestStatus, Customer, License } from '../../src/types/dzpos.js';

const router = Router();

// GET /api/license-requests - List requests
router.get('/', authMiddleware(['MAIN_ADMIN', 'ADMIN', 'SUPPORT']), (req: AuthenticatedRequest, res: Response) => {
  const { status, plan, search } = req.query;

  let requests = [...db.getLicenseRequests()];

  if (status && typeof status === 'string') {
    requests = requests.filter(r => r.status === status);
  }
  if (plan && typeof plan === 'string') {
    requests = requests.filter(r => r.requested_plan === plan);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    requests = requests.filter(r =>
      r.customer_name.toLowerCase().includes(q) ||
      r.business_name.toLowerCase().includes(q) ||
      r.phone.includes(q)
    );
  }

  res.json({
    success: true,
    data: requests,
    count: requests.length,
    pending_count: db.getLicenseRequests().filter(r => r.status === 'pending').length
  });
});

// Helper to determine request source (موقع / هاتف / لوحة الإدارة)
function parseRequestSource(body: any, req: Request): { source: 'website' | 'phone' | 'admin' | string; source_label: string } {
  const rawSource = (
    body.source ||
    body.source_type ||
    body.channel ||
    body.origin_source ||
    body.from ||
    body.platform ||
    req.headers['x-request-source'] ||
    req.headers['x-source'] ||
    ''
  ).toString().trim().toLowerCase();

  if (
    rawSource === 'website' ||
    rawSource === 'web' ||
    rawSource === 'landing' ||
    rawSource === 'landing_page' ||
    rawSource === 'lovable' ||
    rawSource === 'site' ||
    rawSource.includes('موقع') ||
    rawSource.includes('صفحة')
  ) {
    return { source: 'website', source_label: 'موقع (صفحة الهبوط)' };
  }

  if (
    rawSource === 'phone' ||
    rawSource === 'mobile' ||
    rawSource === 'pos' ||
    rawSource === 'app' ||
    rawSource === 'android' ||
    rawSource === 'terminal' ||
    rawSource.includes('هاتف') ||
    rawSource.includes('كاسة')
  ) {
    return { source: 'phone', source_label: 'هاتف (تطبيق الكاسة)' };
  }

  if (rawSource === 'admin' || rawSource.includes('لوحة')) {
    return { source: 'admin', source_label: 'لوحة الإدارة' };
  }

  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const referer = (req.headers['referer'] || req.headers['origin'] || '').toLowerCase();

  if ((body.device_id || body.hardware_id) && !referer.includes('http')) {
    return { source: 'phone', source_label: 'هاتف (تطبيق الكاسة)' };
  }

  if (referer.includes('http') || userAgent.includes('mozilla') || userAgent.includes('chrome') || userAgent.includes('safari')) {
    return { source: 'website', source_label: 'موقع (صفحة الهبوط)' };
  }

  if (body.device_id || body.hardware_id) {
    return { source: 'phone', source_label: 'هاتف (تطبيق الكاسة)' };
  }

  return { source: 'website', source_label: 'موقع (صفحة الهبوط)' };
}

// POST /api/license-requests - Submit request (Can be called from POS App directly or Admin)
const handleLicenseRequestSubmission = (req: Request, res: Response) => {
  const {
    customer_id,
    customer_name,
    name,
    manager_name,
    client_name,
    phone,
    mobile,
    telephone,
    email,
    business_name,
    store_name,
    company_name,
    activity_code,
    activity,
    wilaya_code = '16',
    requested_plan,
    plan,
    plan_type,
    tier,
    subscription_type,
    requested_duration_days = 365,
    duration_days,
    device_count,
    devices_count,
    requested_devices,
    device_id,
    hardware_id,
    device_name,
    os,
    app_version,
    version,
    source,
    source_type,
    channel,
    notes
  } = req.body;

  const sourceInfo = parseRequestSource(req.body, req);

  const finalName = (customer_name || name || manager_name || client_name || 'عميل كاسة').trim();
  const finalPhone = (phone || mobile || telephone || '0550000000').trim();
  const finalBusiness = (business_name || store_name || company_name || 'محل تجاري').trim();
  let finalActivity = (activity_code || activity || 'grocery').trim();

  // Alias common activity names
  if (finalActivity === 'supermarket') finalActivity = 'grocery';
  if (finalActivity === 'retail') finalActivity = 'clothing';

  let rawPlan = (requested_plan || plan || plan_type || subscription_type || tier || 'pro').toLowerCase();
  if (rawPlan === 'annual') rawPlan = 'yearly';
  const finalPlan = rawPlan as LicensePlan;
  const isLifetime = finalPlan === 'lifetime';

  const wilaya = WILAYAS_DZ.find(w => w.code === wilaya_code) || WILAYAS_DZ.find(w => w.code === '16');
  const numDevices = Math.max(1, parseInt(device_count || devices_count || requested_devices || '1', 10));

  const newRequest: LicenseRequest = {
    request_id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    customer_id: customer_id || undefined,
    customer_name: finalName,
    phone: finalPhone,
    email: email ? email.trim() : undefined,
    business_name: finalBusiness,
    activity_code: finalActivity,
    wilaya_code: wilaya ? wilaya.code : '16',
    wilaya_name: wilaya ? wilaya.name : 'Alger',
    requested_plan: finalPlan,
    subscription_type: isLifetime ? 'lifetime' : 'yearly',
    requested_devices: numDevices,
    requested_duration_days: isLifetime ? undefined : (parseInt(duration_days || requested_duration_days, 10) || 365),
    device_id: (device_id || hardware_id ? (device_id || hardware_id).trim() : undefined),
    device_name: (device_name || 'POS Station').trim(),
    os: (os || 'Android / Windows POS').trim(),
    app_version: (app_version || version || '3.0').trim(),
    source: sourceInfo.source,
    source_label: sourceInfo.source_label,
    notes: notes ? notes.trim() : undefined,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  db.getLicenseRequests().unshift(newRequest);
  db.save();

  db.addAuditLog(
    'system_pos_client',
    'POS_CLIENT',
    'LICENSE_REQUEST_SUBMITTED',
    'license_requests',
    newRequest.request_id,
    { customer: newRequest.customer_name, business: newRequest.business_name, plan: finalPlan, source: sourceInfo.source, source_label: sourceInfo.source_label },
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'تم تقديم طلب الترخيص بنجاح. سيقوم فريقنا بمراجعته وتفعيله قريباً.',
    request_id: newRequest.request_id,
    order_id: newRequest.request_id,
    source: sourceInfo.source,
    source_label: sourceInfo.source_label,
    data: newRequest
  });
};

router.post('/', handleLicenseRequestSubmission);
router.post('/request', handleLicenseRequestSubmission);
router.post('/orders', handleLicenseRequestSubmission);
router.post('/order', handleLicenseRequestSubmission);

// POST /api/license-requests/:id/approve - Approve and auto-issue License
router.post('/:id/approve', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const request = db.getLicenseRequests().find(r => r.request_id === req.params.id);
  if (!request) {
    return apiError(res, 404, 'VALIDATION_ERROR', 'License request not found');
  }

  if (request.status === 'approved') {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Request has already been approved');
  }

  const { plan, duration_days, custom_key, max_devices, admin_notes, device_id, device_name, os, app_version } = req.body;
  const finalPlan: LicensePlan = (plan as LicensePlan) || request.requested_plan || 'pro';
  const finalDuration = duration_days ? parseInt(duration_days, 10) : request.requested_duration_days || 365;
  const finalDeviceId = (device_id || request.device_id || '').trim();
  const finalDeviceName = (device_name || request.device_name || 'POS Terminal').trim();
  const finalOs = (os || request.os || 'Windows / Android POS').trim();
  const finalAppVersion = (app_version || request.app_version || 'v3.0').trim();

  // 1. Locate or create Customer
  let customer = request.customer_id ? db.getCustomers().find(c => c.id === request.customer_id) : null;
  if (!customer) {
    // Check if matching phone number exists
    customer = db.getCustomers().find(c => c.phone === request.phone);
  }

  if (!customer) {
    const activity = db.getActivities().find(a => a.code === request.activity_code);
    customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: request.customer_name,
      phone: request.phone,
      email: request.email,
      business_name: request.business_name,
      activity_code: request.activity_code,
      activity_name: activity ? activity.name_fr : request.activity_code,
      wilaya_code: request.wilaya_code,
      wilaya_name: request.wilaya_name,
      status: 'active',
      admin_notes: `Created via License Request approval [${request.request_id}]`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_count: 0
    };
    db.getCustomers().unshift(customer);
  }

  // 2. Generate and issue License
  const settings = db.getSettings();
  let defaultDevices = settings.max_devices_pro;
  if (finalPlan === 'trial') defaultDevices = settings.max_devices_trial;
  if (finalPlan === 'basic') defaultDevices = settings.max_devices_basic;
  if (finalPlan === 'enterprise') defaultDevices = settings.max_devices_enterprise;

  const licenseKey = custom_key && custom_key.trim() ? custom_key.trim().toUpperCase() : generateSecureLicenseKey(finalPlan);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + finalDuration * 86400000);

  const defaultFeatures = ['pos_standard', 'offline_sync', 'barcode_scanner'];
  if (finalPlan === 'pro' || finalPlan === 'enterprise') {
    defaultFeatures.push('multi_device', 'inventory_reports', 'promotions', 'customer_loyalty');
  }
  if (finalPlan === 'enterprise') {
    defaultFeatures.push('multi_branch', 'custom_exports', 'api_access');
  }

  const newLicense: License = {
    license_id: `lic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    license_key: licenseKey,
    customer_id: customer.id,
    customer_name: customer.name,
    business_name: customer.business_name,
    activity_code: customer.activity_code,
    plan: finalPlan,
    status: 'active',
    max_devices: max_devices ? parseInt(max_devices, 10) : defaultDevices,
    devices: [],
    created_at: now.toISOString(),
    activated_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    features: defaultFeatures,
    notes: `Issued from Request ${request.request_id} - ${admin_notes || ''}`.trim()
  };

  // If request contains or was provided a device_id, auto-activate and bind it
  if (finalDeviceId) {
    newLicense.devices.push({
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      license_id: newLicense.license_id,
      device_id: finalDeviceId,
      device_name: finalDeviceName,
      os: finalOs,
      app_version: finalAppVersion,
      ip_address: req.ip,
      activated_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      status: 'active'
    });
    customer.device_count = (customer.device_count || 0) + 1;
    request.device_id = finalDeviceId;
    request.device_name = finalDeviceName;
    request.os = finalOs;
  }

  db.getLicenses().unshift(newLicense);
  customer.active_license_key = licenseKey;
  customer.status = 'active';
  customer.updated_at = now.toISOString();

  // 3. Mark request as approved
  request.status = 'approved';
  request.reviewed_at = now.toISOString();
  request.reviewed_by = req.user?.username || 'admin';
  request.customer_id = customer.id;
  request.generated_license_id = newLicense.license_id;
  request.generated_license_key = licenseKey;

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'LICENSE_REQUEST_APPROVED',
    'license_requests',
    request.request_id,
    { license_key: licenseKey, customer_id: customer.id, plan: finalPlan },
    req.ip
  );

  res.json({
    success: true,
    message: 'License request approved and license generated successfully',
    data: {
      request,
      license: newLicense,
      customer
    }
  });
});

// POST /api/license-requests/:id/reject - Reject request
router.post('/:id/reject', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const request = db.getLicenseRequests().find(r => r.request_id === req.params.id);
  if (!request) {
    return apiError(res, 404, 'VALIDATION_ERROR', 'License request not found');
  }

  const { reason } = req.body;
  if (!reason) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Rejection reason is required');
  }

  request.status = 'rejected';
  request.reviewed_at = new Date().toISOString();
  request.reviewed_by = req.user?.username || 'admin';
  request.rejection_reason = reason.trim();

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'LICENSE_REQUEST_REJECTED',
    'license_requests',
    request.request_id,
    { reason },
    req.ip
  );

  res.json({
    success: true,
    message: 'License request rejected',
    data: request
  });
});

export default router;
