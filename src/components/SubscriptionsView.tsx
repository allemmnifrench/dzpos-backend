import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Infinity as InfinityIcon,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Save,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Copy,
  Check,
  Edit3,
  Trash2,
  Clock,
  ShieldCheck,
  Building2,
  Phone,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sliders,
  DollarSign,
  UserPlus,
  Globe,
  Smartphone
} from 'lucide-react';
import {
  License,
  Customer,
  LicenseRequest,
  SystemSettings,
  AdminRole,
  AdminUser,
  SubscriptionPricingConfig,
  SubscriptionType
} from '../types/dzpos.js';

interface SubscriptionsViewProps {
  licenses: License[];
  customers: Customer[];
  requests: LicenseRequest[];
  settings: SystemSettings;
  adminRole: AdminRole;
  currentUser?: AdminUser | null;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  onCreateLicense: (data: Partial<License>) => Promise<any>;
  onExtendLicense: (licenseKey: string, days: number) => Promise<any>;
  onUpdateStatus: (licenseKey: string, status: string) => Promise<any>;
  onUnbindDevice: (licenseKey: string, deviceId: string) => Promise<any>;
  onApproveRequest: (requestId: string, plan: string, durationDays: number, maxDevices: number) => Promise<any>;
  onRefreshData?: () => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  licenses,
  customers,
  requests,
  settings,
  adminRole,
  currentUser,
  onUpdateSettings,
  onCreateLicense,
  onExtendLicense,
  onUpdateStatus,
  onUnbindDevice,
  onApproveRequest,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pricing' | 'subscriptions' | 'requests'>('pricing');

  // Default pricing baseline
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

  // Sync pricing state when settings change
  useEffect(() => {
    if (settings.pricing) {
      setPricing({
        currency: settings.pricing.currency || 'DZD',
        currency_symbol: settings.pricing.currency_symbol || 'د.ج',
        yearly: { ...defaultPricing.yearly, ...(settings.pricing.yearly || {}) },
        lifetime: { ...defaultPricing.lifetime, ...(settings.pricing.lifetime || {}) },
        trial_duration_days: settings.pricing.trial_duration_days || 30
      });
    }
  }, [settings.pricing]);

  // Saving state for pricing
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Simulator Test state
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

  // Search and filter for subscriptions list
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all'); // all, yearly, lifetime, trial
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, active, expired, revoked

