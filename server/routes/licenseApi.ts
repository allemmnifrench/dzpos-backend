import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, generateSecureLicenseKey, WILAYAS_DZ } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import { LicenseVerifyRequest, LicenseVerifyResponse, LicenseDevice, LicensePlan, License } from '../../src/types/dzpos.js';

const router = Router();

function handleLicenseVerification(req: Request, res: Response) {
  const {
    license_key,
    device_id,
    device_name = 'POS Terminal',
    os = 'Unknown OS',
    app_version = 'v2.4.0'
  } = req.body as LicenseVerifyRequest;

  if (!license_key || !license_key.trim()) {
    return apiError(res, 400, 'INVALID_LICENSE', 'license_key is required');
  }
  if (!device_id || !device_id.trim()) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'device_id (hardware UUID or serial) is required for device binding');
  }

  const cleanKey = license_key.trim().toUpperCase();
  const license = db.getLicenses().find(l => l.license_key === cleanKey);

  if (!license) {
    return apiError(res, 404, 'INVALID_LICENSE', 'The provided license key is not recognized or does not exist');
  }

  // Check customer status
  const customer = db.getCustomers().find(c => c.id === license.customer_id);
  if (customer) {
    if (customer.status === 'blocked') {
      return apiError(res, 403, 'FORBIDDEN', 'Your account has been blocked by system administrator. Please contact DZPOS support.');
    }
    if (customer.status === 'suspended') {
      return apiError(res, 403, 'LICENSE_SUSPENDED', 'Your account is currently suspended. Please contact DZPOS support to reactivate.');
    }
  }

  // Check license state
  if (license.status === 'revoked') {
    return apiError(res, 403, 'LICENSE_REVOKED', 'This license has been permanently revoked.');
  }
  if (license.status === 'suspended') {
    return apiError(res, 403, 'LICENSE_SUSPENDED', 'This license is temporarily suspended.');
  }

  // Expiration & Grace Period Logic
  const now = Date.now();
  const isLifetime = Boolean(license.is_lifetime || license.plan === 'lifetime' || !license.expires_at);
  const settings = db.getSettings();
  let isValid = true;
  let isGracePeriod = false;
  let graceDaysLeft = 0;
  let daysRemaining: number | null = null;

  if (!isLifetime && license.expires_at) {
    const expiresAtMs = new Date(license.expires_at).getTime();
    const isPastExpiry = now > expiresAtMs;
    const gracePeriodMs = settings.grace_period_days * 86400000;
    const gracePeriodEndMs = expiresAtMs + gracePeriodMs;
    daysRemaining = Math.max(0, Math.ceil((expiresAtMs - now) / 86400000));

    if (isPastExpiry) {
      if (now <= gracePeriodEndMs) {
        isGracePeriod = true;
        isValid = true;
        graceDaysLeft = Math.ceil((gracePeriodEndMs - now) / 86400000);
        daysRemaining = 0;
      } else {
        isValid = false;
        license.status = 'expired';
        db.save();
        return apiError(
          res,
          403,
          'LICENSE_EXPIRED',
          `License expired on ${new Date(license.expires_at).toLocaleDateString()}. The ${settings.grace_period_days}-day grace period has ended.`,
          { expires_at: license.expires_at, grace_period_days: settings.grace_period_days }
        );
      }
    }
  }

  // Device Binding verification
  if (!license.devices) license.devices = [];
  const existingDevice = license.devices.find(d => d.device_id === device_id);

  if (existingDevice) {
    if (existingDevice.status === 'revoked') {
      return apiError(res, 403, 'DEVICE_NOT_AUTHORIZED', 'This terminal device has been revoked from using this license.');
    }
    existingDevice.last_seen_at = new Date().toISOString();
    existingDevice.device_name = device_name;
    existingDevice.os = os;
    existingDevice.app_version = app_version;
    existingDevice.ip_address = req.ip;
  } else {
    // New device attempting to bind
    const activeDevices = license.devices.filter(d => d.status === 'active');
    if (activeDevices.length >= license.max_devices) {
      return apiError(
        res,
        403,
        'DEVICE_LIMIT_REACHED',
        `License device limit reached (${activeDevices.length}/${license.max_devices}). Please unbind an existing caisse terminal or upgrade your plan.`,
        { max_devices: license.max_devices, current_devices: activeDevices.length }
      );
    }

    // Register new device
    const newDevice: LicenseDevice = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      license_id: license.license_id,
      device_id,
      device_name,
      os,
      app_version,
      ip_address: req.ip,
      activated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      status: 'active'
    };

    license.devices.push(newDevice);
    db.addAuditLog(
      'pos_client',
      'DEVICE',
      'DEVICE_AUTO_BOUND',
      'license_devices',
      newDevice.device_id,
      { license_id: license.license_id, device_name, os, ip: req.ip },
      req.ip
    );
  }

  // Update timestamps
  license.last_sync_at = new Date().toISOString();
  if (customer) {
    customer.last_sync_at = new Date().toISOString();
    customer.device_count = license.devices.filter(d => d.status === 'active').length;
  }
  db.save();

  const deviceToken = `dzt_${Buffer.from(`${device_id}:${license.license_key}`).toString('base64').replace(/=/g, '')}`;

  const activeCount = license.devices.filter(d => d.status === 'active').length;
  const remainingSlots = Math.max(0, license.max_devices - activeCount);

  const responsePayload: LicenseVerifyResponse = {
    valid: isValid,
    status: license.status,
    subscription_type: license.subscription_type || (isLifetime ? 'lifetime' : 'yearly'),
    is_lifetime: isLifetime,
    expires_at: license.expires_at || null,
    days_remaining: daysRemaining,
    is_grace_period: isGracePeriod,
    grace_period_days_left: graceDaysLeft,
    customer: {
      name: license.customer_name,
      business_name: license.business_name,
      activity_code: license.activity_code,
      wilaya: customer ? customer.wilaya_name : 'Algérie'
    },
    plan: license.plan,
    features: license.features || ['pos_standard', 'offline_sync', 'barcode_scanner'],
    max_devices: license.max_devices,
    active_devices_count: activeCount,
    remaining_devices_count: remainingSlots,
    server_time: new Date().toISOString(),
    offline_cache_duration_hours: settings.offline_cache_duration_hours,
    message: isGracePeriod
      ? `License is currently in grace period (${graceDaysLeft} days remaining). Please renew your subscription soon.`
      : (isLifetime ? 'Lifetime subscription verified successfully' : 'License verified successfully')
  };

  res.json({
    success: true,
    valid: isValid,
    device_token: deviceToken,
    grace_period_days: settings.grace_period_days,
    is_grace_period: isGracePeriod,
    license: {
      license_key: license.license_key,
      status: license.status,
      tier: license.plan,
      plan: license.plan,
      expires_at: license.expires_at,
      activity_code: license.activity_code
    },
    customer: {
      business_name: license.business_name,
      name: license.customer_name,
      phone: customer ? customer.phone : ''
    },
    data: responsePayload
  });
}

