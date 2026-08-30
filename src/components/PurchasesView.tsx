import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Receipt,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  Layers,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
  FileText,
  TrendingUp,
  Cpu,
  Phone,
  MapPin,
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  PurchaseInvoice,
  Supplier,
  BusinessActivity,
  Product,
  AiUsageEvent
} from '../types/dzpos.js';
import { AiInvoiceScannerModal } from './AiInvoiceScannerModal.js';

interface PurchasesViewProps {
  activities: BusinessActivity[];
  products: Product[];
  onRefreshProducts?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  activities,
  products,
  onRefreshProducts
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'suppliers' | 'ai_logs'>('invoices');
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [aiStats, setAiStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // View invoice detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  // Add Supplier Modal
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  const [newSupplierAddress, setNewSupplierAddress] = useState<string>('');
  const [newSupplierNif, setNewSupplierNif] = useState<string>('');

  // Notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all purchases and suppliers
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purRes, supRes, aiRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/purchases/suppliers/list'),
        fetch('/api/purchases/ai-usage/stats')
      ]);

      if (purRes.ok) {
        const purJson = await purRes.json();
        if (purJson.success) setPurchases(purJson.data || []);
      }

      if (supRes.ok) {
        const supJson = await supRes.json();
        if (supJson.success) setSuppliers(supJson.data || []);
      }

      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        if (aiJson.success) setAiStats(aiJson.data);
      }
    } catch (err) {
      console.error('Error loading purchases data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered purchases
  const filteredPurchases = purchases.filter(p => {
    const matchesSearch =
      !searchQuery.trim() ||
      (p.invoice_number && p.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.order_ref && p.order_ref.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.items && p.items.some(i => (i.matched_product_name || i.raw_name).toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesActivity = activityFilter === 'all' || p.activity_code === activityFilter;

    return matchesSearch && matchesStatus && matchesActivity;
  });

  // Calculate Metrics
  const totalVolumeDzd = purchases.reduce((acc, p) => acc + (p.total_ttc || 0), 0);
  const confirmedCount = purchases.filter(p => p.status === 'confirmed').length;
  const draftCount = purchases.filter(p => p.status === 'draft').length;
  const aiProcessedCount = purchases.filter(p => !!p.ai_metadata).length;

  // Confirm a draft invoice
  const handleConfirmInvoice = async (id: string) => {
    try {
      const res = await fetch(`/api/purchases/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('تم تأكيد الفاتورة وترحيل الكميات للمخزون بنجاح!');
        loadData();
        if (onRefreshProducts) onRefreshProducts();
      } else {
        alert(json.error || 'فشل تأكيد الفاتورة');
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  };

  // Delete an invoice
  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟')) return;
    try {
      const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('تم حذف الفاتورة بنجاح.');
        loadData();
      } else {
        alert(json.error || 'فشل حذف الفاتورة');
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال');
    }
  };

  // Create new supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    try {
      const res = await fetch('/api/purchases/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplierName,
          phone: newSupplierPhone,
          address: newSupplierAddress,
          nif: newSupplierNif
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('تمت إضافة المورد بنجاح');
        setIsAddSupplierOpen(false);
        setNewSupplierName('');
        setNewSupplierPhone('');
        setNewSupplierAddress('');
        setNewSupplierNif('');
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-6 z-50 p-4 rounded-xl bg-emerald-600 text-white shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Header & Primary AI Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Receipt className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white">إدارة المشتريات وفواتير الموردين</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
              الذكاء الاصطناعي مفعّل
            </span>
          </div>
          <p className="text-xs text-slate-400">
            معالجة فواتير الشراء بالـ OCR ومطابقة الباركود مع الكتالوج وترحيل المخزون التلقائي
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            id="open-ai-invoice-scanner-btn"
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>إضافة فاتورة بالذكاء الاصطناعي</span>
          </button>

          <button
            onClick={loadData}
            title="تحديث البيانات"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Volume */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي المشتريات</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {totalVolumeDzd.toLocaleString('fr-DZ')} <span className="text-xs text-slate-400 font-normal">د.ج</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">عبر {purchases.length} فاتورة مسجلة</div>
        </div>

        {/* Confirmed Stock */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>فواتير مؤكدة ومرحلة للمخزون</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {confirmedCount} <span className="text-xs text-slate-400 font-normal">فاتورة</span>
          </div>
          <div className="text-[10px] text-emerald-500/80">المخزون والأسعار محدثة فوراً</div>
        </div>

        {/* Drafts */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>مسودات قيد المراجعة</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {draftCount} <span className="text-xs text-slate-400 font-normal">مسودة</span>
          </div>
          <div className="text-[10px] text-amber-500/80">بانتظار المراجعة والترحيل</div>
        </div>

        {/* AI Processed */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>استخراج بالذكاء الاصطناعي</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-400 font-mono">
            {aiProcessedCount} <span className="text-xs text-slate-400 font-normal">فاتورة AI</span>
          </div>
          <div className="text-[10px] text-purple-400/80">Gemini 3.7 Vision Engine</div>
        </div>
      </div>

      {/* Sub Tabs Selector */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            id="tab-purchases-invoices-btn"
            onClick={() => setActiveSubTab('invoices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'invoices'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>قائمة الفواتير والمشتريات ({purchases.length})</span>
          </button>

          <button
            id="tab-purchases-suppliers-btn"
            onClick={() => setActiveSubTab('suppliers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'suppliers'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>دليل الموردين ({suppliers.length})</span>
          </button>

          <button
            id="tab-purchases-ai-logs-btn"
            onClick={() => setActiveSubTab('ai_logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'ai_logs'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>سجل وأداء الذكاء الاصطناعي</span>
          </button>
        </div>

        {activeSubTab === 'suppliers' && (
          <button
            onClick={() => setIsAddSupplierOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-xl border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مورد جديد</span>
          </button>
        )}
      </div>

      {/* SUB-TAB 1: Invoices List */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة، اسم المورد، مرجع الطلب، أو اسم منتج..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">الحالة:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">كل الحالات</option>
                <option value="confirmed">مؤكدة ومرحلة للمخزون</option>
                <option value="draft">مسودة قيد المراجعة</option>
              </select>
            </div>

            {/* Activity Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">النشاط:</span>
              <select
                value={activityFilter}
                onChange={e => setActivityFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">كل الأنشطة</option>
                {activities.map(a => (
                  <option key={a.code} value={a.code}>{a.name_ar}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-semibold select-none">
                  <tr>
                    <th className="p-3.5">رقم الفاتورة</th>
                    <th className="p-3.5">المورد</th>
                    <th className="p-3.5">التاريخ</th>
                    <th className="p-3.5">المنتجات</th>
                    <th className="p-3.5">الإجمالي الصافي TTC</th>
                    <th className="p-3.5">طريقة الدفع</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        {isLoading ? 'جاري تحميل الفواتير...' : 'لا توجد فواتير مطابقة لخيارات البحث الحالية.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map(purchase => (
                      <tr key={purchase.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Invoice Number & AI Tag */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white">{purchase.invoice_number}</span>
                            {purchase.ai_metadata && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                                AI
                              </span>
                            )}
                          </div>
                          {purchase.order_ref && (
                            <span className="text-[10px] text-slate-500 font-mono block">
                              مرجع: {purchase.order_ref}
                            </span>
                          )}
                        </td>

                        {/* Supplier */}
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-200">{purchase.supplier_name}</div>
                          {purchase.supplier_phone && (
                            <div className="text-[10px] text-slate-400 font-mono">{purchase.supplier_phone}</div>
                          )}
                        </td>

                        {/* Date */}
                        <td className="p-3.5 font-mono text-slate-400">
                          {purchase.invoice_date}
                        </td>

                        {/* Items Count */}
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono">
                            {purchase.items_count || purchase.items?.length || 0} أسطر
                          </span>
                        </td>

                        {/* Total TTC */}
                        <td className="p-3.5 font-bold font-mono text-emerald-400 text-sm">
                          {(purchase.total_ttc || 0).toLocaleString('fr-DZ')} <span className="text-[10px] font-normal text-slate-400">د.ج</span>
                        </td>

                        {/* Payment Method */}
                        <td className="p-3.5 text-slate-400 text-xs">
                          {purchase.payment_method || 'نقداً'}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 text-center">
                          {purchase.status === 'confirmed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>مؤكدة ومرحلة</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              <span>مسودة</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Detail */}
                            <button
                              onClick={() => setSelectedInvoice(purchase)}
                              title="عرض تفاصيل الفاتورة"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Confirm Draft */}
                            {purchase.status === 'draft' && (
                              <button
                                onClick={() => handleConfirmInvoice(purchase.id)}
                                title="تأكيد وترحيل إلى المخزون"
                                className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 transition-colors"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteInvoice(purchase.id)}
                              title="حذف الفاتورة"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Suppliers Directory */}
      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(sup => (
            <div
              key={sup.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{sup.name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sup.wilaya_name || 'الجزائر'}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400">
                  {sup.purchases_count || 0} فاتورة
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                {sup.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono text-slate-300">{sup.phone}</span>
                  </div>
                )}
                {sup.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{sup.address}</span>
                  </div>
                )}
                {sup.nif && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <span>NIF:</span>
                    <span>{sup.nif}</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between text-xs">
                <span className="text-slate-400">إجمالي المشتريات:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {(sup.total_purchases_dzd || 0).toLocaleString('fr-DZ')} د.ج
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 3: AI Analytics & Usage Logs */}
      {activeSubTab === 'ai_logs' && aiStats && (
        <div className="space-y-6">
          {/* AI Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">مجموع عمليات التحليل</span>
              <div className="text-2xl font-bold text-white font-mono">{aiStats.total_calls}</div>
              <div className="text-[10px] text-emerald-400">معدل النجاح: {aiStats.success_rate_percent}%</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">استهلاك التوكنز (Tokens)</span>
              <div className="text-2xl font-bold text-purple-400 font-mono">{aiStats.total_tokens?.toLocaleString('fr-DZ')}</div>
              <div className="text-[10px] text-slate-500">Gemini 3.7 Flash Multimodal</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">متوسط زمن الاستجابة</span>
              <div className="text-2xl font-bold text-blue-400 font-mono">{aiStats.average_latency_ms} ms</div>
              <div className="text-[10px] text-slate-500">تحليل فوري فائق السرعة</div>
            </div>
          </div>

          {/* AI Logs Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>سجل عمليات الذكاء الاصطناعي الحديثة</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-semibold select-none">
                  <tr>
                    <th className="p-3">العملية</th>
                    <th className="p-3">النموذج</th>
                    <th className="p-3">التوكنز</th>
                    <th className="p-3">زمن الاستجابة</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {aiStats.events?.map((evt: AiUsageEvent) => (
                    <tr key={evt.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-semibold text-white">{evt.operation}</td>
                      <td className="p-3 font-mono text-purple-300">{evt.model}</td>
                      <td className="p-3 font-mono text-slate-400">{evt.total_tokens || 0}</td>
                      <td className="p-3 font-mono text-blue-400">{evt.latency_ms}ms</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {evt.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">{new Date(evt.timestamp).toLocaleString('fr-DZ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AI Invoice Scanner Modal Component */}
      <AiInvoiceScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={(saved) => {
          showToast('تمت معالجة الفاتورة وحفظها بنجاح!');
          loadData();
          if (onRefreshProducts) onRefreshProducts();
        }}
        activities={activities}
        currentProducts={products}
      />

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>فاتورة شراء: {selectedInvoice.invoice_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      selectedInvoice.status === 'confirmed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {selectedInvoice.status === 'confirmed' ? 'مؤكدة' : 'مسودة'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    المورد: {selectedInvoice.supplier_name} • التاريخ: {selectedInvoice.invoice_date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">هاتف المورد:</span>
                  <span className="font-mono text-white">{selectedInvoice.supplier_phone || 'غير مسجل'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">الرقم الجبائي NIF:</span>
                  <span className="font-mono text-white">{selectedInvoice.supplier_tax_id || 'غير مسجل'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">طريقة الدفع:</span>
                  <span className="text-white">{selectedInvoice.payment_method || 'نقداً'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">مرجع الطلب:</span>
                  <span className="font-mono text-white">{selectedInvoice.order_ref || 'بدون'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300">قائمة المنتجات ({selectedInvoice.items?.length || 0})</h4>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">المنتج</th>
                        <th className="p-2.5 font-mono">الباركود</th>
                        <th className="p-2.5 text-center">الكمية</th>
                        <th className="p-2.5 text-left">سعر الوحدة HT</th>
                        <th className="p-2.5 text-left">سعر البيع</th>
                        <th className="p-2.5 text-left">الإجمالي TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {selectedInvoice.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5">
                            <div className="font-semibold text-white">{item.matched_product_name || item.raw_name}</div>
                            {item.raw_name && item.raw_name !== item.matched_product_name && (
                              <div className="text-[10px] text-slate-500 font-mono">الأصل: {item.raw_name}</div>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-slate-400">{item.barcode || '—'}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-400 font-mono">{item.quantity}</td>
                          <td className="p-2.5 text-left font-mono">{item.unit_price} د.ج</td>
                          <td className="p-2.5 text-left font-mono text-blue-300">{item.selling_price || '—'} د.ج</td>
                          <td className="p-2.5 text-left font-bold font-mono text-white">{item.total_ttc} د.ج</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="text-slate-400">Total HT: <span className="font-mono text-white">{selectedInvoice.subtotal_ht} د.ج</span></div>
                  <div className="text-slate-400">TVA: <span className="font-mono text-white">{selectedInvoice.total_tax} د.ج</span></div>
                </div>
                <div className="text-left">
                  <span className="text-xs text-slate-400 block">الصافي الإجمالي للدفع:</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">
                    {selectedInvoice.total_ttc?.toLocaleString('fr-DZ')} د.ج
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <form
            onSubmit={handleCreateSupplier}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">إضافة مورد جديد</h3>
              <button
                type="button"
                onClick={() => setIsAddSupplierOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">اسم المورد / الشركة:</label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  placeholder="مثال: SARL BatiPro"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">الهاتف:</label>
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={e => setNewSupplierPhone(e.target.value)}
                  placeholder="0550..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">العنوان / الولاية:</label>
                <input
                  type="text"
                  value={newSupplierAddress}
                  onChange={e => setNewSupplierAddress(e.target.value)}
                  placeholder="الجزائر العاصمة..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">الرقم الجبائي NIF / RC:</label>
                <input
                  type="text"
                  value={newSupplierNif}
                  onChange={e => setNewSupplierNif(e.target.value)}
                  placeholder="0998..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddSupplierOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                حفظ المورد
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
