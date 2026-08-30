import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import {
  calculateSubscriptionPrice,
  getSubscriptionCatalog,
  DEFAULT_PRICING_CONFIG
} from '../services/subscriptionService.js';
import {
  License,
  LicenseRequest,
  LicenseDevice,
  SubscriptionType,
  Customer
} from '../../src/types/dzpos.js';

const router = Router();

// ==========================================
// 1. Pricing & Plans Catalog APIs
// ==========================================

/**
 * GET /api/subscriptions/plans & /api/subscriptions/pricing
 * Returns available subscription models (Yearly, Lifetime), device tiers (1-5, 5+), and pricing matrix.
 */
const getPricingHandler = (req: Request, res: Response) => {
  try {
    const catalog = getSubscriptionCatalog();
    const settings = db.getSettings();
    const pricing = settings.pricing || DEFAULT_PRICING_CONFIG;

    res.json({
      success: true,
      currency: pricing.currency || 'DZD',
      currency_symbol: pricing.currency_symbol || 'د.ج',
      plans: catalog.plans,
      pricing: pricing,
      data: catalog
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CATALOG_ERROR',
        message: err.message || 'Failed to retrieve subscription pricing catalog'
      }
    });
  }
};

router.get('/', getPricingHandler);
router.get('/plans', getPricingHandler);
router.get('/pricing', getPricingHandler);

/**
 * POST /api/subscriptions/calculate-price
 * Backend calculation of verified official price based on subscription type and device count.
 * Prevents client-side price tampering.
 */
router.post('/calculate-price', (req: Request, res: Response) => {
  try {
    const { plan, subscription_type, type: rawType, device_count, devices, count: rawCount } = req.body;
    let type = (subscription_type || plan || rawType || 'yearly').toLowerCase() as 'yearly' | 'lifetime' | 'annual';
    if (type === 'annual') type = 'yearly';

    const count = parseInt(device_count || devices || rawCount || '1', 10);

    if (type !== 'yearly' && type !== 'lifetime') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TYPE',
          message: 'نوع الاشتراك غير صالح. الأنواع المتاحة: yearly / annual (سنوي) أو lifetime (أبدي)'
        }
      });
    }

    if (isNaN(count) || count < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DEVICE_COUNT',
          message: 'عدد الأجهزة يجب أن يكون رقماً صحيحاً أكبر من أو يساوي 1'
        }
      });
    }

    const calculation = calculateSubscriptionPrice(type, count);

    res.json({
      success: true,
      total_price: calculation.price_dzd,
      base_price: calculation.breakdown.base_price,
      extra_device_price: calculation.breakdown.per_extra_price,
      extra_devices_count: calculation.breakdown.extra_devices,
      extra_price_total: calculation.breakdown.extra_price_total,
      price_dzd: calculation.price_dzd,
      currency: calculation.currency,
      currency_symbol: calculation.currency_symbol,
      subscription_type: type,
      plan: type,
      type: type === 'yearly' ? 'annual' : 'lifetime',
      device_count: count,
      is_lifetime: calculation.is_lifetime,
      duration_days: calculation.duration_days,
      breakdown: calculation.breakdown,
      data: calculation
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CALCULATION_ERROR',
        message: err.message || 'Error calculating subscription price'
      }
    });
  }
});

