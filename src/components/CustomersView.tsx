import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  Building,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Laptop,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';
import { Customer, CustomerStatus, BusinessActivity, License } from '../types/dzpos.js';

interface CustomersViewProps {
  customers: Customer[];
  activities: BusinessActivity[];
  licenses: License[];
  wilayas: { code: string; name: string }[];
  onCreateCustomer: (data: Partial<Customer>) => Promise<void>;
  onUpdateStatus: (customerId: string, status: CustomerStatus, reason?: string) => Promise<void>;
  onSelectCustomerForLicense: (customer: Customer) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  activities,
  licenses,
  wilayas,
  onCreateCustomer,
  onUpdateStatus,
  onSelectCustomerForLicense
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [wilayaFilter, setWilayaFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [revealedCustomerKeys, setRevealedCustomerKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleKey = (id: string) => {
    setRevealedCustomerKeys(prev => ({ ...prev, [id]: !prev[id] }));
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

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [activityCode, setActivityCode] = useState('grocery');
  const [wilayaCode, setWilayaCode] = useState('16');
  const [city, setCity] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered List
  const filtered = customers.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchActivity = activityFilter === 'all' || c.activity_code === activityFilter;
    const matchWilaya = wilayaFilter === 'all' || c.wilaya_code === wilayaFilter;

    return matchSearch && matchStatus && matchActivity && matchWilaya;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !businessName) return;

    setIsSubmitting(true);
    try {
      await onCreateCustomer({
        name,
        phone,
        email,
        business_name: businessName,
        activity_code: activityCode,
        wilaya_code: wilayaCode,
        city,
        admin_notes: adminNotes
      });
      setIsCreateOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setBusinessName('');
      setAdminNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
            <CheckCircle2 className="w-3 h-3" />
            <span>نشط (Active)</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-700/50">
            <AlertCircle className="w-3 h-3" />
            <span>معلق (Suspended)</span>
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-700/50">
            <XCircle className="w-3 h-3" />
            <span>محظور (Blocked)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>إدارة الزبائن (Clients Management)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            سجل أصحاب المحلات ونقاط البيع في 58 ولاية جزائرية، ربطهم بالتراخيص والأجهزة.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md shadow-emerald-950/50 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عميل جديد</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث بالاسم، النشاط، أو الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="all" className="bg-zinc-900 text-zinc-100">جميع الحالات (All Statuses)</option>
            <option value="active" className="bg-zinc-900 text-zinc-100">نشط فقط (Active)</option>
            <option value="suspended" className="bg-zinc-900 text-zinc-100">معلق (Suspended)</option>
            <option value="blocked" className="bg-zinc-900 text-zinc-100">محظور (Blocked)</option>
          </select>
        </div>

        {/* Activity Filter */}
        <div>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="all" className="bg-zinc-900 text-zinc-100">جميع الأنشطة (All Activities)</option>
            {activities.map(act => (
              <option key={act.code} value={act.code} className="bg-zinc-900 text-zinc-100">{act.name_ar} ({act.name_fr})</option>
            ))}
          </select>
        </div>

        {/* Wilaya Filter */}
        <div>
          <select
            value={wilayaFilter}
            onChange={(e) => setWilayaFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="all" className="bg-zinc-900 text-zinc-100">جميع الولايات (58 Wilayas)</option>
            {wilayas.map(w => (
              <option key={w.code} value={w.code} className="bg-zinc-900 text-zinc-100">{w.code} - {w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#111114] border-b border-zinc-800 text-zinc-400 font-semibold uppercase">
              <tr>
                <th className="px-4 py-3">العميل والنشاط التجاري</th>
                <th className="px-4 py-3">الاتصال والموقع</th>
                <th className="px-4 py-3">نوع النشاط</th>
                <th className="px-4 py-3">حالة الحساب</th>
                <th className="px-4 py-3">الترخيص والأجهزة</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    لا يوجد عملاء يطابقون خيارات البحث
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const custLicenses = licenses.filter(l => l.customer_id === c.id);
                  const activeLic = custLicenses.find(l => l.status === 'active');
                  const deviceCount = custLicenses.reduce((acc, l) => acc + (l.devices?.filter(d => d.status === 'active').length || 0), 0);

                  return (
                    <tr key={c.id} className="hover:bg-zinc-800/40 transition">
                      {/* Name & Business */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-zinc-100 text-sm">{c.name}</div>
                        <div className="text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3 text-zinc-500" />
                          <span>{c.business_name}</span>
                        </div>
                      </td>

                      {/* Contact & Wilaya */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-zinc-200 font-semibold">{c.phone}</div>
                        <div className="text-zinc-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>{c.wilaya_name} ({c.wilaya_code}) {c.city ? `- ${c.city}` : ''}</span>
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="px-4 py-3.5">
                        <span className="inline-block px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">
                          {c.activity_name || c.activity_code}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {getStatusBadge(c.status)}
                      </td>

                      {/* License & Device info */}
                      <td className="px-4 py-3.5">
                        {activeLic ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <span
                                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border block truncate max-w-[150px] transition ${
                                  revealedCustomerKeys[activeLic.license_id]
                                    ? 'text-emerald-400 bg-zinc-950 border-zinc-700/80'
                                    : 'text-zinc-400 bg-zinc-900 border-zinc-700/80 tracking-wider'
                                }`}
                              >
                                {maskLicenseKey(activeLic.license_key, Boolean(revealedCustomerKeys[activeLic.license_id]))}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleKey(activeLic.license_id)}
                                className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                                title={revealedCustomerKeys[activeLic.license_id] ? 'إخفاء' : 'إظهار'}
                              >
                                {revealedCustomerKeys[activeLic.license_id] ? (
                                  <EyeOff className="w-3 h-3 text-zinc-400 hover:text-amber-400" />
                                ) : (
                                  <Eye className="w-3 h-3 text-zinc-500 hover:text-emerald-400" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(activeLic.license_key)}
                                className="text-zinc-500 hover:text-emerald-400 p-0.5 cursor-pointer"
                                title="نسخ المفتاح"
                              >
                                {copiedKey === activeLic.license_key ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <Laptop className="w-3 h-3" />
                              <span>{deviceCount} جهاز كاسة متصل</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-[11px]">لا يوجد ترخيص نشط</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedCustomer(c)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 transition cursor-pointer"
                          >
                            التفاصيل
                          </button>
                          {!activeLic && (
                            <button
                              onClick={() => onSelectCustomerForLicense(c)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 transition cursor-pointer"
                              title="إصدار ترخيص جديد لهذا العميل"
                            >
                              إصدار ترخيص
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

      {/* Create Customer Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>إضافة زبون جديد في النظام</span>
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">اسم العميل (Nom & Prénom) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مراد بلقاسم"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">رقم الهاتف (Numéro de téléphone) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0555 12 34 56"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">البريد الإلكتروني (Email)</label>
                  <input
                    type="email"
                    placeholder="client@dzpos.dz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">اسم النشاط التجاري (Nom du Commerce) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: سوبرماركت البركة"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">نوع النشاط (Activité) *</label>
                  <select
                    value={activityCode}
                    onChange={(e) => setActivityCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {activities.map(act => (
                      <option key={act.code} value={act.code} className="bg-zinc-900 text-zinc-100">{act.name_ar} ({act.name_fr})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">الولاية (Wilaya) *</label>
                  <select
                    value={wilayaCode}
                    onChange={(e) => setWilayaCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {wilayas.map(w => (
                      <option key={w.code} value={w.code} className="bg-zinc-900 text-zinc-100">{w.code} - {w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">البلدية / الحي (Ville / Commune)</label>
                <input
                  type="text"
                  placeholder="مثال: باب الزوار"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">ملاحظات الإدارة (Admin Notes)</label>
                <textarea
                  rows={2}
                  placeholder="أي معلومات هامة حول العميل أو طريقة الدفع..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
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
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-100">{selectedCustomer.name}</h2>
                <p className="text-xs text-zinc-400">{selectedCustomer.business_name} - {selectedCustomer.wilaya_name}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Account Status Changer */}
              <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-300 block">حالة الحساب الحالية:</span>
                  <div className="mt-1">{getStatusBadge(selectedCustomer.status)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      await onUpdateStatus(selectedCustomer.id, 'active');
                      setSelectedCustomer({ ...selectedCustomer, status: 'active' });
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 font-semibold cursor-pointer"
                  >
                    تفعيل
                  </button>
                  <button
                    onClick={async () => {
                      const reason = prompt('سبب التعليق:');
                      if (reason !== null) {
                        await onUpdateStatus(selectedCustomer.id, 'suspended', reason);
                        setSelectedCustomer({ ...selectedCustomer, status: 'suspended' });
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/50 font-semibold cursor-pointer"
                  >
                    تعليق
                  </button>
                  <button
                    onClick={async () => {
                      const reason = prompt('سبب الحظر:');
                      if (reason !== null) {
                        await onUpdateStatus(selectedCustomer.id, 'blocked', reason);
                        setSelectedCustomer({ ...selectedCustomer, status: 'blocked' });
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/50 font-semibold cursor-pointer"
                  >
                    حظر
                  </button>
                </div>
              </div>

              {/* Linked Licenses */}
              <div>
                <h3 className="font-bold text-zinc-200 mb-2 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>التراخيص المرتبطة بالعميل</span>
                </h3>
                {licenses.filter(l => l.customer_id === selectedCustomer.id).length === 0 ? (
                  <div className="p-4 text-center bg-zinc-900/50 rounded-lg border border-zinc-800 text-zinc-500">
                    لا يوجد تراخيص مسجلة لهذا العميل حالياً.
                  </div>
                ) : (
                  licenses.filter(l => l.customer_id === selectedCustomer.id).map(lic => {
                    const isVisible = Boolean(revealedCustomerKeys[lic.license_id]);
                    return (
                      <div key={lic.license_id} className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800 mb-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded border text-xs transition ${
                                isVisible
                                  ? 'text-emerald-400 bg-zinc-950 border-zinc-800'
                                  : 'text-zinc-400 bg-zinc-900 border-zinc-800 tracking-wider'
                              }`}
                            >
                              {maskLicenseKey(lic.license_key, isVisible)}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleKey(lic.license_id)}
                              className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                              title={isVisible ? 'إخفاء' : 'إظهار'}
                            >
                              {isVisible ? (
                                <EyeOff className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-400" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(lic.license_key)}
                              className="text-zinc-400 hover:text-emerald-400 cursor-pointer"
                              title="نسخ المفتاح"
                            >
                              {copiedKey === lic.license_key ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <span className="capitalize font-semibold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded text-[11px] border border-zinc-700">
                            خطة {lic.plan} ({lic.status})
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-zinc-400">
                          <span>تاريخ الانتهاء: {new Date(lic.expires_at).toLocaleDateString()}</span>
                          <span>أجهزة نشطة: {lic.devices?.length || 0} / {lic.max_devices}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Admin Notes */}
              {selectedCustomer.admin_notes && (
                <div>
                  <h3 className="font-bold text-zinc-200 mb-1">ملاحظات الإدارة:</h3>
                  <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-zinc-300 whitespace-pre-wrap">
                    {selectedCustomer.admin_notes}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
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
