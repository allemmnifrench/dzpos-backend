import React from 'react';
import {
  Users,
  KeyRound,
  Inbox,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  MapPin,
  Laptop,
  FileCode2,
  Shield,
  Activity,
  Boxes,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { Customer, License, LicenseRequest, BusinessActivity, ProductPack, AuditLog } from '../types/dzpos.js';

interface DashboardViewProps {
  customers: Customer[];
  licenses: License[];
  requests: LicenseRequest[];
  activities: BusinessActivity[];
  packs: ProductPack[];
  auditLogs: AuditLog[];
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  customers,
  licenses,
  requests,
  activities,
  packs,
  auditLogs,
  onNavigate
}) => {
  const activeLicenses = licenses.filter(l => l.status === 'active');
  const expiredLicenses = licenses.filter(l => l.status === 'expired');
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const totalDevices = licenses.reduce((acc, l) => acc + (l.devices?.filter(d => d.status === 'active').length || 0), 0);
  const activeCustomers = customers.filter(c => c.status === 'active');

  // Group by Wilaya
  const wilayaMap: Record<string, { code: string; name: string; count: number }> = {};
  customers.forEach(c => {
    const code = c.wilaya_code || '00';
    const name = c.wilaya_name || `ولاية ${code}`;
    if (!wilayaMap[code]) {
      wilayaMap[code] = { code, name, count: 0 };
    }
    wilayaMap[code].count += 1;
  });
  const topWilayas = Object.values(wilayaMap).sort((a, b) => b.count - a.count).slice(0, 5);
  const maxWilayaCount = topWilayas.length > 0 ? Math.max(...topWilayas.map(w => w.count)) : 1;

  // Plan Distribution stats
  const planStats = [
    { plan: 'pro', label: 'Pro (متقدم)', count: licenses.filter(l => l.plan === 'pro').length, color: 'bg-emerald-500', barColor: '#10b981' },
    { plan: 'basic', label: 'Basic (أساسي)', count: licenses.filter(l => l.plan === 'basic').length, color: 'bg-blue-500', barColor: '#3b82f6' },
    { plan: 'enterprise', label: 'Enterprise (شركات)', count: licenses.filter(l => l.plan === 'enterprise').length, color: 'bg-purple-500', barColor: '#a855f7' },
    { plan: 'trial', label: 'Trial (تجريبي)', count: licenses.filter(l => l.plan === 'trial').length, color: 'bg-zinc-500', barColor: '#71717a' },
    { plan: 'yearly', label: 'Yearly (سنوي)', count: licenses.filter(l => l.plan === 'yearly').length, color: 'bg-teal-500', barColor: '#14b8a6' },
    { plan: 'lifetime', label: 'Lifetime (أبدي)', count: licenses.filter(l => l.plan === 'lifetime').length, color: 'bg-indigo-500', barColor: '#6366f1' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Section: Clean & Professional SaaS title + quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">لوحة التحكم والمراقبة</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>السيرفر متصل</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            إدارة مركزية لتراخيص نقاط البيع، مزامنة قواعد البيانات بدون إنترنت، ومراقبة العمليات عبر 58 ولاية.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('pos_simulator')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-medium transition cursor-pointer shadow-sm"
          >
            <Laptop className="w-4 h-4" />
            <span>محاكي الكاسة</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('api_docs')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs sm:text-sm font-medium border border-zinc-800 transition cursor-pointer"
          >
            <FileCode2 className="w-4 h-4 text-zinc-400" />
            <span>دليل الـ API</span>
          </button>
        </div>
      </div>

      {/* 2. Unified KPI Summary Bar (Linear/Stripe Style) */}
      <div className="bg-[#121318] border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-zinc-800/80">
          {/* Metric 1: Total Customers */}
          <div
            onClick={() => onNavigate('customers')}
            className="p-5 hover:bg-zinc-900/40 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>إجمالي الزبائن</span>
              <Users className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-100">
                {customers.length}
              </span>
              <span className="text-xs text-zinc-400">محل ومؤسسة</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
              <span className="text-emerald-400 font-medium">{activeCustomers.length} حساب نشط</span>
              <span className="text-zinc-400">{Object.keys(wilayaMap).length} ولاية</span>
            </div>
          </div>

          {/* Metric 2: Active Licenses */}
          <div
            onClick={() => onNavigate('licenses')}
            className="p-5 hover:bg-zinc-900/40 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>التراخيص المفعلة</span>
              <KeyRound className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400 transition" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-400">
                {activeLicenses.length}
              </span>
              <span className="text-xs text-zinc-400">من أصل {licenses.length}</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
              <span>{totalDevices} جهاز مربوط</span>
              {expiredLicenses.length > 0 ? (
                <span className="text-rose-400 font-medium">{expiredLicenses.length} منتهي</span>
              ) : (
                <span className="text-zinc-400">لا توجد اشتراكات منتهية</span>
              )}
            </div>
          </div>

          {/* Metric 3: Pending Requests */}
          <div
            onClick={() => onNavigate('requests')}
            className={`p-5 transition cursor-pointer group ${
              pendingRequests.length > 0 ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]' : 'hover:bg-zinc-900/40'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>طلبات الشراء والتجديد</span>
              <Inbox className={`w-4 h-4 ${pendingRequests.length > 0 ? 'text-amber-400' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${
                pendingRequests.length > 0 ? 'text-amber-400' : 'text-zinc-100'
              }`}>
                {pendingRequests.length}
              </span>
              <span className="text-xs text-zinc-400">طلب جديد</span>
            </div>
            <div className="mt-2 text-xs flex items-center justify-between">
              {pendingRequests.length > 0 ? (
                <span className="text-amber-400 font-medium inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>يتطلب إجراء فوري</span>
                </span>
              ) : (
                <span className="text-zinc-400">تمت معالجة كافة الطلبات</span>
              )}
              <span className="text-zinc-400 group-hover:text-zinc-200 flex items-center gap-0.5">
                <span>مراجعة</span>
                <ChevronLeft className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Metric 4: Product Packs */}
          <div
            onClick={() => onNavigate('packs')}
            className="p-5 hover:bg-zinc-900/40 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>كتالوجات المنتجات (Packs)</span>
              <Layers className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-100">
                {packs.length}
              </span>
              <span className="text-xs text-zinc-400">حزمة منشورة</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
              <span>{activities.length} نشاط مهيأ</span>
              <span className="text-emerald-400 font-medium">مزامنة Offline جاهزة</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Actionable Priority Alert: Pending License Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-[#121318] border border-amber-500/30 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-zinc-100">
                  طلبات تراخيص بانتظار الموافقة ({pendingRequests.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  هناك عملاء تقدموا بطلبات تفعيل أو تجديد تراخيص نقاط البيع تحتاج لمراجعة واعتماد لتوليد مفاتيح الترخيص.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('requests')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 transition cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>فتح قسم الطلبات واعتمادها</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                  <th className="py-2.5 px-3">اسم المحل / الزبون</th>
                  <th className="py-2.5 px-3">الولاية</th>
                  <th className="py-2.5 px-3">النشاط التجاري</th>
                  <th className="py-2.5 px-3">الخطة المطلوبة</th>
                  <th className="py-2.5 px-3">رقم الهاتف</th>
                  <th className="py-2.5 px-3">تاريخ الطلب</th>
                  <th className="py-2.5 px-3 text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {pendingRequests.slice(0, 3).map((req, idx) => (
                  <tr key={req.request_id || req.customer_id || `req-pending-${idx}`} className="hover:bg-zinc-900/40 transition">
                    <td className="py-2.5 px-3 font-semibold text-zinc-200">
                      <div>{req.business_name}</div>
                      <div className="text-[11px] text-zinc-400 font-normal">{req.customer_name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{req.wilaya_name || `ولاية ${req.wilaya_code}`}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{req.activity_code}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px] font-mono uppercase font-semibold">
                        {req.requested_plan}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{req.phone}</td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {new Date(req.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                    <td className="py-2.5 px-3 text-left">
                      <button
                        type="button"
                        onClick={() => onNavigate('requests')}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-300 text-[11px] font-medium transition cursor-pointer"
                      >
                        مراجعة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Dual Section: Analytics / Distribution + Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Analytics & Distribution */}
        <div className="lg:col-span-2 space-y-6">
          {/* License & Geographical Distribution */}
          <div className="bg-[#121318] border border-zinc-800/80 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm sm:text-base font-semibold text-zinc-100">تحليل التراخيص والانتشار الجغرافي</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('subscriptions')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition flex items-center gap-1 cursor-pointer"
              >
                <span>تعديل الأسعار والاشتراكات</span>
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Distribution by Plan */}
              <div className="space-y-3.5">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  حسب باقة الاشتراك (Plans)
                </div>

                {/* Progress bar visual */}
                <div className="h-2.5 rounded-full bg-zinc-900 overflow-hidden flex border border-zinc-800">
                  {planStats.map((item, idx) => {
                    const pct = licenses.length > 0 ? (item.count / licenses.length) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={`bar-plan-${item.plan || idx}`}
                        style={{ width: `${pct}%`, backgroundColor: item.barColor }}
                        title={`${item.label}: ${item.count} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Plan List */}
                <div className="space-y-2 pt-1">
                  {planStats.map((item, idx) => {
                    const pct = licenses.length > 0 ? Math.round((item.count / licenses.length) * 100) : 0;
                    return (
                      <div key={`stat-plan-${item.plan || idx}`} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.color}`} />
                          <span className="text-zinc-300 font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-400 font-mono text-[11px]">{pct}%</span>
                          <span className="font-mono font-semibold text-zinc-200 w-8 text-left">{item.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Wilayas */}
              <div className="space-y-3.5">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  أعلى الولايات انتشاراً
                </div>

                <div className="space-y-2.5">
                  {topWilayas.length > 0 ? (
                    topWilayas.map((w, idx) => {
                      const pct = Math.round((w.count / maxWilayaCount) * 100);
                      return (
                        <div key={w.code ? `wilaya-${w.code}` : `wilaya-${w.name || idx}-${idx}`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-zinc-400 w-4">{idx + 1}.</span>
                              <span className="text-zinc-200 font-medium">{w.name}</span>
                            </div>
                            <span className="font-mono text-zinc-400 text-xs">{w.count} عملاء</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800/80">
                            <div
                              className="h-full rounded-full bg-zinc-400 transition-all duration-300"
                              style={{ width: `${Math.max(8, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-zinc-400 py-4 text-center">لا توجد بيانات زبائن حالياً</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Business Activities Grid */}
          <div className="bg-[#121318] border border-zinc-800/80 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm sm:text-base font-semibold text-zinc-100">
                  كتالوجات الأنشطة التجارية المهيأة ({activities.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('activities')}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1 cursor-pointer"
              >
                <span>تهيئة الأنشطة</span>
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {activities.map((act, idx) => (
                <div
                  key={act.code || act.id || `act-${idx}`}
                  onClick={() => onNavigate('packs')}
                  className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition cursor-pointer"
                >
                  <div className="text-xs font-semibold text-zinc-200 truncate">{act.name_ar}</div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate">{act.name_fr || act.code}</div>
                  <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-emerald-400 font-medium">v{act.latest_pack_version || 1}.0.0</span>
                    <span className="text-zinc-400">{act.total_products || 0} منتج</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Live Audit Trail */}
        <div className="bg-[#121318] border border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm sm:text-base font-semibold text-zinc-100">سجل العمليات (Audit)</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1 cursor-pointer"
            >
              <span>عرض الكل</span>
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1">
            {auditLogs && auditLogs.length > 0 ? (
              auditLogs.slice(0, 8).map((log, idx) => (
                <div
                  key={log.id || `audit-${log.timestamp || idx}-${idx}`}
                  className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/70 hover:border-zinc-700/80 transition text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">{log.action}</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(log.timestamp).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    <span>المستخدم:</span>
                    <span className="text-zinc-300 font-medium">{log.actor}</span>
                    <span className="text-[10px] text-zinc-400">({log.actor_role})</span>
                  </div>

                  {log.details && (
                    <div className="text-[10px] font-mono bg-zinc-950 px-2 py-1 rounded border border-zinc-800/80 text-zinc-400 truncate">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-400 text-center py-8">لا توجد عمليات مسجلة حتى الآن</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