// Also support GET /api/subscriptions/calculate-price?plan=yearly&device_count=3
router.get('/calculate-price', (req: Request, res: Response) => {
  try {
    let plan = (req.query.plan || req.query.subscription_type || req.query.type || 'yearly').toString().toLowerCase() as 'yearly' | 'lifetime' | 'annual';
    if (plan === 'annual') plan = 'yearly';

    const count = parseInt((req.query.device_count || req.query.devices || req.query.count || '1').toString(), 10);

    if (plan !== 'yearly' && plan !== 'lifetime') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION_TYPE',
          message: 'نوع الاشتراك غير صالح. الأنواع المتاحة: yearly / annual (سنوي) أو lifetime (أبدي)'
        }
      });
    }

    if (isNaN(count) || count < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DEVICE_COUNT',
          message: 'عدد الأجهزة يجب أن يكون رقماً صحيحاً أكبر من أو يساوي 1'
        }
      });
    }

    const calculation = calculateSubscriptionPrice(plan, count);
    res.json({
      success: true,
      total_price: calculation.price_dzd,
      base_price: calculation.breakdown.base_price,
      extra_device_price: calculation.breakdown.per_extra_price,
      extra_devices_count: calculation.breakdown.extra_devices,
      extra_price_total: calculation.breakdown.extra_price_total,
      price_dzd: calculation.price_dzd,
      currency: calculation.currency,
      currency_symbol: calculation.currency_symbol,
      subscription_type: plan,
      plan: plan,
      type: plan === 'yearly' ? 'annual' : 'lifetime',
      device_count: count,
      is_lifetime: calculation.is_lifetime,
      duration_days: calculation.duration_days,
      breakdown: calculation.breakdown,
      data: calculation
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CALCULATION_ERROR',
        message: err.message || 'Error calculating subscription price'
      }
    });
  }
});

/**
 * PUT /api/subscriptions/pricing
 * Update pricing configuration (Main Admin only).
 */
router.put('/pricing', authMiddleware(['MAIN_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { yearly, lifetime, currency, currency_symbol, trial_duration_days } = req.body;
    const settings = db.getSettings();

    const newPricing = {
      ...DEFAULT_PRICING_CONFIG,
      ...(settings.pricing || {}),
      ...(currency ? { currency: currency.trim() } : {}),
      ...(currency_symbol ? { currency_symbol: currency_symbol.trim() } : {}),
      ...(trial_duration_days ? { trial_duration_days: parseInt(trial_duration_days, 10) } : {}),
      yearly: {
        ...(settings.pricing?.yearly || DEFAULT_PRICING_CONFIG.yearly),
        ...(yearly || {})
      },
      lifetime: {
        ...(settings.pricing?.lifetime || DEFAULT_PRICING_CONFIG.lifetime),
        ...(lifetime || {})
      },
      updated_at: new Date().toISOString()
    };

    settings.pricing = newPricing;
    db.save();

    db.addAuditLog(
      req.user?.username || 'admin',
      req.user?.role || 'MAIN_ADMIN',
      'SUBSCRIPTION_PRICING_UPDATED',
      'settings',
      'subscription_pricing',
      { updated_pricing: newPricing },
      req.ip
    );

    res.json({
      success: true,
      message: 'تم تحديث مصفوفة أسعار الاشتراكات بنجاح',
      data: newPricing
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PRICING_ERROR',
        message: err.message || 'Failed to update subscription pricing'
      }
    });
  }
});

// ==========================================
// 2. Subscription Request & Creation API
// ==========================================

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

/**
 * POST /api/subscriptions/request (and /orders, /order, /subscribe)
 * Submits a new subscription request from DZPOS POS terminal or merchant.
 */
