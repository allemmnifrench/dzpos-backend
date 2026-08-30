import React, { useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Phone,
  MapPin,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Smartphone,
  Zap,
  Radio,
  Globe
} from 'lucide-react';
import { LicenseRequest, LicensePlan } from '../types/dzpos.js';

interface RequestsViewProps {
  requests: LicenseRequest[];
  onApproveRequest: (requestId: string, options: any) => Promise<void>;
  onRejectRequest: (requestId: string, reason: string) => Promise<void>;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  onApproveRequest,
  onRejectRequest
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedRequestForApprove, setSelectedRequestForApprove] = useState<LicenseRequest | null>(null);
  const [selectedRequestForReject, setSelectedRequestForReject] = useState<LicenseRequest | null>(null);
  const [selectedRequestForRemote, setSelectedRequestForRemote] = useState<LicenseRequest | null>(null);

  // Approval Form State
  const [plan, setPlan] = useState<LicensePlan>('pro');
  const [durationDays, setDurationDays] = useState(365);
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remote Activation State
  const [remoteDeviceId, setRemoteDeviceId] = useState('');
  const [remoteDeviceName, setRemoteDeviceName] = useState('Mobile POS Terminal');
  const [remoteOs, setRemoteOs] = useState('Android POS');

  // Rejection Form State
  const [rejectReason, setRejectReason] = useState('');
  const [revealedRequestKeys, setRevealedRequestKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleKey = (id: string) => {
    setRevealedRequestKeys(prev => ({ ...prev, [id]: !prev[id] }));
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

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForApprove) return;

    setIsSubmitting(true);
    try {
      await onApproveRequest(selectedRequestForApprove.request_id, {
        plan,
        duration_days: durationDays,
        admin_notes: adminNotes
      });
      setSelectedRequestForApprove(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForRemote) return;

    setIsSubmitting(true);
    try {
      await onApproveRequest(selectedRequestForRemote.request_id, {
        plan,
        duration_days: durationDays,
        device_id: remoteDeviceId.trim() || undefined,
        device_name: remoteDeviceName.trim() || 'Mobile POS Terminal',
        os: remoteOs.trim() || 'Android POS',
        admin_notes: adminNotes || 'تفعيل فوري عن بعد'
      });
      setSelectedRequestForRemote(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForReject || !rejectReason) return;

    setIsSubmitting(true);
    try {
      await onRejectRequest(selectedRequestForReject.request_id, rejectReason);
      setSelectedRequestForReject(null);
      setRejectReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-700/50">
            <Clock className="w-3 h-3" />
            <span>قيد المراجعة (Pending)</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
            <CheckCircle2 className="w-3 h-3" />
            <span>تمت الموافقة وتوليد المفتاح</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-700/50">
            <XCircle className="w-3 h-3" />
            <span>مرفوض (Rejected)</span>
          </span>
        );
      default:
        return <span className="text-zinc-400 text-xs">{status}</span>;
    }
  };

  const getSourceBadge = (source?: string, source_label?: string) => {
    const isWeb = source === 'website' || (source_label && source_label.includes('موقع'));
    const isPhone = source === 'phone' || (source_label && source_label.includes('هاتف'));

    if (isWeb) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/90 text-blue-300 border border-blue-700/60 shadow-xs">
          <Globe className="w-3 h-3 text-blue-400" />
          <span>موقع (صفحة الهبوط)</span>
        </span>
      );
    }

    if (isPhone) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 shadow-xs">
          <Smartphone className="w-3 h-3 text-emerald-400" />
          <span>هاتف (تطبيق الكاسة)</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700/60 shadow-xs">
        <ShieldCheck className="w-3 h-3 text-zinc-400" />
        <span>{source_label || 'لوحة الإدارة'}</span>
      </span>
    );
  };

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (sourceFilter === 'website') {
      return r.source === 'website' || (r.source_label && r.source_label.includes('موقع'));
    }
    if (sourceFilter === 'phone') {
      return r.source === 'phone' || (r.source_label && r.source_label.includes('هاتف'));
    }
    return true;
  });

  const countWeb = requests.filter(r => r.source === 'website' || (r.source_label && r.source_label.includes('موقع'))).length;
  const countPhone = requests.filter(r => r.source === 'phone' || (r.source_label && r.source_label.includes('هاتف'))).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-emerald-400" />
            <span>طلبات التراخيص والاشتراكات (License Requests)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            مراجعة طلبات شراء وتفعيل التراخيص القادمة من الموقع (صفحة الهبوط) أو تطبيق الكاسة (الهاتف).
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Source Filter (موقع vs هاتف) */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                sourceFilter === 'all'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              جميع المصادر ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('website')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                sourceFilter === 'website'
                  ? 'bg-blue-950 text-blue-300 border border-blue-700 shadow-xs'
                  : 'text-blue-400/70 hover:text-blue-300'
              }`}
            >
              <Globe className="w-3 h-3 text-blue-400" />
              <span>موقع ({countWeb})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('phone')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                sourceFilter === 'phone'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 shadow-xs'
                  : 'text-emerald-400/70 hover:text-emerald-300'
              }`}
            >
              <Smartphone className="w-3 h-3 text-emerald-400" />
              <span>هاتف ({countPhone})</span>
            </button>
          </div>

          {/* Status Tab Filters */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'pending', label: 'معلقة' },
              { id: 'approved', label: 'المقبولة' },
              { id: 'rejected', label: 'المرفوضة' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-zinc-800 text-emerald-400 border border-zinc-700/60 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Requests List Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 p-12 text-center text-zinc-500">
            <Inbox className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="font-semibold text-sm">لا توجد طلبات مطابقة للفلتر المحدد</p>
          </div>
        ) : (
          filtered.map((req) => (
            <div
              key={req.request_id}
              className={`bg-[#0c0c0e] rounded-xl border p-4.5 shadow-sm transition space-y-3 ${
                req.status === 'pending'
                  ? 'border-amber-500/40 ring-1 ring-amber-500/20 bg-gradient-to-r from-[#0c0c0e] via-amber-950/10 to-[#0c0c0e]'
                  : 'border-zinc-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-zinc-100">{req.customer_name}</span>
                  <span className="font-mono text-xs text-zinc-500">({req.request_id})</span>
                  {getSourceBadge(req.source, req.source_label)}
                  {getStatusBadge(req.status)}
                </div>
                <div className="text-[11px] text-zinc-400">
                  تاريخ الطلب: {new Date(req.created_at).toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-zinc-400 block mb-0.5">المحل والنشاط:</span>
                  <div className="font-semibold text-zinc-200 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{req.business_name} ({req.activity_code})</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">الهاتف والموقع:</span>
                  <div className="font-semibold text-zinc-200 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{req.phone} - {req.wilaya_name}</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">الخطة المطلوبة:</span>
                  <div className="font-bold text-zinc-100">
                    خطة {(req.requested_plan || 'trial').toUpperCase()} ({req.requested_duration_days || 30} يوم)
                  </div>
                </div>
              </div>

              {req.device_id && (
                <div className="p-2.5 bg-sky-950/40 border border-sky-800/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-bold text-sky-200 flex items-center gap-1.5">
                        <span>جهاز هاتف كاسة (Remote Device ID):</span>
                        <span className="font-mono text-sky-300 bg-sky-900/60 px-1.5 py-0.5 rounded border border-sky-700/50">
                          {req.device_id}
                        </span>
                      </div>
                      <div className="text-[11px] text-sky-400/80">
                        {req.device_name || 'POS Terminal'} • {req.os || 'Android POS'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/50 animate-pulse">
                      <Radio className="w-2.5 h-2.5" />
                      <span>جاهز للتفعيل عن بعد (Zero-Touch)</span>
                    </span>
                  </div>
                </div>
              )}

              {req.notes && (
                <div className="p-2.5 bg-zinc-900/70 border border-zinc-800 rounded-lg text-zinc-300 text-xs">
                  <span className="font-bold text-zinc-200">ملاحظة العميل: </span>
                  {req.notes}
                </div>
              )}

              {/* Generated License Info if Approved */}
              {req.generated_license_key && (
                <div className="p-2.5 bg-emerald-950/50 border border-emerald-700/50 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-medium">
                    تم إصدار الترخيص وتفعيل الهاتف بنجاح:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded border border-emerald-700/50 text-xs transition ${
                        revealedRequestKeys[req.id]
                          ? 'text-emerald-400 bg-zinc-950'
                          : 'text-zinc-400 bg-zinc-900 tracking-wider'
                      }`}
                    >
                      {maskLicenseKey(req.generated_license_key, Boolean(revealedRequestKeys[req.id]))}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleKey(req.id)}
                      className="text-zinc-400 hover:text-zinc-200 cursor-pointer p-0.5"
                      title={revealedRequestKeys[req.id] ? 'إخفاء' : 'إظهار'}
                    >
                      {revealedRequestKeys[req.id] ? (
                        <EyeOff className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(req.generated_license_key!)}
                      className="text-zinc-400 hover:text-emerald-400 cursor-pointer p-0.5"
                      title="نسخ المفتاح"
                    >
                      {copiedKey === req.generated_license_key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Rejection reason if Rejected */}
              {req.rejection_reason && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-700/50 rounded-lg text-rose-300 text-xs">
                  <span className="font-bold">سبب الرفض: </span>
                  {req.rejection_reason}
                </div>
              )}

              {/* Actions if Pending */}
              {req.status === 'pending' && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2.5 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequestForReject(req);
                      setRejectReason('');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-semibold border border-rose-700/50 transition cursor-pointer"
                  >
                    رفض الطلب
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequestForApprove(req);
                      setPlan(req.requested_plan || 'pro');
                      setDurationDays(req.requested_duration_days || 365);
                      setAdminNotes('');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>موافقة وإصدار الترخيص</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequestForRemote(req);
                      setPlan(req.requested_plan || 'pro');
                      setDurationDays(req.requested_duration_days || 365);
                      setRemoteDeviceId(req.device_id || `DEV-DZ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
                      setRemoteDeviceName(req.device_name || 'Caisse Principale (POS)');
                      setRemoteOs(req.os || 'Android POS');
                      setAdminNotes('تفعيل فوري عن بعد');
                    }}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400/40 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                    <span>تفعيل عن بعد</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Approve Modal */}
      {selectedRequestForApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-800 space-y-4 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>الموافقة وتوليد الترخيص</span>
              </h2>
              <button
                onClick={() => setSelectedRequestForApprove(null)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1">
                <div className="font-bold text-zinc-100">{selectedRequestForApprove.customer_name}</div>
                <div className="text-zinc-400">{selectedRequestForApprove.business_name} - {selectedRequestForApprove.phone}</div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">الخطة الممنوحة (Plan)</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as LicensePlan)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="trial" className="bg-zinc-900 text-zinc-100">Trial (فترة تجريبية 30 يوم)</option>
                  <option value="basic" className="bg-zinc-900 text-zinc-100">Basic (جهاز 1)</option>
                  <option value="pro" className="bg-zinc-900 text-zinc-100">Pro (جهازين)</option>
                  <option value="enterprise" className="bg-zinc-900 text-zinc-100">Enterprise (مؤسسات 5 أجهزة)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">المدة بالأيام (Duration)</label>
                <input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">ملاحظات الإدارة</label>
                <input
                  type="text"
                  placeholder="موافقة هاتفية / تم الدفع..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedRequestForApprove(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  {isSubmitting ? 'جاري الإصدار...' : 'تأكيد وإصدار المفتاح'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {selectedRequestForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-800 space-y-4 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                <span>رفض طلب الترخيص</span>
              </h2>
              <button
                onClick={() => setSelectedRequestForReject(null)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">سبب الرفض (Rejection Reason) *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="سبب الرفض لتوضيحه للعميل..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedRequestForReject(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'تأكيد الرفض'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remote Activation Modal */}
      {selectedRequestForRemote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-500/30 space-y-4 text-zinc-100 ring-1 ring-emerald-500/20">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400 animate-pulse" />
                <span>التفعيل عن بعد لجهاز الكاسة (Remote Activation)</span>
              </h2>
              <button
                type="button"
                onClick={() => setSelectedRequestForRemote(null)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRemoteSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-700/40 space-y-1 text-xs">
                <div className="font-bold text-emerald-200">{selectedRequestForRemote.customer_name} ({selectedRequestForRemote.business_name})</div>
                <div className="text-emerald-400/80 flex items-center gap-2">
                  <span>{selectedRequestForRemote.phone}</span>
                  <span>•</span>
                  <span>{selectedRequestForRemote.wilaya_name}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">معرّف الجهاز (Device Hardware ID / HWID) *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="DEV-DZ-XXXXXX أو Hardware ID"
                    value={remoteDeviceId}
                    onChange={(e) => setRemoteDeviceId(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-emerald-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <Smartphone className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  المعرّف الفريد لجهاز الكاسة/الهاتف لربطه فورياً بالسيرفر.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">اسم الجهاز (Device Name)</label>
                  <input
                    type="text"
                    value={remoteDeviceName}
                    onChange={(e) => setRemoteDeviceName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">نظام التشغيل (OS)</label>
                  <input
                    type="text"
                    value={remoteOs}
                    onChange={(e) => setRemoteOs(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">الخطة الممنوحة (Plan)</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as LicensePlan)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="trial" className="bg-zinc-900 text-zinc-100">Trial (فترة تجريبية 30 يوم)</option>
                    <option value="basic" className="bg-zinc-900 text-zinc-100">Basic (جهاز 1)</option>
                    <option value="pro" className="bg-zinc-900 text-zinc-100">Pro (جهازين)</option>
                    <option value="enterprise" className="bg-zinc-900 text-zinc-100">Enterprise (5 أجهزة)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">المدة بالأيام (Duration)</label>
                  <input
                    type="number"
                    min="1"
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <div className="font-semibold text-zinc-200 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تفعيل تلقائي مباشر (Zero-Touch):</span>
                </div>
                <div>
                  سيتم إنشاء مفتاح الترخيص، تسجيل الجهاز في السيرفر وتفعيله عن بعد فورياً دون أي خطوات إضافية.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedRequestForRemote(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !remoteDeviceId.trim()}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-md shadow-emerald-950/60 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                  <span>{isSubmitting ? 'جاري التفعيل عن بعد...' : 'تفعيل الجهاز عن بعد الآن'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
