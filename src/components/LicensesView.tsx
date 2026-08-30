import React, { useState } from 'react';
import {
  KeyRound,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Clock,
  Laptop,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Calendar,
  Layers,
  Trash2,
  Eye,
  EyeOff,
  Smartphone
} from 'lucide-react';
import { License, Customer, LicensePlan, LicenseStatus } from '../types/dzpos.js';

interface LicensesViewProps {
  licenses: License[];
  customers: Customer[];
  onCreateLicense: (data: any) => Promise<void>;
  onExtendLicense: (licenseId: string, days: number, notes?: string) => Promise<void>;
  onUpdateStatus: (licenseId: string, status: LicenseStatus, reason?: string) => Promise<void>;
  onUnbindDevice: (licenseId: string, deviceId: string) => Promise<void>;
  preselectedCustomer?: Customer | null;
}

export const LicensesView: React.FC<LicensesViewProps> = ({
  licenses,
  customers,
  onCreateLicense,
  onExtendLicense,
  onUpdateStatus,
  onUnbindDevice,
  preselectedCustomer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(preselectedCustomer));
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [showAllKeys, setShowAllKeys] = useState(false);
  const [modalKeyRevealed, setModalKeyRevealed] = useState(false);

  const toggleKeyVisibility = (keyId: string) => {
    setRevealedKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const isKeyVisible = (keyId: string) => {
    return showAllKeys || Boolean(revealedKeys[keyId]);
  };

  const maskLicenseKey = (key: string, isVisible: boolean) => {
    if (isVisible) return key;
    if (!key) return '••••••••••••••••';
    const parts = key.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts.slice(1).map(() => '••••').join('-')}`;
    }
    return '••••-••••-••••-••••';
  };

  // Form State
  const [customerId, setCustomerId] = useState(preselectedCustomer?.id || (customers[0]?.id || ''));
  const [plan, setPlan] = useState<LicensePlan>('pro');
  const [durationDays, setDurationDays] = useState(365);
  const [maxDevices, setMaxDevices] = useState(2);
  const [customKey, setCustomKey] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('POS Terminal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Licenses
  const filtered = licenses.filter(l => {
    const q = (searchTerm || '').toLowerCase();
    const matchSearch =
      (l.license_key || '').toLowerCase().includes(q) ||
      (l.customer_name || '').toLowerCase().includes(q) ||
      (l.business_name || '').toLowerCase().includes(q);

    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchPlan = planFilter === 'all' || l.plan === planFilter;

    return matchSearch && matchStatus && matchPlan;
  });

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;

    setIsSubmitting(true);
    try {
      await onCreateLicense({
        customer_id: customerId,
        plan,
        duration_days: durationDays,
        max_devices: maxDevices,
        custom_key: customKey || undefined,
        device_id: deviceId || undefined,
        device_name: deviceName || undefined,
        notes
      });
      setIsCreateOpen(false);
      setCustomKey('');
      setDeviceId('');
      setDeviceName('POS Terminal');
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: LicenseStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
            <CheckCircle2 className="w-3 h-3" />
            <span>نشط (Active)</span>
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-700/50">
            <XCircle className="w-3 h-3" />
            <span>منتهي (Expired)</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-700/50">
            <PauseCircle className="w-3 h-3" />
            <span>مجمد (Suspended)</span>
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-400 border border-zinc-700">
            <AlertTriangle className="w-3 h-3" />
            <span>ملغى (Revoked)</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-400 border border-blue-700/50">
            <Clock className="w-3 h-3" />
            <span>معلق (Pending)</span>
          </span>
        );
    }
  };

  const getPlanBadge = (p: LicensePlan) => {
    const map: Record<LicensePlan, { bg: string; text: string; label: string }> = {
      trial: { bg: 'bg-zinc-800 text-zinc-300 border border-zinc-700', text: 'Trial', label: 'تجريبي' },
      basic: { bg: 'bg-blue-950/80 text-blue-300 border border-blue-700/50', text: 'Basic', label: 'أساسي (1 كاسة)' },
      pro: { bg: 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50', text: 'Pro', label: 'متقدم (2 كاسة)' },
      enterprise: { bg: 'bg-purple-950/80 text-purple-300 border border-purple-700/50', text: 'Enterprise', label: 'مؤسسات (5+ كاسة)' },
      yearly: { bg: 'bg-teal-950/80 text-teal-300 border border-teal-700/50', text: 'Yearly', label: 'اشتراك سنوي (Yearly)' },
      lifetime: { bg: 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50', text: 'Lifetime', label: 'اشتراك أبدي (Lifetime ♾️)' }
    };
    const item = map[p] || map.pro;
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${item.bg}`}>
        {item.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <span>إدارة التراخيص والمفاتيح (License Management)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            توليد مفاتيح الترخيص الفريدة، تمديد الفترات، تجميد/إلغاء التراخيص، وإدارة أجهزة الكاسة المربوطة.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md shadow-emerald-950/50 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>توليد ترخيص جديد</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث بمفتاح الترخيص أو اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="all" className="bg-zinc-900 text-zinc-100">جميع حالات التراخيص (All Statuses)</option>
            <option value="active" className="bg-zinc-900 text-zinc-100">نشط (Active)</option>
            <option value="expired" className="bg-zinc-900 text-zinc-100">منتهي الصلاحية (Expired)</option>
            <option value="suspended" className="bg-zinc-900 text-zinc-100">مجمد (Suspended)</option>
            <option value="revoked" className="bg-zinc-900 text-zinc-100">ملغى (Revoked)</option>
          </select>
        </div>

        <div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="all" className="bg-zinc-900 text-zinc-100">جميع الخطط (All Plans)</option>
            <option value="trial" className="bg-zinc-900 text-zinc-100">Trial (فترة تجريبية)</option>
            <option value="basic" className="bg-zinc-900 text-zinc-100">Basic (جهاز 1)</option>
            <option value="pro" className="bg-zinc-900 text-zinc-100">Pro (جهازين)</option>
            <option value="enterprise" className="bg-zinc-900 text-zinc-100">Enterprise (مؤسسات)</option>
          </select>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAllKeys(!showAllKeys)}
            className={`w-full h-full min-h-[34px] px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-2 font-medium cursor-pointer ${
              showAllKeys
                ? 'bg-amber-950/60 text-amber-300 border-amber-700/60 hover:bg-amber-900/60'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            {showAllKeys ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>إخفاء كافة المفاتيح</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>إظهار كافة المفاتيح</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#111114] border-b border-zinc-800 text-zinc-400 font-semibold uppercase">
              <tr>
                <th className="px-4 py-3">مفتاح الترخيص (License Key)</th>
                <th className="px-4 py-3">العميل والمحل</th>
                <th className="px-4 py-3">الخطة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الأجهزة المربوطة</th>
                <th className="px-4 py-3">الصلاحية وتاريخ الانتهاء</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    لا توجد تراخيص تطابق خيارات التصفية
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const now = Date.now();
                  const expMs = new Date(l.expires_at).getTime();
                  const daysLeft = Math.ceil((expMs - now) / 86400000);
                  const isExpiringSoon = daysLeft > 0 && daysLeft <= 15 && l.status === 'active';
                  const boundDevicesCount = l.devices?.filter(d => d.status === 'active').length || 0;
                  const isVisible = isKeyVisible(l.license_id);

                  return (
                    <tr key={l.license_id} className="hover:bg-zinc-800/40 transition">
                      {/* Key & Copy */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold px-2 py-1 rounded border text-xs select-all transition ${
                              isVisible
                                ? 'text-emerald-400 bg-zinc-950 border-zinc-800'
                                : 'text-zinc-400 bg-zinc-900/90 border-zinc-800 tracking-wider'
                            }`}
                          >
                            {maskLicenseKey(l.license_key, isVisible)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(l.license_id)}
                            className="p-1 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                            title={isVisible ? 'إخفاء مفتاح الترخيص' : 'إظهار مفتاح الترخيص'}
                          >
                            {isVisible ? (
                              <EyeOff className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(l.license_key)}
                            className="p-1 text-zinc-400 hover:text-emerald-400 transition cursor-pointer"
                            title="نسخ مفتاح الترخيص الأصلي"
                          >
                            {copiedKey === l.license_key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-zinc-100">{l.customer_name}</div>
                        <div className="text-zinc-400 font-medium text-[11px]">{l.business_name}</div>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3.5">
                        {getPlanBadge(l.plan)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {getStatusBadge(l.status)}
                      </td>

                      {/* Devices quota */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setSelectedLicense(l)}
                          className="flex items-center gap-1 text-zinc-300 hover:text-emerald-400 font-medium cursor-pointer"
                        >
                          <Laptop className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{boundDevicesCount} / {l.max_devices} جهاز</span>
                        </button>
                      </td>

                      {/* Expiry */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-zinc-200">
                          {new Date(l.expires_at).toLocaleDateString()}
                        </div>
                        <div className="text-[10px]">
                          {daysLeft > 0 ? (
                            <span className={isExpiringSoon ? 'text-amber-400 font-bold' : 'text-zinc-400'}>
                              متبقي {daysLeft} يوم {isExpiringSoon && '⚠️ تنبيه'}
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold">منتهي منذ {Math.abs(daysLeft)} يوم</span>
                          )}
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedLicense(l)}
                            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 font-medium transition cursor-pointer"
                          >
                            إدارة
                          </button>
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

      {/* Create License Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <span>إصدار ترخيص جديد (Issue License)</span>
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              {/* Customer Selector */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">العميل المستفيد (Client) *</label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-100">
                      {c.name} - {c.business_name} ({c.wilaya_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan & Devices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">نوع الخطة (Plan) *</label>
                  <select
                    value={plan}
                    onChange={(e) => {
                      const p = e.target.value as LicensePlan;
                      setPlan(p);
                      if (p === 'trial' || p === 'basic') setMaxDevices(1);
                      if (p === 'pro') setMaxDevices(2);
                      if (p === 'enterprise') setMaxDevices(5);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="trial" className="bg-zinc-900 text-zinc-100">Trial (فترة تجريبية 30 يوم)</option>
                    <option value="basic" className="bg-zinc-900 text-zinc-100">Basic (جهاز 1)</option>
                    <option value="pro" className="bg-zinc-900 text-zinc-100">Pro (جهازين كاسة)</option>
                    <option value="enterprise" className="bg-zinc-900 text-zinc-100">Enterprise (5 أجهزة كاسة)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">الحد الأقصى للأجهزة (Max Devices) *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">مدة الصلاحية بالأيام (Duration) *</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[30, 90, 180, 365].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationDays(d)}
                      className={`py-1.5 text-xs font-semibold rounded-md border transition cursor-pointer ${
                        durationDays === d
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      {d} يوم
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Custom Key (Optional) */}
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  مفتاح مخصص (اختياري - يترك فارغاً للتوليد الآمن التلقائي)
                </label>
                <input
                  type="text"
                  placeholder="DZPOS-PRO-XXXX-XXXX-XXXX"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Remote Device Binding (Zero-Touch) */}
              <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-sky-200 text-xs flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                    <span>تفعيل جهاز هاتف كاسة عن بعد (Zero-Touch Binding) - اختياري</span>
                  </label>
                  <span className="text-[10px] text-sky-400 bg-sky-900/60 px-1.5 py-0.5 rounded border border-sky-700/50 font-mono">
                    تلقائي
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      placeholder="معرّف الهاتف (Device ID) e.g. HW-DZ-..."
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="w-full px-2.5 py-1.5 font-mono text-[11px] rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="اسم الجهاز (e.g. Caisse 1)"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-sky-300/80">
                  إذا أدخلت معرّف الجهاز، سيتم تفعيل تطبيق DZPOS على هاتف العميل تلقائياً بمجرد فتح التطبيق دون الحاجة لكتابة المفتاح يدوياً.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">ملاحظات الترخيص</label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات حول طريقة تسليم المفتاح أو الدفع..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  {isSubmitting ? 'جاري التوليد...' : 'توليد وتفعيل الترخيص'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* License Detail / Device Manager Modal */}
      {selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-100">إدارة الترخيص</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded border text-xs select-all transition ${
                      modalKeyRevealed
                        ? 'text-emerald-400 bg-zinc-950 border-zinc-800'
                        : 'text-zinc-400 bg-zinc-900 border-zinc-800 tracking-wider'
                    }`}
                  >
                    {maskLicenseKey(selectedLicense.license_key, modalKeyRevealed)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalKeyRevealed(!modalKeyRevealed)}
                    className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    title={modalKeyRevealed ? 'إخفاء مفتاح الترخيص' : 'إظهار مفتاح الترخيص'}
                  >
                    {modalKeyRevealed ? (
                      <EyeOff className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-400" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedLicense.license_key)}
                    className="text-zinc-400 hover:text-emerald-400 cursor-pointer"
                    title="نسخ مفتاح الترخيص الأصلي"
                  >
                    {copiedKey === selectedLicense.license_key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedLicense(null)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Quick Actions: Extend, Suspend, Revoke */}
              <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-2.5">
                <span className="font-semibold text-zinc-300 block">إجراءات سريعة على الترخيص:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      const days = prompt('كم يوماً تريد تمديد الترخيص؟', '365');
                      if (days) {
                        await onExtendLicense(selectedLicense.license_id, parseInt(days, 10));
                        setSelectedLicense(null);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition cursor-pointer"
                  >
                    + تمديد الصلاحية
                  </button>
                  {selectedLicense.status === 'active' ? (
                    <button
                      onClick={async () => {
                        await onUpdateStatus(selectedLicense.license_id, 'suspended', 'Manual freeze by admin');
                        setSelectedLicense(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/50 font-semibold transition cursor-pointer"
                    >
                      تجميد مؤقت
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await onUpdateStatus(selectedLicense.license_id, 'active');
                        setSelectedLicense(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 font-semibold transition cursor-pointer"
                    >
                      إعادة التفعيل
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (confirm('هل أنت متأكد من إلغاء هذا الترخيص نهائياً؟')) {
                        await onUpdateStatus(selectedLicense.license_id, 'revoked');
                        setSelectedLicense(null);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/50 font-semibold transition cursor-pointer"
                  >
                    إلغاء الترخيص (Revoke)
                  </button>
                </div>
              </div>

              {/* Bound Devices Management */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-emerald-400" />
                    <span>أجهزة الكاسة المربوطة ({selectedLicense.devices?.length || 0} / {selectedLicense.max_devices})</span>
                  </h3>
                </div>

                {!selectedLicense.devices || selectedLicense.devices.length === 0 ? (
                  <div className="p-4 text-center bg-zinc-900/50 rounded-lg border border-zinc-800 text-zinc-500">
                    لم يتم تسجيل أي جهاز كاسة على هذا الترخيص بعد. عند تشغيل تطبيق DZPOS وإدخال المفتاح سيتم الربط تلقائياً.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedLicense.devices.map((dev) => (
                      <div
                        key={dev.device_id}
                        className="p-3 bg-zinc-900/70 rounded-lg border border-zinc-800 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                            <span>{dev.device_name || 'POS Terminal'}</span>
                            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded font-mono border border-zinc-700">
                              {dev.os}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-zinc-400">ID: {dev.device_id}</div>
                          <div className="text-[10px] text-zinc-500">
                            آخر اتصال: {new Date(dev.last_seen_at).toLocaleString()} | IP: {dev.ip_address || '127.0.0.1'}
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            if (confirm(`هل تريد فصل جهاز "${dev.device_name}" عن الترخيص؟`)) {
                              await onUnbindDevice(selectedLicense.license_id, dev.device_id);
                              setSelectedLicense({
                                ...selectedLicense,
                                devices: selectedLicense.devices.filter(d => d.device_id !== dev.device_id)
                              });
                            }
                          }}
                          className="p-2 text-rose-400 hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                          title="إلغاء ربط الجهاز (Kick Device)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* License Features */}
              <div>
                <h3 className="font-bold text-zinc-200 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>الميزات المصرح بها (Allowed Features):</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLicense.features?.map(f => (
                    <span key={f} className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 font-mono text-[10px]">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedLicense(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