const handleSubscriptionRequest = (req: Request, res: Response) => {
  try {
    let {
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
      wilaya_code,
      wilaya_name,
      subscription_type,
      plan_type,
      plan,
      requested_plan,
      device_count,
      devices_count,
      requested_devices,
      count,
      devices,
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

    const finalName = (customer_name || name || manager_name || client_name || 'عميل كاسة جديد').toString().trim();
    const finalPhone = (phone || mobile || telephone || '0550000000').toString().trim();
    const finalBusiness = (business_name || store_name || company_name || 'متجر جديد').toString().trim();
    const finalActivity = (activity_code || activity || 'grocery').toString().trim();

    let rawType = (subscription_type || plan_type || plan || requested_plan || 'yearly').toString().toLowerCase();
    if (rawType === 'annual') rawType = 'yearly';
    const type = (rawType === 'lifetime' ? 'lifetime' : 'yearly') as SubscriptionType;
    const isLifetime = type === 'lifetime';
    
    const numDevices = Math.max(1, parseInt(device_count || devices_count || requested_devices || count || devices || '1', 10));
    const finalDeviceId = (device_id || hardware_id || '').toString().trim();
    const finalDeviceName = (device_name || 'POS Station').toString().trim();
    const finalOs = (os || 'Android / Windows POS').toString().trim();
    const finalAppVersion = (app_version || version || '3.0').toString().trim();

    // Calculate official price in backend
    const priceCalc = calculateSubscriptionPrice(isLifetime ? 'lifetime' : 'yearly', numDevices);

    const wilayaCodeClean = wilaya_code ? String(wilaya_code).padStart(2, '0') : '16';
    const wilayaObj = db.getWilayas().find(w => w.code === wilayaCodeClean);
    const wilayaNameClean = wilaya_name || wilayaObj?.name || 'Alger';

    // Find or create customer
    const cleanPhone = finalPhone.replace(/[\s\-\+]/g, '');
    let customer = db.getCustomers().find(c => c && c.phone && c.phone.replace(/[\s\-\+]/g, '') === cleanPhone);

    if (!customer) {
      customer = {
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: finalName,
        phone: finalPhone,
        email: email ? email.trim() : undefined,
        business_name: finalBusiness,
        activity_code: finalActivity,
        activity_name: db.getActivityByCode(finalActivity)?.name_ar || finalActivity,
        wilaya_code: wilayaCodeClean,
        wilaya_name: wilayaNameClean,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        device_count: numDevices
      };
      db.getCustomers().unshift(customer);
    } else {
      customer.business_name = finalBusiness;
      customer.activity_code = finalActivity;
      customer.device_count = numDevices;
      customer.updated_at = new Date().toISOString();
    }

    const requestId = `req_sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRequest: LicenseRequest = {
      request_id: requestId,
      customer_id: customer.id,
      customer_name: customer.name,
      phone: customer.phone,
      email: customer.email,
      business_name: customer.business_name,
      activity_code: customer.activity_code,
      wilaya_code: customer.wilaya_code,
      wilaya_name: customer.wilaya_name,
      requested_plan: isLifetime ? 'lifetime' : 'yearly',
      subscription_type: type,
      is_lifetime: isLifetime,
      requested_devices: numDevices,
      calculated_price_dzd: priceCalc.price_dzd,
      requested_duration_days: isLifetime ? undefined : 365,
      device_id: finalDeviceId || undefined,
      device_name: finalDeviceName || undefined,
      os: finalOs,
      app_version: finalAppVersion,
      source: sourceInfo.source,
      source_label: sourceInfo.source_label,
      notes: notes ? String(notes).trim() : undefined,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    db.getLicenseRequests().unshift(newRequest);
    db.save();

    db.addAuditLog(
      customer.name,
      'CUSTOMER_REQUEST',
      'SUBSCRIPTION_REQUESTED',
      'license_request',
      requestId,
      {
        subscription_type: type,
        is_lifetime: isLifetime,
        device_count: numDevices,
        price_dzd: priceCalc.price_dzd,
        source: sourceInfo.source,
        source_label: sourceInfo.source_label
      },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'تم إرسال طلب الاشتراك وحساب السعر الرسمي بنجاح',
      order_id: requestId,
      request_id: requestId,
      data: {
        request_id: requestId,
        order_id: requestId,
        customer_id: customer.id,
        customer_name: customer.name,
        business_name: customer.business_name,
        subscription_type: type,
        plan: type,
        is_lifetime: isLifetime,
        device_count: numDevices,
        devices_count: numDevices,
        calculated_price_dzd: priceCalc.price_dzd,
        total_price: priceCalc.price_dzd,
        currency: priceCalc.currency,
        currency_symbol: priceCalc.currency_symbol,
        price_breakdown: priceCalc.breakdown,
        source: sourceInfo.source,
        source_label: sourceInfo.source_label,
        status: 'pending',
        created_at: newRequest.created_at
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'REQUEST_FAILED',
        message: err.message || 'Failed to submit subscription request'
      }
    });
  }
};

router.post('/request', handleSubscriptionRequest);
router.post('/orders', handleSubscriptionRequest);
router.post('/order', handleSubscriptionRequest);
router.post('/subscribe', handleSubscriptionRequest);
router.post('/buy', handleSubscriptionRequest);

// ==========================================
// 3. Subscription Activation & License Generation
// ==========================================

/**
 * POST /api/subscriptions/activate
 * Admin activation or automated issuance of a subscription license.
 */
router.post('/activate', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      request_id,
      customer_id,
      subscription_type,
      device_count,
      device_id,
      device_name,
      os,
      app_version,
      notes
    } = req.body;

    let customer: Customer | undefined;
    let requestObj: LicenseRequest | undefined;
    let type: SubscriptionType = 'yearly';
    let numDevices = 1;

    if (request_id) {
      requestObj = db.getLicenseRequests().find(r => r.request_id === request_id);
      if (!requestObj) {
        return res.status(404).json({
          success: false,
          error: { code: 'REQUEST_NOT_FOUND', message: 'طلب الترخيص غير موجود' }
        });
      }
      customer = db.getCustomerById(requestObj.customer_id || '');
      type = (requestObj.subscription_type || requestObj.requested_plan || 'yearly') as SubscriptionType;
      numDevices = requestObj.requested_devices || 1;
    } else if (customer_id) {
      customer = db.getCustomerById(customer_id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { code: 'CUSTOMER_NOT_FOUND', message: 'الزبون غير موجود' }
        });
      }
      type = (subscription_type || 'yearly').toLowerCase() as SubscriptionType;
      numDevices = Math.max(1, parseInt(device_count || '1', 10));
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'يجب تحديد request_id أو customer_id' }
      });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'بيانات العميل غير متوفرة' }
      });
    }

    const isLifetime = type === 'lifetime';
    const priceCalc = calculateSubscriptionPrice(isLifetime ? 'lifetime' : 'yearly', numDevices);

    // Generate Key: DZPOS-YEAR-XXXX-XXXX-XXXX or DZPOS-LIFE-XXXX-XXXX-XXXX
    const prefix = isLifetime ? 'LIFE' : 'YEAR';
    const randPart1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const randPart2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const randPart3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const licenseKey = `DZPOS-${prefix}-${randPart1}-${randPart2}-${randPart3}`;

    const now = new Date();
    const startsAt = now.toISOString();
    // Expiration: exactly 365 days for yearly, null for lifetime
    let expiresAt: string | null = null;
    if (!isLifetime) {
      const expDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      expiresAt = expDate.toISOString();
    }

    const initialDevices: LicenseDevice[] = [];
    const initialDevId = device_id || requestObj?.device_id;
    if (initialDevId) {
      initialDevices.push({
        id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        license_id: `lic_${Date.now()}`,
        device_id: String(initialDevId).trim(),
        device_name: String(device_name || requestObj?.device_name || 'Main POS Station').trim(),
        os: String(os || requestObj?.os || 'Android POS').trim(),
        app_version: String(app_version || requestObj?.app_version || '2.4.0').trim(),
        ip_address: req.ip,
        activated_at: startsAt,
        last_seen_at: startsAt,
        status: 'active'
      });
    }

    const newLicenseId = `lic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (initialDevices.length > 0) {
      initialDevices[0].license_id = newLicenseId;
    }

    const newLicense: License = {
      license_id: newLicenseId,
      license_key: licenseKey,
      customer_id: customer.id,
      customer_name: customer.name,
      business_name: customer.business_name,
      activity_code: customer.activity_code,
      plan: isLifetime ? 'lifetime' : 'yearly',
      subscription_type: type,
      is_lifetime: isLifetime,
      price_dzd: priceCalc.price_dzd,
      status: 'active',
      max_devices: numDevices,
      devices: initialDevices,
      created_at: startsAt,
      starts_at: startsAt,
      activated_at: startsAt,
      expires_at: expiresAt,
      features: [
        'pos_checkout',
        'offline_database',
        'barcode_sync',
        'product_packs',
        'multi_terminal',
        'receipt_printing',
        ...(isLifetime ? ['lifetime_ownership', 'priority_support'] : ['annual_updates'])
      ],
      notes: notes || `Activated via Subscription Engine (${isLifetime ? 'Lifetime' : 'Yearly'} for ${numDevices} devices)`
    };

    db.getLicenses().unshift(newLicense);

    // Update customer active license
    customer.active_license_key = licenseKey;
    customer.device_count = numDevices;
    customer.updated_at = startsAt;

    // If originated from a request, mark approved/completed
    if (requestObj) {
      requestObj.status = 'approved';
      requestObj.reviewed_at = startsAt;
      requestObj.reviewed_by = req.user?.username || 'admin';
      requestObj.generated_license_id = newLicenseId;
      requestObj.generated_license_key = licenseKey;
    }

    db.save();

    db.addAuditLog(
      req.user?.username || 'admin',
      req.user?.role || 'ADMIN',
      'SUBSCRIPTION_ACTIVATED',
      'license',
      newLicenseId,
      {
        license_key: licenseKey,
        subscription_type: type,
        is_lifetime: isLifetime,
        device_count: numDevices,
        price_dzd: priceCalc.price_dzd,
        expires_at: expiresAt
      },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `تم تفعيل الاشتراك (${isLifetime ? 'أبدي' : 'سنوي'}) بنجاح`,
      data: {
        license_id: newLicenseId,
        license_key: licenseKey,
        customer_name: customer.name,
        business_name: customer.business_name,
        subscription_type: type,
        is_lifetime: isLifetime,
        max_devices: numDevices,
        active_devices_count: initialDevices.length,
        remaining_slots: numDevices - initialDevices.length,
        price_dzd: priceCalc.price_dzd,
        starts_at: startsAt,
        expires_at: expiresAt,
        status: 'active'
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVATION_ERROR',
        message: err.message || 'Failed to activate subscription'
      }
    });
  }
});