// Handler for Remote Device Check (Zero-Touch Remote Activation)
function handleDeviceCheck(req: Request, res: Response) {
  const device_id = (req.query.device_id || req.body.device_id || '') as string;

  if (!device_id || !device_id.trim()) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'device_id parameter is required for remote activation check');
  }

  const cleanDeviceId = device_id.trim();

  // 1. First, search in active licenses if device is already bound and active
  const allLicenses = db.getLicenses();
  let matchedLicense = allLicenses.find(l =>
    (l.status === 'active' || l.plan === 'trial') &&
    l.devices &&
    l.devices.some(d => d.device_id === cleanDeviceId && d.status === 'active')
  );

  // 2. If not found in active devices, check if an approved request exists with this device_id
  if (!matchedLicense) {
    const approvedReq = db.getLicenseRequests().find(
      r => r.device_id === cleanDeviceId && r.status === 'approved' && r.generated_license_key
    );

    if (approvedReq && approvedReq.generated_license_key) {
      matchedLicense = allLicenses.find(l => l.license_key === approvedReq.generated_license_key);
      // Auto-bind device to this license if not yet present
      if (matchedLicense) {
        if (!matchedLicense.devices) matchedLicense.devices = [];
        const exists = matchedLicense.devices.find(d => d.device_id === cleanDeviceId);
        if (!exists) {
          matchedLicense.devices.push({
            id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            license_id: matchedLicense.license_id,
            device_id: cleanDeviceId,
            device_name: approvedReq.device_name || 'Mobile POS Terminal',
            os: approvedReq.os || 'Android POS',
            app_version: approvedReq.app_version || 'v2.4.0',
            ip_address: req.ip,
            activated_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            status: 'active'
          });
          db.save();
        }
      }
    }
  }

  // 3. If an active license is found for this device: return the license for instant injection
  if (matchedLicense) {
    const now = Date.now();
    const expiresAtMs = new Date(matchedLicense.expires_at).getTime();
    const daysRemaining = Math.max(0, Math.ceil((expiresAtMs - now) / 86400000));
    const activity = db.getActivities().find(a => a.code === matchedLicense.activity_code);

    // Update last seen
    const boundDevice = matchedLicense.devices?.find(d => d.device_id === cleanDeviceId);
    if (boundDevice) {
      boundDevice.last_seen_at = new Date().toISOString();
      boundDevice.ip_address = req.ip;
      matchedLicense.last_sync_at = new Date().toISOString();
      db.save();
    }

    return res.json({
      success: true,
      activated: true,
      registered: true,
      status: matchedLicense.status,
      license_key: matchedLicense.license_key,
      device_id: cleanDeviceId,
      customer_name: matchedLicense.customer_name,
      business_name: matchedLicense.business_name,
      activity_code: matchedLicense.activity_code,
      activity_name: activity ? activity.name_ar : matchedLicense.activity_code,
      plan: matchedLicense.plan,
      expires_at: matchedLicense.expires_at,
      days_remaining: daysRemaining,
      features: matchedLicense.features || ['pos_standard', 'offline_sync', 'barcode_scanner'],
      latest_pack_version: activity ? activity.latest_pack_version : 1,
      pack_download_url: `/api/sync/download?activity_code=${matchedLicense.activity_code}`,
      message: 'تم تفعيل الجهاز بنجاح! تم استيراد رخصة العمل وتجهيز المحطة.'
    });
  }

  // 4. If no active license, check if there is a pending request for this device
  const pendingReq = db.getLicenseRequests().find(
    r => r.device_id === cleanDeviceId && r.status === 'pending'
  );

  if (pendingReq) {
    return res.json({
      success: true,
      activated: false,
      registered: true,
      status: 'pending_admin_approval',
      request_id: pendingReq.request_id,
      business_name: pendingReq.business_name,
      customer_name: pendingReq.customer_name,
      message: 'الجهاز مسجل وقيد انتظار التفعيل والتوليد من الإدارة المركزية'
    });
  }

  // 5. Unregistered device
  return res.json({
    success: true,
    activated: false,
    registered: false,
    status: 'unregistered',
    device_id: cleanDeviceId,
    message: 'الجهاز غير مسجل أو لم يتم تفعيله بعد من لوحة الإدارة'
  });
}

