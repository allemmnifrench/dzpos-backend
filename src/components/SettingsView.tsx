import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Save,
  Clock,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  User,
  UserCog,
  Mail,
  Shield,
  Coins,
  Infinity as InfinityIcon,
  Calendar,
  Sparkles,
  Calculator,
  Plus
} from 'lucide-react';
import { SystemSettings, AdminRole, AdminUser, SubscriptionPricingConfig } from '../types/dzpos.js';

interface SettingsViewProps {
  settings: SystemSettings;
  adminRole: AdminRole;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  currentUser?: AdminUser | null;
  onOpenProfile?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  adminRole,
  onUpdateSettings,
  currentUser,
  onOpenProfile
}) => {
  const [gracePeriod, setGracePeriod] = useState(settings.grace_period_days);
  const [allowTrialAutoApprove, setAllowTrialAutoApprove] = useState(settings.allow_trial_auto_approve);
  const [devicesTrial, setDevicesTrial] = useState(settings.max_devices_trial);
  const [devicesBasic, setDevicesBasic] = useState(settings.max_devices_basic);
  const [devicesPro, setDevicesPro] = useState(settings.max_devices_pro);
  const [devicesEnterprise, setDevicesEnterprise] = useState(settings.max_devices_enterprise);
  const [offlineCacheHours, setOfflineCacheHours] = useState(settings.offline_cache_duration_hours);
  const [systemName, setSystemName] = useState(settings.system_name);
  const [supportPhone, setSupportPhone] = useState(settings.support_phone);
  const [supportEmail, setSupportEmail] = useState(settings.support_email);

  // Centralized Subscription Pricing State
  const defaultPricing: SubscriptionPricingConfig = {
    currency: 'DZD',
    currency_symbol: 'د.ج',
    yearly: {
      devices_1: 15000,
      devices_2: 25000,
      devices_3: 33000,
      devices_4: 40000,
      devices_5: 46000,
      per_extra_device: 6000
    },
    lifetime: {
      devices_1: 35000,
      devices_2: 55000,
      devices_3: 72000,
      devices_4: 86000,
      devices_5: 98000,
      per_extra_device: 14000
    },
    trial_duration_days: 30
  };

  const initialPricing = settings.pricing || defaultPricing;
  const [pricing, setPricing] = useState<SubscriptionPricingConfig>({
    currency: initialPricing.currency || 'DZD',
    currency_symbol: initialPricing.currency_symbol || 'د.ج',
    yearly: { ...defaultPricing.yearly, ...(initialPricing.yearly || {}) },
    lifetime: { ...defaultPricing.lifetime, ...(initialPricing.lifetime || {}) },
    trial_duration_days: initialPricing.trial_duration_days || 30
  });

  // Simulator Test in Settings
  const [simPlan, setSimPlan] = useState<'yearly' | 'lifetime'>('yearly');
  const [simDevices, setSimDevices] = useState<number>(3);

  const calculateSimPrice = (plan: 'yearly' | 'lifetime', count: number) => {
    const tier = plan === 'lifetime' ? pricing.lifetime : pricing.yearly;
    if (count <= 1) return tier.devices_1;
    if (count === 2) return tier.devices_2;
    if (count === 3) return tier.devices_3;
    if (count === 4) return tier.devices_4;
    if (count === 5) return tier.devices_5;
    return tier.devices_5 + (count - 5) * tier.per_extra_device;
  };

  // AI Key & Model Distribution Settings
  const initialAiConfig = settings.ai_config || {
    enabled: true,
    export_gemini_key_to_clients: true,
    custom_gemini_api_key: '',
    model_name: 'gemini-3.7-flash',
    fallback_model_name: 'gemini-2.5-flash',
    temperature: 0.1,
    daily_scan_limit_per_device: 150,
    allow_offline_prompt_cache: true,
    system_instruction: 'You are DZPOS AI Invoice Parsing Engine...',
    supported_features: ['INVOICE_OCR', 'RECEIPT_PARSER', 'BARCODE_DETECTION', 'PRODUCT_FUZZY_MATCH']
  };

  const [aiEnabled, setAiEnabled] = useState(initialAiConfig.enabled !== false);
  const [exportKeyToClients, setExportKeyToClients] = useState(initialAiConfig.export_gemini_key_to_clients !== false);
  const [customApiKey, setCustomApiKey] = useState(initialAiConfig.custom_gemini_api_key || '');
  const [modelName, setModelName] = useState(initialAiConfig.model_name || 'gemini-3.7-flash');
  const [dailyScanLimit, setDailyScanLimit] = useState(initialAiConfig.daily_scan_limit_per_device || 150);
  const [allowOfflinePromptCache, setAllowOfflinePromptCache] = useState(initialAiConfig.allow_offline_prompt_cache !== false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminRole !== 'MAIN_ADMIN') {
      alert('فقط الـ Main Admin يملك صلاحية تغيير إعدادات النظام');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateSettings({
        grace_period_days: gracePeriod,
        allow_trial_auto_approve: allowTrialAutoApprove,
        max_devices_trial: devicesTrial,
        max_devices_basic: devicesBasic,
        max_devices_pro: devicesPro,
        max_devices_enterprise: devicesEnterprise,
        offline_cache_duration_hours: offlineCacheHours,
        system_name: systemName,
        support_phone: supportPhone,
        support_email: supportEmail,
        pricing: {
          ...pricing,
          updated_at: new Date().toISOString()
        },
        ai_config: {
          enabled: aiEnabled,
          export_gemini_key_to_clients: exportKeyToClients,
          custom_gemini_api_key: customApiKey.trim(),
          model_name: modelName,
          fallback_model_name: 'gemini-2.5-flash',
          temperature: 0.1,
          daily_scan_limit_per_device: dailyScanLimit,
          allow_offline_prompt_cache: allowOfflinePromptCache,
          system_instruction: initialAiConfig.system_instruction,
          supported_features: ['INVOICE_OCR', 'RECEIPT_PARSER', 'BARCODE_DETECTION', 'PRODUCT_FUZZY_MATCH']
        }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>إعدادات النظام والاشتراكات المركزية (System & Pricing Management)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            إدارة تسعير الاشتراكات (سنوي وأبدي) حسب عدد الأجهزة (1-5 و +5)، فترة السماح، وسياسات الترخيص.
          </p>
        </div>

        {adminRole !== 'MAIN_ADMIN' && (
          <div className="text-xs bg-amber-950/60 text-amber-300 font-semibold px-3 py-1.5 rounded-lg border border-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>للتعديل: يرجى تحويل الصلاحية في الأعلى إلى Main Admin</span>
          </div>
        )}
      </div>

      {/* Admin Profile Quick Card */}
      {currentUser && (
        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-emerald-950/40">
              {(currentUser?.full_name?.charAt(0) || currentUser?.username?.charAt(0) || 'A').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100">{currentUser.full_name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-950/40 text-emerald-300 border-emerald-500/30 font-medium">
                  {currentUser.role}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-zinc-500" />
                  {currentUser.email}
                </span>
                <span>•</span>
                <span className="font-mono text-zinc-400">@{currentUser.username}</span>
              </div>
            </div>
          </div>

          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm hover:border-emerald-500/50"
            >
              <UserCog className="w-4 h-4 text-emerald-400" />
              <span>تعديل الملف الشخصي وكلمة المرور</span>
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ==================================================== */}
        {/* Centralized Pricing Matrix (Annual & Lifetime) */}
        {/* ==================================================== */}
        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>النظام المركزي لأسعار الاشتراكات حسب عدد الأجهزة (Centralized Pricing Matrix)</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                يتم تعديل الأسعار هنا وتنعكس فوراً على تطبيق الكاسة دون الحاجة لتحديث التطبيق. السعر في الباكند محمي من التلاعب.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">العملة:</span>
              <span className="text-xs font-mono font-bold bg-zinc-900 border border-zinc-700 text-emerald-400 px-2 py-1 rounded">
                {pricing.currency_symbol} ({pricing.currency})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Yearly Subscription Matrix */}
            <div className="bg-zinc-900/50 rounded-xl border border-emerald-900/30 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-emerald-300">1. باقة الاشتراك السنوي (Yearly Subscription)</h3>
                    <p className="text-[11px] text-zinc-400">ترخيص ينتهي بعد 365 يوماً من تاريخ التفعيل</p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                  365 يوم
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">جهاز واحد (1 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.yearly.devices_1}
                      onChange={(e) => setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, devices_1: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">جهازين (2 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.yearly.devices_2}
                      onChange={(e) => setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, devices_2: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">3 أجهزة (3 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.yearly.devices_3}
                      onChange={(e) => setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, devices_3: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">4 أجهزة (4 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.yearly.devices_4}
                      onChange={(e) => setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, devices_4: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">5 أجهزة (5 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.yearly.devices_5}
                      onChange={(e) => setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, devices_5: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    <span>لكل جهاز إضافي (+5)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.yearly.per_extra_device}
                      onChange={(e) => setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, per_extra_device: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-800/60 bg-amber-950/20 text-amber-200 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-amber-400/60 pointer-events-none">د.ج</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Lifetime Subscription Matrix */}
            <div className="bg-zinc-900/50 rounded-xl border border-indigo-900/30 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                    <InfinityIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-indigo-300">2. باقة الاشتراك الأبدي (Lifetime License)</h3>
                    <p className="text-[11px] text-zinc-400">ترخيص دائم مدى الحياة بدون أي تاريخ انتهاء</p>
                  </div>
                </div>
                <span className="text-[10px] bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  مدى الحياة
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">جهاز واحد (1 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.lifetime.devices_1}
                      onChange={(e) => setPricing({
                        ...pricing,
                        lifetime: { ...pricing.lifetime, devices_1: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">جهازين (2 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.lifetime.devices_2}
                      onChange={(e) => setPricing({
                        ...pricing,
                        lifetime: { ...pricing.lifetime, devices_2: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">3 أجهزة (3 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.lifetime.devices_3}
                      onChange={(e) => setPricing({
                        ...pricing,
                        lifetime: { ...pricing.lifetime, devices_3: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">4 أجهزة (4 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.lifetime.devices_4}
                      onChange={(e) => setPricing({
                        ...pricing,
                        lifetime: { ...pricing.lifetime, devices_4: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">5 أجهزة (5 POS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.lifetime.devices_5}
                      onChange={(e) => setPricing({
                        ...pricing,
                        lifetime: { ...pricing.lifetime, devices_5: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">د.ج</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-400 mb-1 flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    <span>لكل جهاز إضافي (+5)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      disabled={adminRole !== 'MAIN_ADMIN'}
                      value={pricing.lifetime.per_extra_device}
                      onChange={(e) => setPricing({
                        ...pricing,
                        lifetime: { ...pricing.lifetime, per_extra_device: parseInt(e.target.value, 10) || 0 }
                      })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-800/60 bg-indigo-950/20 text-indigo-200 text-xs font-mono disabled:bg-zinc-950"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-indigo-400/60 pointer-events-none">د.ج</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Calculation Live Preview */}
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200">معاينة حاسبة الأسعار الحية (Live Pricing Simulator)</h4>
                <p className="text-[11px] text-zinc-400">جرّب حساب السعر التلقائي عند اختيار العميل لعدد أجهزة محدد</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={simPlan}
                onChange={(e) => setSimPlan(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-semibold"
              >
                <option value="yearly">اشتراك سنوي (1 سنة)</option>
                <option value="lifetime">اشتراك أبدي (Lifetime)</option>
              </select>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400">الأجهزة:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={simDevices}
                  onChange={(e) => setSimDevices(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono text-center font-bold"
                />
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <span>السعر المحتسب:</span>
                <span className="text-sm text-emerald-400">{calculateSimPrice(simPlan, simDevices).toLocaleString()}</span>
                <span>{pricing.currency_symbol}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Policy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: License & Grace Period */}
          <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>سياسات انتهاء التراخيص والسماح</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  فترة السماح بعد انتهاء الترخيص (Grace Period Days) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  disabled={adminRole !== 'MAIN_ADMIN'}
                  value={gracePeriod}
                  onChange={(e) => setGracePeriod(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border-zinc-800"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  عدد الأيام التي يستمر فيها تطبيق الكاسة بالعمل وإظهار تنبيه تجديد دون إيقاف المحل فوراً.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  مدة كاش البيانات دون اتصال (Offline Cache Duration Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  disabled={adminRole !== 'MAIN_ADMIN'}
                  value={offlineCacheHours}
                  onChange={(e) => setOfflineCacheHours(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border-zinc-800"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  168 ساعة = أسبوع كامل يمكن للتطبيق العمل بدون أي اتصال بالإنترنت.
                </p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-300">
                  <input
                    type="checkbox"
                    disabled={adminRole !== 'MAIN_ADMIN'}
                    checked={allowTrialAutoApprove}
                    onChange={(e) => setAllowTrialAutoApprove(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-700"
                  />
                  <span>الموافقة الآلية التلقائية على طلبات النسخ التجريبية (Trial)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Card 2: Support Contact Info */}
          <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>معلومات الدعم الفني والعلامة التجارية</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">اسم النظام المركزي</label>
                <input
                  type="text"
                  disabled={adminRole !== 'MAIN_ADMIN'}
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border-zinc-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">هاتف الدعم الفني (Support Phone)</label>
                <input
                  type="text"
                  disabled={adminRole !== 'MAIN_ADMIN'}
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border-zinc-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">بريد الدعم الفني (Support Email)</label>
                <input
                  type="email"
                  disabled={adminRole !== 'MAIN_ADMIN'}
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border-zinc-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: AI Key Source & Distribution Hub */}
        <div className="bg-[#0c0c0e] rounded-xl border border-emerald-900/50 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>تصدير مفاتيح وخوارزميات الذكاء الاصطناعي لتطبيقات الكاسة (AI Key & Hub Distribution)</span>
            </h2>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 self-start sm:self-auto">
              GET /api/v1/ai/credentials
            </span>
          </div>

          <div className="p-3 bg-zinc-900/70 rounded-lg border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-200">النمط المعماري: التطبيق يقوم بالمهمة والباكند يصدر المفتاح والمواصفات</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                يقوم تطبيق الكاسة (Android POS / Room DB) بطلب المفتاح وتوجيهات النظام من السيرفر، ثم يتولى التطبيق معالجة الفاتورة واستخراج البيانات ومطابقتها محلياً فوراً، ومزامنة النتائج مع السيرفر في الخلفية.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                مفتاح Google Gemini API المخصص (أو اتركه فارغاً لاستخدام مفتاح الخادم)
              </label>
              <input
                type="password"
                placeholder="AIzaSy... (مفتاح السيرفر الافتراضي نشط)"
                disabled={adminRole !== 'MAIN_ADMIN'}
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-950 disabled:text-zinc-600"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                يتم تشفيره وتصديره عبر نقطة الاتصال المحمية للأجهزة التي تمتلك رخصة مفعلة فقط.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                نموذج الذكاء الاصطناعي الموصى به للأجهزة (AI Model)
              </label>
              <select
                disabled={adminRole !== 'MAIN_ADMIN'}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-950"
              >
                <option value="gemini-3.7-flash">Google Gemini 3.7 Flash (موصى به - فائق السرعة والدقة للفواتير)</option>
                <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (اقتصادي)</option>
              </select>
              <p className="text-[11px] text-zinc-500 mt-1">
                يدعم قراءة المستندات المكتوبة باللغة العربية والفرنسية واستخراج الجداول المعقدة بدقة.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                الحد اليومي لعمليات الفحص لكل جهاز كاسة (Daily Limit per Terminal)
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                disabled={adminRole !== 'MAIN_ADMIN'}
                value={dailyScanLimit}
                onChange={(e) => setDailyScanLimit(parseInt(e.target.value, 10) || 150)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-950"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                يتحكم في عدد الفواتير التي يمكن للتطبيق معالجتها يومياً لحماية حصص الاستهلاك.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-300">
                <input
                  type="checkbox"
                  disabled={adminRole !== 'MAIN_ADMIN'}
                  checked={exportKeyToClients}
                  onChange={(e) => setExportKeyToClients(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-700"
                />
                <span className="font-semibold text-emerald-400">السماح بتصدير المفتاح لتطبيقات الكاسة (Android POS SDK)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-300">
                <input
                  type="checkbox"
                  disabled={adminRole !== 'MAIN_ADMIN'}
                  checked={allowOfflinePromptCache}
                  onChange={(e) => setAllowOfflinePromptCache(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-700"
                />
                <span>السماح للتطبيق بتخزين مخططات التعرف (JSON Schemas) محلياً</span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        {adminRole === 'MAIN_ADMIN' && (
          <div className="flex items-center justify-between pt-2">
            {saveSuccess && (
              <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم حفظ إعدادات النظام ومصفوفة أسعار الاشتراكات بنجاح!</span>
              </span>
            )}
            <div className="mr-auto">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات وتحديث أسعار المنظومة'}</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