// ==========================================
// 4. Status Check & Verification API
// ==========================================

/**
 * GET /api/subscriptions/status?license_key=...&device_id=...
 * POST /api/subscriptions/status
 * Check current status, validity, lifetime flag, remaining days, device usage.
 */
const handleStatusCheck = (req: Request, res: Response) => {
  try {
    const licenseKey = (req.query.license_key || req.body.license_key || '').toString().trim();
    const deviceId = (req.query.device_id || req.body.device_id || '').toString().trim();

    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'LICENSE_KEY_REQUIRED', message: 'مفتاح الترخيص مطلوب' }
      });
    }

    const license = db.getLicenseByKey(licenseKey);
    if (!license) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVALID_LICENSE', message: 'مفتاح الترخيص غير موجود في النظام' }
      });
    }

    const now = new Date();
    const isLifetime = Boolean(license.is_lifetime || license.plan === 'lifetime' || !license.expires_at);

    let isExpired = false;
    let daysRemaining: number | null = null;
    let isGracePeriod = false;
    let graceDaysLeft = 0;

    if (!isLifetime && license.expires_at) {
      const expDate = new Date(license.expires_at);
      const diffMs = expDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        const settings = db.getSettings();
        const graceDays = settings.grace_period_days || 7;
        const daysPast = Math.abs(daysRemaining);
        if (daysPast <= graceDays) {
          isGracePeriod = true;
          graceDaysLeft = graceDays - daysPast;
        } else {
          isExpired = true;
        }
      }
    }

    // Device check
    let deviceBound = false;
    let deviceStatus: 'active' | 'revoked' | 'not_found' = 'not_found';
    if (deviceId) {
      const dev = license.devices?.find(d => d.device_id === deviceId);
      if (dev) {
        deviceBound = true;
        deviceStatus = dev.status;
        dev.last_seen_at = now.toISOString();
        db.save();
      }
    }

    const activeDevices = (license.devices || []).filter(d => d.status === 'active');
    const activeDevicesCount = activeDevices.length;
    const maxDevices = license.max_devices || 1;
    const remainingSlots = Math.max(0, maxDevices - activeDevicesCount);

    const isValid = (license.status === 'active' || isGracePeriod) && !isExpired && license.status !== 'revoked' && license.status !== 'suspended';

    res.json({
      success: true,
      valid: isValid,
      status: isExpired ? 'expired' : license.status,
      subscription_type: license.subscription_type || (isLifetime ? 'lifetime' : 'yearly'),
      is_lifetime: isLifetime,
      expires_at: license.expires_at || null,
      days_remaining: daysRemaining,
      is_grace_period: isGracePeriod,
      grace_period_days_left: graceDaysLeft,
      max_devices: maxDevices,
      active_devices_count: activeDevicesCount,
      remaining_slots: remainingSlots,
      can_add_device: remainingSlots > 0,
      customer: {
        name: license.customer_name,
        business_name: license.business_name,
        activity_code: license.activity_code
      },
      device_check: deviceId ? {
        device_id: deviceId,
        is_bound: deviceBound,
        status: deviceStatus
      } : undefined,
      server_time: now.toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_ERROR',
        message: err.message || 'Error checking subscription status'
      }
    });
  }
};