// GET & POST /api/license/device-check - Mobile auto-poll endpoint
router.get('/device-check', handleDeviceCheck);
router.post('/device-check', handleDeviceCheck);

// POST /api/license/register-device - Mobile App registers itself for Remote Activation
router.post('/register-device', (req: Request, res: Response) => {
  const {
    device_id,
    device_name = 'POS Terminal',
    os = 'Android POS',
    app_version = 'v2.4.0',
    business_name,
    customer_name,
    name,
    phone,
    activity_code = 'grocery',
    wilaya_code = '16',
    requested_plan = 'pro',
    notes
  } = req.body;

  if (!device_id || !device_id.trim()) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'device_id is required');
  }

  const cleanDeviceId = device_id.trim();
  const finalBusiness = (business_name || 'نقطة بيع متنقلة').trim();
  const finalName = (customer_name || name || 'تاجر جديد').trim();
  const finalPhone = (phone || '0550000000').trim();

  // Check if a request already exists for this device
  let existing = db.getLicenseRequests().find(r => r.device_id === cleanDeviceId && r.status === 'pending');
  const wilaya = WILAYAS_DZ.find(w => w.code === wilaya_code) || WILAYAS_DZ.find(w => w.code === '16');

  if (existing) {
    existing.business_name = finalBusiness;
    existing.customer_name = finalName;
    existing.phone = finalPhone;
    existing.activity_code = activity_code;
    existing.device_name = device_name;
    existing.os = os;
    existing.app_version = app_version;
    existing.requested_plan = requested_plan as LicensePlan;
    existing.created_at = new Date().toISOString();
    db.save();

    return res.json({
      success: true,
      message: 'تم تحديث طلب التفعيل للجهاز وهو قيد انتظار موافقة الإدارة',
      request_id: existing.request_id,
      data: existing
    });
  }

  const newRequest = {
    request_id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    customer_name: finalName,
    phone: finalPhone,
    business_name: finalBusiness,
    activity_code: activity_code || 'grocery',
    wilaya_code: wilaya ? wilaya.code : '16',
    wilaya_name: wilaya ? wilaya.name : 'Alger',
    requested_plan: (requested_plan as LicensePlan) || 'pro',
    requested_duration_days: 365,
    device_id: cleanDeviceId,
    device_name,
    os,
    app_version,
    notes: notes ? notes.trim() : `طلب تفعيل تلقائي عبر الهاتف (${device_name})`,
    status: 'pending' as const,
    created_at: new Date().toISOString()
  };

  db.getLicenseRequests().unshift(newRequest);
  db.save();

  db.addAuditLog(
    'pos_mobile_client',
    'DEVICE',
    'DEVICE_REGISTERED_FOR_ACTIVATION',
    'license_requests',
    newRequest.request_id,
    { device_id: cleanDeviceId, business: finalBusiness, phone: finalPhone },
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'تم تسجيل الجهاز بنجاح. يمكنك الآن تفعيله مباشرة من لوحة الإدارة.',
    request_id: newRequest.request_id,
    data: newRequest
  });
});

