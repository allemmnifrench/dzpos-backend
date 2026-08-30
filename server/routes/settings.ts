import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import { SystemSettings } from '../../src/types/dzpos.js';

const router = Router();

// GET /api/settings - Read current settings
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: db.getSettings()
  });
});

// PUT /api/settings - Update settings (Main Admin only)
router.put('/', authMiddleware(['MAIN_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const current = db.getSettings();
  const {
    grace_period_days,
    allow_trial_auto_approve,
    max_devices_trial,
    max_devices_basic,
    max_devices_pro,
    max_devices_enterprise,
    require_device_binding,
    offline_cache_duration_hours,
    system_name,
    support_phone,
    support_email
  } = req.body;

  if (grace_period_days !== undefined) current.grace_period_days = parseInt(grace_period_days, 10);
  if (allow_trial_auto_approve !== undefined) current.allow_trial_auto_approve = Boolean(allow_trial_auto_approve);
  if (max_devices_trial !== undefined) current.max_devices_trial = parseInt(max_devices_trial, 10);
  if (max_devices_basic !== undefined) current.max_devices_basic = parseInt(max_devices_basic, 10);
  if (max_devices_pro !== undefined) current.max_devices_pro = parseInt(max_devices_pro, 10);
  if (max_devices_enterprise !== undefined) current.max_devices_enterprise = parseInt(max_devices_enterprise, 10);
  if (require_device_binding !== undefined) current.require_device_binding = Boolean(require_device_binding);
  if (offline_cache_duration_hours !== undefined) current.offline_cache_duration_hours = parseInt(offline_cache_duration_hours, 10);
  if (system_name) current.system_name = system_name.trim();
  if (support_phone) current.support_phone = support_phone.trim();
  if (support_email) current.support_email = support_email.trim();

  // Pricing Matrix Update
  if (req.body.pricing && typeof req.body.pricing === 'object') {
    current.pricing = {
      ...current.pricing,
      ...req.body.pricing,
      yearly: {
        ...current.pricing?.yearly,
        ...(req.body.pricing.yearly || {})
      },
      lifetime: {
        ...current.pricing?.lifetime,
        ...(req.body.pricing.lifetime || {})
      },
      updated_at: new Date().toISOString()
    };
  }

  // AI Key and Model Config Update
  if (req.body.ai_config && typeof req.body.ai_config === 'object') {
    current.ai_config = {
      ...(current.ai_config || {
        enabled: true,
        export_gemini_key_to_clients: true,
        model_name: 'gemini-3.7-flash',
        fallback_model_name: 'gemini-2.5-flash',
        temperature: 0.1,
        daily_scan_limit_per_device: 150,
        allow_offline_prompt_cache: true,
        system_instruction: 'You are DZPOS AI Invoice Parsing Engine...',
        supported_features: ['INVOICE_OCR', 'RECEIPT_PARSER', 'BARCODE_DETECTION', 'PRODUCT_FUZZY_MATCH']
      }),
      ...req.body.ai_config
    };
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'MAIN_ADMIN',
    'SETTINGS_UPDATED',
    'settings',
    'system_settings',
    { updated_keys: Object.keys(req.body) },
    req.ip
  );

  res.json({
    success: true,
    message: 'System settings updated successfully',
    data: current
  });
});

export default router;