router.get('/status', handleStatusCheck);
router.post('/status', handleStatusCheck);
router.post('/verify', handleStatusCheck);

// ==========================================
// 5. Device Management (List, Bind, Unbind)
// ==========================================

/**
 * GET /api/subscriptions/devices?license_key=...
 * Returns all devices bound to the subscription with slot usage.
 */
router.get('/devices', (req: Request, res: Response) => {
  try {
    const licenseKey = (req.query.license_key || '').toString().trim();
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'LICENSE_KEY_REQUIRED', message: 'مفتاح الترخيص مطلوب' }
      });
    }

    const license = db.getLicenseByKey(licenseKey);
    if (!license) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVALID_LICENSE', message: 'الترخيص غير موجود' }
      });
    }

    const activeDevices = (license.devices || []).filter(d => d.status === 'active');
    const maxDevices = license.max_devices || 1;
    const remainingSlots = Math.max(0, maxDevices - activeDevices.length);

    res.json({
      success: true,
      data: {
        license_key: license.license_key,
        customer_name: license.customer_name,
        business_name: license.business_name,
        subscription_type: license.subscription_type || (license.is_lifetime ? 'lifetime' : 'yearly'),
        is_lifetime: Boolean(license.is_lifetime),
        max_devices: maxDevices,
        active_devices_count: activeDevices.length,
        remaining_slots: remainingSlots,
        can_add_device: remainingSlots > 0,
        devices: license.devices || []
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DEVICES_FETCH_ERROR', message: err.message || 'Failed to list subscription devices' }
    });
  }
});