  // Edit Subscription Modal state
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [editMaxDevices, setEditMaxDevices] = useState<number>(1);
  const [editPlan, setEditPlan] = useState<string>('yearly');
  const [editExpiresAt, setEditExpiresAt] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Create New Subscription Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSubCustomerId, setNewSubCustomerId] = useState('');
  const [newSubPlan, setNewSubPlan] = useState<'yearly' | 'lifetime'>('yearly');
  const [newSubDevices, setNewSubDevices] = useState<number>(1);
  const [newSubNotes, setNewSubNotes] = useState('');
  const [isCreatingSub, setIsCreatingSub] = useState(false);

  // Copy key feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Pricing Submit Handler
  const handleSavePricing = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (adminRole !== 'MAIN_ADMIN') {
      alert('فقط الـ Main Admin يملك صلاحية تغيير أسعار الاشتراكات');
      return;
    }

    setIsSavingPricing(true);
    try {
      await onUpdateSettings({
        pricing: {
          ...pricing,
          updated_at: new Date().toISOString()
        }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`خطأ في حفظ الأسعار: ${err.message}`);
    } finally {
      setIsSavingPricing(false);
    }
  };

  // Edit Subscription Save Handler
  const handleSaveSubscriptionEdit = async () => {
    if (!editingLicense) return;
    setIsSavingEdit(true);
    try {
      const isLifetime = editPlan === 'lifetime';
      const priceCalc = calculateSimPrice(isLifetime ? 'lifetime' : 'yearly', editMaxDevices);

      const res = await fetch(`/api/licenses/${editingLicense.license_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': adminRole
        },
        body: JSON.stringify({
          plan: editPlan,
          subscription_type: isLifetime ? 'lifetime' : 'yearly',
          is_lifetime: isLifetime,
          max_devices: editMaxDevices,
          status: editStatus,
          expires_at: isLifetime ? null : (editExpiresAt || editingLicense.expires_at),
          price_dzd: priceCalc
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'فشل تحديث بيانات الاشتراك');

      if (onRefreshData) onRefreshData();
      setEditingLicense(null);
    } catch (err: any) {
      alert(`فشل التعديل: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Create Subscription Handler
  const handleCreateSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCustomerId) {
      alert('يرجى اختيار العميل');
      return;
    }

    const customer = customers.find(c => c.id === newSubCustomerId);
    if (!customer) {
      alert('العميل غير موجود');
      return;
    }

    setIsCreatingSub(true);
    try {
      const isLifetime = newSubPlan === 'lifetime';
      const calculatedPrice = calculateSimPrice(newSubPlan, newSubDevices);

      const res = await fetch('/api/subscriptions/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': adminRole
        },
        body: JSON.stringify({
          customer_id: customer.id,
          subscription_type: newSubPlan,
          device_count: newSubDevices,
          notes: newSubNotes || `Created via Subscriptions Management (${newSubPlan})`
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'فشل إنشاء وتفعيل الاشتراك');

      if (onRefreshData) onRefreshData();
      setIsCreateModalOpen(false);
      setNewSubCustomerId('');
      setNewSubNotes('');
      setActiveSubTab('subscriptions');
    } catch (err: any) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setIsCreatingSub(false);
    }
  };

  // Filtered Licenses
  const filteredLicenses = licenses.filter(lic => {
    const q = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (lic.license_key || '').toLowerCase().includes(q) ||
      (lic.customer_name || '').toLowerCase().includes(q) ||
      (lic.business_name || '').toLowerCase().includes(q) ||
      (lic.activity_code || '').toLowerCase().includes(q);

    const isLifetime = lic.is_lifetime || lic.plan === 'lifetime' || lic.subscription_type === 'lifetime';
    const isYearly = lic.subscription_type === 'yearly' || lic.plan === 'yearly';
    const isTrial = lic.plan === 'trial';

    let matchesType = true;
    if (filterType === 'yearly') matchesType = isYearly;
    if (filterType === 'lifetime') matchesType = isLifetime;
    if (filterType === 'trial') matchesType = isTrial;

    let matchesStatus = true;
    if (filterStatus !== 'all') matchesStatus = lic.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Statistics
  const yearlyCount = licenses.filter(l => l.subscription_type === 'yearly' || l.plan === 'yearly').length;
  const lifetimeCount = licenses.filter(l => l.is_lifetime || l.plan === 'lifetime' || l.subscription_type === 'lifetime').length;
  const activeCount = licenses.filter(l => l.status === 'active').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-5 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-950/30">
              <Sparkles className="w-5 h-5 text-zinc-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>إدارة الاشتراكات والأسعار المركزية</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  Annual & Lifetime Matrix
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                التحكم المركزي الكامل في أسعار الباقات، الاشتراكات السنوية، الاشتراكات الأبدية، وإدارة تراخيص الأجهزة.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {adminRole !== 'MAIN_ADMIN' && (
            <div className="text-xs bg-amber-950/60 text-amber-300 font-medium px-3 py-1.5 rounded-lg border border-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>لتعديل الأسعار: اختر Main Admin</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-emerald-950/40"
          >
            <UserPlus className="w-4 h-4" />
            <span>إصدار اشتراك جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800/80 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              اشتراكات سنوية (Yearly)
            </span>
            <span className="text-[10px] text-teal-400 font-mono font-semibold">365 يوم</span>
          </div>
          <div className="text-2xl font-bold text-teal-300 font-mono">{yearlyCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">تتجدد دورياً كل سنة</div>
        </div>

        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800/80 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5">
              <InfinityIcon className="w-3.5 h-3.5 text-indigo-400" />
              اشتراكات أبدية (Lifetime)
            </span>
            <span className="text-[10px] text-indigo-400 font-mono font-semibold">مدى الحياة</span>
          </div>
          <div className="text-2xl font-bold text-indigo-300 font-mono">{lifetimeCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">بدون تاريخ انتهاء صلاحية</div>
        </div>

        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800/80 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              تراخيص نشطة
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold">Active</span>
          </div>
          <div className="text-2xl font-bold text-emerald-300 font-mono">{activeCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">من إجمالي {licenses.length} ترخيص</div>
        </div>

        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800/80 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              طلبات معلقة
            </span>
            <span className="text-[10px] text-amber-400 font-mono font-semibold">Pending</span>
          </div>
          <div className="text-2xl font-bold text-amber-300 font-mono">{pendingRequestsCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">بانتظار الاعتماد المالي</div>
        </div>
      </div>

      {/* Main Sub-tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('pricing')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'pricing'
              ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>مصفوفة تسعير الخطط والأجهزة (Pricing Matrix)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('subscriptions')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'subscriptions'
              ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>قائمة اشتراكات العملاء ({licenses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('requests')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'requests'
              ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>طلبات الاشتراكات الواردة ({pendingRequestsCount})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. PRICING MATRIX TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-6">
          {/* Server API Connection Guide Card */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-zinc-900/40 rounded-xl border border-emerald-900/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-900/80 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                    <span>رابط خادم الأسعار المركزي (Backend API URL لتطبيق الكاسة)</span>
                    <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded font-mono">Live Endpoints</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    قم بضبط هذا الرابط داخل إعدادات تطبيق الكاسة (POS Client) ليقوم بجلب أحدث الأسعار المعدلة مباشرة من هذا السيرفر:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="font-mono text-xs text-emerald-300 bg-zinc-950 px-3 py-1.5 rounded-lg border border-emerald-900/80 select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api` : 'https://dzposs.ai.studio/api'}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(typeof window !== 'undefined' ? `${window.location.origin}/api` : 'https://dzposs.ai.studio/api')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  {copiedKey === (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'https://dzposs.ai.studio/api') ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800 text-[11px]">
              <div className="bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400 font-mono">GET /api/subscriptions/plans</span>
                <span className="text-emerald-400 font-medium">يدعم type: annual & lifetime</span>
              </div>
              <div className="bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400 font-mono">POST /api/subscriptions/calculate-price</span>
                <span className="text-emerald-400 font-medium">حساب السعر المالي المباشر</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSavePricing} className="space-y-6">
          <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-5 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>تعديل أسعار الاشتراكات السنوية والأبدية (Server-Side Pricing)</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  الأسعار المحددة هنا يتم اعتمادها مباشرة في الباكند وتظهر في تطبيق الكاسة وتمنع التلاعب المالي.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">العملة:</span>
                  <input
                    type="text"
                    disabled={adminRole !== 'MAIN_ADMIN'}
                    value={pricing.currency_symbol}
                    onChange={(e) => setPricing({ ...pricing, currency_symbol: e.target.value })}
                    className="w-16 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 text-xs font-mono font-bold text-center disabled:bg-zinc-950"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adminRole !== 'MAIN_ADMIN' || isSavingPricing}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingPricing ? 'جاري الحفظ...' : 'حفظ الأسعار وتطبيقها'}</span>
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تم حفظ مصفوفة أسعار الاشتراكات بنجاح وتحديث السيرفر المركزي.</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Yearly Plan Box */}
              <div className="bg-zinc-900/40 rounded-xl border border-teal-900/40 p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-950/80 border border-teal-800/40 flex items-center justify-center text-teal-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-teal-300">1. باقة الاشتراك السنوي (Yearly Plan)</h3>
                      <p className="text-[11px] text-zinc-400">صلاحية لمدة سنة كاملة (365 يوماً)</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-teal-950/80 border border-teal-500/40 text-teal-300 px-2 py-0.5 rounded font-semibold font-mono">
                    365 Days
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
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
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-1 bg-teal-950/30 p-2 rounded-lg border border-teal-800/40">
                    <label className="block text-[11px] font-bold text-teal-300 mb-1">لكل جهاز إضافي (+5)</label>
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-teal-700/60 bg-zinc-900 text-teal-200 text-xs font-mono font-bold disabled:bg-zinc-950"
                      />
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Lifetime Plan Box */}
              <div className="bg-zinc-900/40 rounded-xl border border-indigo-900/40 p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                      <InfinityIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-indigo-300">2. باقة الاشتراك الأبدي (Lifetime Plan ♾️)</h3>
                      <p className="text-[11px] text-zinc-400">شراء نهائي مدى الحياة بدون انتهاء</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded font-semibold font-mono">
                    Unlimited
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">جهاز واحد (1 POS)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="500"
                        disabled={adminRole !== 'MAIN_ADMIN'}
                        value={pricing.lifetime.devices_1}
                        onChange={(e) => setPricing({
                          ...pricing,
                          lifetime: { ...pricing.lifetime, devices_1: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                      />
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                        value={pricing.lifetime.devices_2}
                        onChange={(e) => setPricing({
                          ...pricing,
                          lifetime: { ...pricing.lifetime, devices_2: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                      />
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                        value={pricing.lifetime.devices_3}
                        onChange={(e) => setPricing({
                          ...pricing,
                          lifetime: { ...pricing.lifetime, devices_3: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                      />
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                        value={pricing.lifetime.devices_4}
                        onChange={(e) => setPricing({
                          ...pricing,
                          lifetime: { ...pricing.lifetime, devices_4: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                      />
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
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
                        value={pricing.lifetime.devices_5}
                        onChange={(e) => setPricing({
                          ...pricing,
                          lifetime: { ...pricing.lifetime, devices_5: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-mono disabled:bg-zinc-950"
                      />
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-1 bg-indigo-950/30 p-2 rounded-lg border border-indigo-800/40">
                    <label className="block text-[11px] font-bold text-indigo-300 mb-1">لكل جهاز إضافي (+5)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="500"
                        disabled={adminRole !== 'MAIN_ADMIN'}
                        value={pricing.lifetime.per_extra_device}
                        onChange={(e) => setPricing({
                          ...pricing,
                          lifetime: { ...pricing.lifetime, per_extra_device: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-700/60 bg-zinc-900 text-indigo-200 text-xs font-mono font-bold disabled:bg-zinc-950"
                      />
                      <span className="absolute left-2 top-1.5 text-[10px] text-zinc-500 pointer-events-none">{pricing.currency_symbol}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Simulator / Live Tester */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">محاكي وحاسبة الأسعار الفورية (Instant Price Simulator)</span>
                </div>
                <span className="text-[11px] text-zinc-400">اختبر احتساب الأسعار الحالية</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400 shrink-0">نوع الباقة:</label>
                  <select
                    value={simPlan}
                    onChange={(e) => setSimPlan(e.target.value as any)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs"
                  >
                    <option value="yearly">اشتراك سنوي (Yearly - 365 يوم)</option>
                    <option value="lifetime">اشتراك أبدي (Lifetime ♾️)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400 shrink-0">عدد الأجهزة:</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 8].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setSimDevices(cnt)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold cursor-pointer transition ${
                          simDevices === cnt
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {cnt === 8 ? '+8' : cnt}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      value={simDevices}
                      onChange={(e) => setSimDevices(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-16 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs font-mono text-center"
                    />
                  </div>
                </div>

                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">السعر الإجمالي:</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {calculateSimPrice(simPlan, simDevices).toLocaleString()} {pricing.currency_symbol}
                    </span>
                    {simDevices > 5 && (
                      <div className="text-[10px] text-zinc-400">
                        (شامل 5 أجهزة + {simDevices - 5} أجهزة إضافية)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ALL SUBSCRIPTIONS LIST TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'subscriptions' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="بحث بالمفتاح، اسم العميل، اسم المحل، أو النشاط..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                <option value="all">جميع الأنواع</option>
                <option value="yearly">اشتراكات سنوية (Yearly)</option>
                <option value="lifetime">اشتراكات أبدية (Lifetime ♾️)</option>
                <option value="trial">تراخيص تجريبية (Trial)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs cursor-pointer"
              >
                <option value="all">جميع الحالات</option>
                <option value="active">نشط (Active)</option>
                <option value="expired">منتهي (Expired)</option>
                <option value="revoked">ملغى (Revoked)</option>
              </select>
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800 text-[11px] font-semibold">
                    <th className="py-3 px-4">العميل والمحل</th>
                    <th className="py-3 px-4">مفتاح الترخيص (License Key)</th>
                    <th className="py-3 px-4">نوع الاشتراك</th>
                    <th className="py-3 px-4">الأجهزة المرتبطة</th>
                    <th className="py-3 px-4">الصلاحية وتاريخ الانتهاء</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-400">
                        <div className="flex flex-col items-center gap-2">
                          <Laptop className="w-8 h-8 text-zinc-600" />
                          <span>لا توجد اشتراكات مطابقة لمعايير البحث</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLicenses.map((lic) => {
                      const isLifetime = lic.is_lifetime || lic.plan === 'lifetime' || lic.subscription_type === 'lifetime';
                      const isYearly = lic.subscription_type === 'yearly' || lic.plan === 'yearly';
                      const activeDevs = (lic.devices || []).filter(d => d.status === 'active').length;
                      const maxDevs = lic.max_devices || 1;

                      return (
                        <tr key={lic.license_key} className="hover:bg-zinc-900/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-100">{lic.business_name || lic.customer_name}</div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                              <span>{lic.customer_name}</span>
                              <span>•</span>
                              <span className="font-mono text-zinc-500">{lic.activity_code}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-zinc-200 font-semibold bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 select-all">
                                {lic.license_key}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(lic.license_key)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                                title="نسخ المفتاح"
                              >
                                {copiedKey === lic.license_key ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isLifetime ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 shadow-xs">
                                <InfinityIcon className="w-3.5 h-3.5" />
                                <span>أبدي (Lifetime)</span>
                              </span>
                            ) : isYearly ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-950/80 text-teal-300 border border-teal-700/60 shadow-xs">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>سنوي (Yearly)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {lic.plan}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-zinc-200">
                                {activeDevs} / {maxDevs}
                              </span>
                              <span className="text-[11px] text-zinc-400">أجهزة</span>
                            </div>
                            <div className="w-24 h-1.5 rounded-full bg-zinc-800 mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  activeDevs >= maxDevs ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, (activeDevs / maxDevs) * 100)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            {isLifetime ? (
                              <span className="text-indigo-400 font-semibold text-xs">مدى الحياة (لا ينتهي)</span>
                            ) : lic.expires_at ? (
                              <div>
                                <span className="text-zinc-200">
                                  {new Date(lic.expires_at).toLocaleDateString('ar-DZ')}
                                </span>
                                <div className="text-[10px] text-zinc-400">
                                  {Math.ceil((new Date(lic.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم متبقي
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              lic.status === 'active'
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                : lic.status === 'expired'
                                ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                            }`}>
                              {lic.status === 'active' ? 'نشط' : lic.status === 'expired' ? 'منتهي' : 'ملغى'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLicense(lic);
                                  setEditMaxDevices(lic.max_devices || 1);
                                  setEditPlan(lic.plan || (lic.is_lifetime ? 'lifetime' : 'yearly'));
                                  setEditExpiresAt(lic.expires_at ? lic.expires_at.split('T')[0] : '');
                                  setEditStatus(lic.status);
                                }}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
                                title="تعديل تفاصيل الاشتراك والأجهزة"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                              </button>

                              {!isLifetime && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`هل تريد تمديد الاشتراك سنة إضافية (365 يوم) لـ ${lic.customer_name}؟`)) {
                                      await onExtendLicense(lic.license_key, 365);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-teal-950/60 hover:bg-teal-900 text-teal-300 border border-teal-800/40 transition cursor-pointer"
                                  title="تمديد سنة (365 يوم)"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PENDING REQUESTS TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'requests' && (
        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>طلبات الاشتراكات الواردة من الكاسات ونقاط البيع</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                مراجعة واعتماد طلبات التراخيص والاشتراكات السنوية والأبدية
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {requests.filter(r => r.status === 'pending').length === 0 ? (
              <div className="py-10 text-center text-zinc-400 text-xs">
                لا توجد طلبات اشتراكات معلقة حالياً
              </div>
            ) : (
              requests
                .filter(r => r.status === 'pending')
                .map(req => {
                  const isLifetime = req.is_lifetime || req.requested_plan === 'lifetime' || req.subscription_type === 'lifetime';
                  const reqDevices = req.requested_devices || 1;
                  const price = req.calculated_price_dzd || calculateSimPrice(isLifetime ? 'lifetime' : 'yearly', reqDevices);
                  const isWeb = req.source === 'website' || (req.source_label && req.source_label.includes('موقع'));
                  const isPhone = req.source === 'phone' || (req.source_label && req.source_label.includes('هاتف'));

                  return (
                    <div
                      key={req.request_id}
                      className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-zinc-100">{req.business_name}</span>
                          <span className="text-xs text-zinc-400">({req.customer_name})</span>
                          
                          {/* Source Distinction Badge */}
                          {isWeb ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-700">
                              <Globe className="w-3 h-3 text-blue-400" />
                              <span>موقع (صفحة الهبوط)</span>
                            </span>
                          ) : isPhone ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                              <Smartphone className="w-3 h-3 text-emerald-400" />
                              <span>هاتف (تطبيق الكاسة)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                              <span>{req.source_label || 'لوحة الإدارة'}</span>
                            </span>
                          )}

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isLifetime
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                              : 'bg-teal-950 text-teal-300 border border-teal-700'
                          }`}>
                            {isLifetime ? 'اشتراك أبدي' : 'اشتراك سنوي'} • {reqDevices} أجهزة
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-400">
                          <span>الهاتف: {req.phone}</span>
                          <span>الولاية: {req.wilaya_name}</span>
                          <span>النشاط: {req.activity_code}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-400 font-mono">
                            {price.toLocaleString()} {pricing.currency_symbol}
                          </div>
                          <div className="text-[10px] text-zinc-500">السعر المعتمد</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onApproveRequest(req.request_id, isLifetime ? 'lifetime' : 'yearly', isLifetime ? 0 : 365, reqDevices)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>اعتماد وإصدار الترخيص</span>
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT SUBSCRIPTION MODAL */}
      {/* ========================================================================= */}
      {editingLicense && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0e1017] rounded-xl border border-zinc-800 w-full max-w-lg p-6 space-y-5 shadow-xl text-right">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>تعديل تفاصيل الاشتراك والترخيص</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingLicense(null)}
                className="text-zinc-400 hover:text-zinc-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                <div className="text-zinc-400">العميل / المحل:</div>
                <div className="font-bold text-zinc-100 text-sm">{editingLicense.business_name} ({editingLicense.customer_name})</div>
                <div className="text-[11px] font-mono text-emerald-400">{editingLicense.license_key}</div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">نوع الاشتراك:</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                >
                  <option value="yearly">اشتراك سنوي (Yearly - 365 يوم)</option>
                  <option value="lifetime">اشتراك أبدي (Lifetime ♾️ مدى الحياة)</option>
                  <option value="pro">Pro (متقدم - 2 أجهزة)</option>
                  <option value="basic">Basic (أساسي - 1 جهاز)</option>
                  <option value="enterprise">Enterprise (شركات - 5+ أجهزة)</option>
                  <option value="trial">Trial (تجريبي)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">الحد الأقصى للأجهزة (Max Devices):</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editMaxDevices}
                    onChange={(e) => setEditMaxDevices(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">حالة الترخيص:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                  >
                    <option value="active">نشط (Active)</option>
                    <option value="suspended">موقوف مؤقتاً (Suspended)</option>
                    <option value="revoked">ملغى نهائياً (Revoked)</option>
                    <option value="expired">منتهي (Expired)</option>
                  </select>
                </div>
              </div>

              {editPlan !== 'lifetime' && (
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">تاريخ انتهاء الصلاحية:</label>
                  <input
                    type="date"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono"
                  />
                </div>
              )}

              {/* Bound Devices List with Unbind option */}
              {editingLicense.devices && editingLicense.devices.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="font-semibold text-zinc-300 text-xs">الأجهزة المرتبطة حالياً:</div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {editingLicense.devices.map(dev => (
                      <div key={dev.device_id} className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px]">
                        <div>
                          <span className="font-bold text-zinc-200">{dev.device_name}</span>
                          <span className="text-zinc-400 mr-2 font-mono">({dev.device_id})</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`هل تريد فك ربط الجهاز ${dev.device_name}؟`)) {
                              await onUnbindDevice(editingLicense.license_key, dev.device_id);
                              setEditingLicense(null);
                            }
                          }}
                          className="text-rose-400 hover:text-rose-300 text-[10px] px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/40 cursor-pointer"
                        >
                          فك الارتباط
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingLicense(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer hover:bg-zinc-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveSubscriptionEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE NEW SUBSCRIPTION MODAL */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateSubscriptionSubmit} className="bg-[#0e1017] rounded-xl border border-zinc-800 w-full max-w-lg p-6 space-y-5 shadow-xl text-right">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>إصدار وتفعيل اشتراك جديد لعميل</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">اختر العميل:</label>
                <select
                  required
                  value={newSubCustomerId}
                  onChange={(e) => setNewSubCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                >
                  <option value="">-- اختر من قائمة الزبائن المسجلين --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.business_name} ({c.wilaya_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">نوع الاشتراك:</label>
                  <select
                    value={newSubPlan}
                    onChange={(e) => setNewSubPlan(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                  >
                    <option value="yearly">اشتراك سنوي (365 يوم)</option>
                    <option value="lifetime">اشتراك أبدي (Lifetime ♾️)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">عدد الأجهزة (POS):</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newSubDevices}
                    onChange={(e) => setNewSubDevices(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {/* Calculated Price Box */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-zinc-400 text-[11px]">السعر الرسمي المحسوب من الباكند:</div>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    {calculateSimPrice(newSubPlan, newSubDevices).toLocaleString()} {pricing.currency_symbol}
                  </div>
                </div>
                <div className="text-[11px] text-zinc-400">
                  {newSubPlan === 'lifetime' ? 'صلاحية غير محدودة' : 'صلاحية 365 يوماً'}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">ملاحظات إضافية:</label>
                <input
                  type="text"
                  placeholder="ملاحظات العقد أو المحل..."
                  value={newSubNotes}
                  onChange={(e) => setNewSubNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer hover:bg-zinc-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isCreatingSub}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isCreatingSub ? 'جاري التفعيل...' : 'تفعيل وإصدار الترخيص'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