// POST /api/license/remote-activate - 1-Click Remote Generation & Activation by Admin
router.post('/remote-activate', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const {
    device_id,
    device_name = 'POS Mobile Terminal',
    os = 'Android POS',
    app_version = 'v2.4.0',
    customer_id,
    customer_name,
    phone,
    business_name,
    activity_code = 'grocery',
    wilaya_code = '16',
    plan = 'pro',
    duration_days = 365,
    max_devices = 2,
    admin_notes
  } = req.body;

  if (!device_id || !device_id.trim()) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'device_id is required for remote activation');
  }

  const cleanDeviceId = device_id.trim();
  const finalPlan = (plan as LicensePlan) || 'pro';
  const finalDuration = parseInt(duration_days, 10) || 365;

  // 1. Locate or create customer
  let customer = customer_id ? db.getCustomers().find(c => c.id === customer_id) : null;
  if (!customer && phone) {
    customer = db.getCustomers().find(c => c.phone === phone);
  }

  const wilaya = WILAYAS_DZ.find(w => w.code === wilaya_code) || WILAYAS_DZ.find(w => w.code === '16');

  if (!customer) {
    const activity = db.getActivities().find(a => a.code === activity_code);
    customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: customer_name || `تاجر - ${cleanDeviceId.slice(0, 8)}`,
      phone: phone || '0550000000',
      business_name: business_name || `متجر - ${cleanDeviceId.slice(0, 8)}`,
      activity_code: activity_code || 'grocery',
      activity_name: activity ? activity.name_ar : activity_code,
      wilaya_code: wilaya ? wilaya.code : '16',
      wilaya_name: wilaya ? wilaya.name : 'Alger',
      status: 'active',
      admin_notes: `Created via Remote Zero-Touch Activation for Device [${cleanDeviceId}]`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_count: 1
    };
    db.getCustomers().unshift(customer);
  }

  // 2. Generate license key and bind device directly
  const licenseKey = generateSecureLicenseKey(finalPlan);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + finalDuration * 86400000);

  const defaultFeatures = ['pos_standard', 'offline_sync', 'barcode_scanner'];
  if (finalPlan === 'pro' || finalPlan === 'enterprise') {
    defaultFeatures.push('multi_device', 'inventory_reports', 'promotions', 'customer_loyalty');
  }
  if (finalPlan === 'enterprise') {
    defaultFeatures.push('multi_branch', 'custom_exports', 'api_access');
  }

  const initialDevice: LicenseDevice = {
    id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    license_id: '',
    device_id: cleanDeviceId,
    device_name,
    os,
    app_version,
    ip_address: req.ip,
    activated_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    status: 'active'
  };

  const newLicense: License = {
    license_id: `lic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    license_key: licenseKey,
    customer_id: customer.id,
    customer_name: customer.name,
    business_name: customer.business_name,
    activity_code: customer.activity_code,
    plan: finalPlan,
    status: 'active',
    max_devices: parseInt(max_devices, 10) || 2,
    devices: [],
    created_at: now.toISOString(),
    activated_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    features: defaultFeatures,
    notes: `Remote Activated for Device ${cleanDeviceId} - ${admin_notes || ''}`.trim()
  };

  initialDevice.license_id = newLicense.license_id;
  newLicense.devices.push(initialDevice);

  db.getLicenses().unshift(newLicense);
  customer.active_license_key = licenseKey;
  customer.status = 'active';
  customer.device_count = 1;
  customer.updated_at = now.toISOString();

  // 3. Mark any pending request with this device_id as approved
  const pendingRequests = db.getLicenseRequests().filter(
    r => r.device_id === cleanDeviceId && r.status === 'pending'
  );
  for (const pr of pendingRequests) {
    pr.status = 'approved';
    pr.reviewed_at = now.toISOString();
    pr.reviewed_by = req.user?.username || 'admin';
    pr.customer_id = customer.id;
    pr.generated_license_id = newLicense.license_id;
    pr.generated_license_key = licenseKey;
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'REMOTE_DEVICE_ACTIVATED',
    'licenses',
    newLicense.license_id,
    { device_id: cleanDeviceId, license_key: licenseKey, customer: customer.name },
    req.ip
  );

  res.json({
    success: true,
    message: 'تم تفعيل جهاز الهاتف عن بعد بنجاح وتوليد المفتاح! سيتفعل التطبيق على الهاتف تلقائياً.',
    data: {
      license: newLicense,
      customer,
      device: initialDevice
    }
  });
});

// POST /api/license/verify and POST /api/licenses/verify - Core License Verification
router.post('/verify', handleLicenseVerification);
router.post('/', handleLicenseVerification); // for when called on /api/licenses/verify or /api/license/verify router mount
router.post('/activate-device', handleLicenseVerification);

// POST /api/license/deactivate-device - Terminal voluntary release
router.post('/deactivate-device', (req: Request, res: Response) => {
  const { license_key, device_id } = req.body;
  if (!license_key || !device_id) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'license_key and device_id are required');
  }

  const license = db.getLicenses().find(l => l.license_key === license_key.trim().toUpperCase());
  if (!license) {
    return apiError(res, 404, 'INVALID_LICENSE', 'License not found');
  }

  const devIndex = license.devices.findIndex(d => d.device_id === device_id);
  if (devIndex === -1) {
    return apiError(res, 404, 'DEVICE_NOT_AUTHORIZED', 'Device not registered on this license');
  }

  const [removed] = license.devices.splice(devIndex, 1);
  db.save();

  db.addAuditLog(
    'pos_client',
    'DEVICE',
    'DEVICE_VOLUNTARY_DEACTIVATED',
    'license_devices',
    device_id,
    { license_id: license.license_id, device_name: removed.device_name },
    req.ip
  );

  res.json({
    success: true,
    message: `Terminal ${removed.device_name || device_id} unbound successfully`
  });
});

// GET /api/license/devices/all - List all real physical devices across all licenses
router.get('/devices/all', authMiddleware(['MAIN_ADMIN', 'ADMIN', 'SUPPORT']), (req: AuthenticatedRequest, res: Response) => {
  const allLicenses = db.getLicenses();
  const allCustomers = db.getCustomers();
  const result: any[] = [];

  for (const lic of allLicenses) {
    const cust = allCustomers.find(c => c.id === lic.customer_id);
    if (lic.devices && lic.devices.length > 0) {
      for (const dev of lic.devices) {
        result.push({
          ...dev,
          license_key: lic.license_key,
          license_status: lic.status,
          plan: lic.plan,
          expires_at: lic.expires_at,
          customer_name: lic.customer_name,
          business_name: lic.business_name,
          activity_code: lic.activity_code,
          phone: cust ? cust.phone : '',
          wilaya_name: cust ? cust.wilaya_name : ''
        });
      }
    }
  }

  res.json({
    success: true,
    total_devices: result.length,
    data: result
  });
});

// POST /api/license/offline/generate-file - Generates a digitally signed .lic file
router.post('/offline/generate-file', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const {
    license_key,
    device_id,
    device_name = 'POS Hardware Terminal',
    expires_in_days = 365,
    custom_notes
  } = req.body;

  if (!license_key || !device_id) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'license_key and device_id are required');
  }

  const cleanKey = license_key.trim().toUpperCase();
  const cleanDevId = device_id.trim();

  const license = db.getLicenses().find(l => l.license_key === cleanKey);
  if (!license) {
    return apiError(res, 404, 'INVALID_LICENSE', 'License not found');
  }

  const customer = db.getCustomers().find(c => c.id === license.customer_id);
  const now = new Date();
  const expiryDate = new Date(now.getTime() + (parseInt(expires_in_days, 10) || 365) * 86400000);

  // Payload for offline verification
  const payload = {
    app: 'DZPOS-COMMERCE',
    version: '3.0',
    issuer: 'DZPOS Cloud Central HQ',
    license_id: license.license_id,
    license_key: license.license_key,
    plan: license.plan,
    customer_id: license.customer_id,
    customer_name: license.customer_name,
    business_name: license.business_name,
    activity_code: license.activity_code,
    wilaya: customer ? customer.wilaya_name : 'Alger',
    device_id: cleanDevId,
    device_name: device_name,
    features: license.features || ['pos_standard', 'offline_sync', 'barcode_scanner'],
    issued_at: now.toISOString(),
    expires_at: expiryDate.toISOString(),
    max_devices: license.max_devices,
    notes: custom_notes || 'Official Digitally Signed Offline License File'
  };

  const secret = process.env.LICENSING_SECRET || 'DZPOS_OFFLINE_MASTER_SIGNING_KEY_2026_ALGERIA';
  const payloadString = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

  const signedLicenseFile = {
    header: 'DZPOS-SIGNED-OFFLINE-LICENSE-V1',
    data: payload,
    signature_sha256: signature,
    checksum: crypto.createHash('sha256').update(payloadString).digest('hex'),
    raw_b64: Buffer.from(JSON.stringify({ data: payload, signature })).toString('base64')
  };

  // Bind device to license if not present
  if (!license.devices) license.devices = [];
  const existingDev = license.devices.find(d => d.device_id === cleanDevId);
  if (!existingDev) {
    license.devices.push({
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      license_id: license.license_id,
      device_id: cleanDevId,
      device_name: device_name,
      os: 'Offline PC / Windows POS',
      app_version: 'v3.0-offline',
      ip_address: 'Air-Gapped Offline Terminal',
      activated_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      status: 'active'
    });
    db.save();
  }

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'OFFLINE_LICENSE_FILE_GENERATED',
    'licenses',
    license.license_id,
    { device_id: cleanDevId, license_key: cleanKey, customer: license.customer_name },
    req.ip
  );

  res.json({
    success: true,
    message: 'تم توليد ملف الرخصة الرقمي المشفر بنجاح (.lic)',
    file_name: `dzpos_license_${cleanDevId.slice(0, 8)}.lic`,
    data: signedLicenseFile
  });
});

// POST /api/license/offline/generate-unlock-code - Offline Challenge / Response Generator
router.post('/offline/generate-unlock-code', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const {
    challenge_code,
    plan = 'pro',
    duration_days = 365,
    customer_name = 'POS Client'
  } = req.body;

  if (!challenge_code || !challenge_code.trim()) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Machine Challenge Code is required');
  }

  const cleanChallenge = challenge_code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const secret = process.env.LICENSING_SECRET || 'DZPOS_OFFLINE_MASTER_SIGNING_KEY_2026_ALGERIA';
  
  // Deterministic cryptographic hash of machine challenge + duration
  const hash = crypto.createHmac('sha256', secret)
    .update(`${cleanChallenge}:${plan}:${duration_days}`)
    .digest('hex')
    .toUpperCase();

  // Format as readable activation code: DZ-XXXX-XXXX-XXXX-XXXX
  const p1 = hash.substring(0, 4);
  const p2 = hash.substring(4, 8);
  const p3 = hash.substring(8, 12);
  const p4 = hash.substring(12, 16);
  const unlockCode = `DZPOS-ACT-${p1}-${p2}-${p3}-${p4}`;

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    'OFFLINE_UNLOCK_CODE_GENERATED',
    'offline_activations',
    cleanChallenge,
    { challenge: cleanChallenge, unlock_code: unlockCode, customer: customer_name, plan, duration_days },
    req.ip
  );

  res.json({
    success: true,
    message: 'تم توليد كود التفعيل اليدوي بنجاح',
    challenge_code: challenge_code,
    unlock_code: unlockCode,
    plan,
    duration_days,
    generated_at: new Date().toISOString()
  });
});

export default router;