/**
 * POST /api/subscriptions/devices/bind
 * Bind a new device to the subscription.
 * Strictly verifies and enforces max_devices limit.
 */
router.post('/devices/bind', (req: Request, res: Response) => {
  try {
    const { license_key, device_id, device_name, os, app_version } = req.body;

    if (!license_key || !device_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'الحقول المطلوبة: license_key و device_id'
        }
      });
    }

    const license = db.getLicenseByKey(String(license_key).trim());
    if (!license) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVALID_LICENSE', message: 'مفتاح الترخيص غير موجود' }
      });
    }

    if (license.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: { code: 'LICENSE_NOT_ACTIVE', message: `حالة الترخيص غير نشطة (${license.status})` }
      });
    }

    license.devices = license.devices || [];
    const cleanDeviceId = String(device_id).trim();

    // Check if this device is already bound
    const existingDev = license.devices.find(d => d.device_id === cleanDeviceId);
    if (existingDev) {
      if (existingDev.status === 'active') {
        // Already active, refresh details
        existingDev.device_name = device_name ? String(device_name).trim() : existingDev.device_name;
        existingDev.last_seen_at = new Date().toISOString();
        db.save();

        return res.json({
          success: true,
          message: 'الجهاز مسجل ومفعل بالفعل على هذا الاشتراك',
          data: {
            device: existingDev,
            max_devices: license.max_devices,
            active_devices_count: license.devices.filter(d => d.status === 'active').length,
            remaining_slots: Math.max(0, license.max_devices - license.devices.filter(d => d.status === 'active').length)
          }
        });
      } else {
        // Reactivate previously revoked device if slots available
        const activeCount = license.devices.filter(d => d.status === 'active').length;
        if (activeCount >= license.max_devices) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'DEVICE_LIMIT_REACHED',
              message: `تم الوصول للحد الأقصى للأجهزة المسموح بها (${license.max_devices} أجهزة). يرجى إلغاء ربط أحد الأجهزة أو ترقية الاشتراك.`
            }
          });
        }
        existingDev.status = 'active';
        existingDev.last_seen_at = new Date().toISOString();
        db.save();

        return res.json({
          success: true,
          message: 'تمت إعادة تفعيل الجهاز بنجاح',
          data: {
            device: existingDev,
            max_devices: license.max_devices,
            active_devices_count: license.devices.filter(d => d.status === 'active').length,
            remaining_slots: Math.max(0, license.max_devices - license.devices.filter(d => d.status === 'active').length)
          }
        });
      }
    }

    // New device: Check limits
    const activeCount = license.devices.filter(d => d.status === 'active').length;
    if (activeCount >= license.max_devices) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_LIMIT_REACHED',
          message: `تم الوصول للحد الأقصى للأجهزة المسموح بها (${license.max_devices} أجهزة). لا يمكن ربط جهاز جديد بدون إلغاء ربط جهاز سابق أو زيادة عدد الأجهزة.`
        }
      });
    }

    const now = new Date().toISOString();
    const newDeviceRecord: LicenseDevice = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      license_id: license.license_id,
      device_id: cleanDeviceId,
      device_name: device_name ? String(device_name).trim() : `POS Station #${activeCount + 1}`,
      os: os ? String(os).trim() : 'Android POS',
      app_version: app_version ? String(app_version).trim() : '2.4.0',
      ip_address: req.ip,
      activated_at: now,
      last_seen_at: now,
      status: 'active'
    };

    license.devices.push(newDeviceRecord);
    db.save();

    db.addAuditLog(
      license.customer_name,
      'DEVICE_CLIENT',
      'DEVICE_BOUND',
      'license',
      license.license_id,
      {
        device_id: cleanDeviceId,
        device_name: newDeviceRecord.device_name,
        active_devices: activeCount + 1,
        max_devices: license.max_devices
      },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'تم ربط الجهاز الجديد بالاشتراك بنجاح',
      data: {
        device: newDeviceRecord,
        max_devices: license.max_devices,
        active_devices_count: activeCount + 1,
        remaining_slots: license.max_devices - (activeCount + 1)
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DEVICE_BIND_ERROR', message: err.message || 'Failed to bind device' }
    });
  }
});

/**
 * POST /api/subscriptions/devices/unbind & DELETE /api/subscriptions/devices/unbind
 * Unbinds / removes a device from the subscription, freeing up a slot.
 */
const handleUnbindDevice = (req: Request, res: Response) => {
  try {
    const licenseKey = (req.body.license_key || req.query.license_key || '').toString().trim();
    const deviceId = (req.body.device_id || req.query.device_id || '').toString().trim();
    const recordId = (req.body.record_id || req.query.record_id || '').toString().trim();

    if (!licenseKey || (!deviceId && !recordId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'يجب تقديم license_key و device_id (أو record_id)'
        }
      });
    }

    const license = db.getLicenseByKey(licenseKey);
    if (!license) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVALID_LICENSE', message: 'مفتاح الترخيص غير موجود' }
      });
    }

    license.devices = license.devices || [];
    const devIndex = license.devices.findIndex(d => 
      (deviceId && d.device_id === deviceId) || (recordId && d.id === recordId)
    );

    if (devIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: 'الجهاز المطلوب غير موجود في هذا الاشتراك' }
      });
    }

    const removedDev = license.devices[devIndex];
    // Remove from array to permanently free up the device slot
    license.devices.splice(devIndex, 1);
    db.save();

    const currentActive = license.devices.filter(d => d.status === 'active').length;
    const remainingSlots = Math.max(0, license.max_devices - currentActive);

    db.addAuditLog(
      license.customer_name,
      'DEVICE_MANAGEMENT',
      'DEVICE_UNBOUND',
      'license',
      license.license_id,
      {
        unbound_device_id: removedDev.device_id,
        unbound_device_name: removedDev.device_name,
        remaining_slots: remainingSlots
      },
      req.ip
    );

    res.json({
      success: true,
      message: `تم إلغاء ربط الجهاز (${removedDev.device_name}) وتحرير خانة جديدة بنجاح`,
      data: {
        unbound_device_id: removedDev.device_id,
        max_devices: license.max_devices,
        active_devices_count: currentActive,
        remaining_slots: remainingSlots
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DEVICE_UNBIND_ERROR', message: err.message || 'Failed to unbind device' }
    });
  }
};

router.post('/devices/unbind', handleUnbindDevice);
router.delete('/devices/unbind', handleUnbindDevice);

export default router;
