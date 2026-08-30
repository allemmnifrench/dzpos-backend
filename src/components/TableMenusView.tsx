import React, { useState, useEffect } from 'react';
import {
  Utensils,
  QrCode,
  Table as TableIcon,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Smartphone,
  Sparkles,
  Layers,
  ShoppingBag,
  Building2,
  Printer,
  ChefHat,
  Receipt,
  ScanLine,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { RestaurantMenu, MenuTable, License, TableOrder } from '../types/dzpos.js';

interface TableMenusViewProps {
  licenses: License[];
  onOpenPublicPreview: (slug: string, tableCode?: string) => void;
}

export function TableMenusView({ licenses, onOpenPublicPreview }: TableMenusViewProps) {
  const [activeTab, setActiveTab] = useState<'menus' | 'live_orders'>('menus');
  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [tables, setTables] = useState<MenuTable[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Table Add/Edit Modal
  const [isAddTableOpen, setIsAddTableOpen] = useState<boolean>(false);
  const [newTableCode, setNewTableCode] = useState<string>('');
  const [newTableLabel, setNewTableLabel] = useState<string>('');
  const [newTableZone, setNewTableZone] = useState<string>('الصالة الرئيسية');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);

  // QR Print / Poster Modal
  const [qrModalTable, setQrModalTable] = useState<{ menu: RestaurantMenu; table?: MenuTable } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Publish Demo Simulator
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);

  // Live Orders & Waiter Scanner State
  const [liveOrders, setLiveOrders] = useState<TableOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [scanInput, setScanInput] = useState<string>('');
  const [scannedOrder, setScannedOrder] = useState<TableOrder | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const loadMenusAndTables = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/menu/admin/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.menus)) {
        setMenus(data.menus);
        if (data.menus.length > 0 && !selectedMenuId) {
          setSelectedMenuId(data.menus[0].id);
        }
      }

      // Load tables
      const tablesRes = await fetch('/api/menu/tables');
      const tablesData = await tablesRes.json();
      if (tablesData.success && Array.isArray(tablesData.tables)) {
        setTables(tablesData.tables);
      }
    } catch (err: any) {
      console.error('Error fetching menus:', err);
      setError('فشل في جلب بيانات المينو والطاولات');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLiveOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setLiveOrders(data.orders);
      }
    } catch (e) {
      console.error('Error fetching live orders:', e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadMenusAndTables();
    loadLiveOrders();
  }, []);

  // Poll live orders every 4 seconds when in live_orders tab
  useEffect(() => {
    if (activeTab !== 'live_orders') return;
    const interval = setInterval(loadLiveOrders, 4000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const selectedMenu = menus.find(m => m.id === selectedMenuId) || menus[0];
  const selectedMenuTables = tables.filter(t => t.menu_id === selectedMenu?.id);

  const handleToggleMenu = async (menuId: string) => {
    try {
      const res = await fetch(`/api/menu/admin/${menuId}/toggle`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        setMenus(prev => prev.map(m => m.id === menuId ? { ...m, enabled: data.enabled } : m));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu || !newTableCode.trim()) return;

    try {
      const res = await fetch('/api/menu/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: selectedMenu.id,
          license_key: selectedMenu.license_key,
          table_number: newTableCode.trim(),
          table_code: newTableCode.trim(),
          label_ar: newTableLabel.trim() || `طاولة رقم ${newTableCode.trim()}`,
          capacity: newTableCapacity,
          zone: newTableZone,
          enabled: true
        })
      });

      const data = await res.json();
      if (data.success && data.table) {
        setTables(prev => [...prev.filter(t => t.id !== data.table.id), data.table]);
        setIsAddTableOpen(false);
        setNewTableCode('');
        setNewTableLabel('');
      }
    } catch (err) {
      console.error('Error adding table:', err);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الطاولة؟')) return;
    try {
      const res = await fetch(`/api/menu/tables/${tableId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTables(prev => prev.filter(t => t.id !== tableId));
      }
    } catch (err) {
      console.error('Error deleting table:', err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    const fullUrl = `${window.location.origin}${text}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Trigger demo POS sync publish
  const handlePublishDemoMenu = async () => {
    setIsPublishing(true);
    setPublishSuccessMessage(null);
    try {
      const demoLicense = licenses[0]?.license_key || 'DZPOS-PRO-7A9B-4C2E-88D1';
      const res = await fetch('/api/menu/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${demoLicense}`
        },
        body: JSON.stringify({
          restaurant_name: 'مطعم ومشاوي الباهية',
          public_slug: 'el-bahia-resto',
          tagline: 'أشهى المأكولات والمشاوي التقليدية على الفحم',
          description: 'أفضل تجربة تذوق للمشاوي الطازجة، البيتزا الإيطالية، والأطباق التقليدية العريقة في وهران.',
          phone: '041 33 22 11',
          whatsapp: '213550123456',
          wifi_ssid: 'ElBahia_Guest',
          wifi_password: 'bahia2026',
          theme_color: '#E11D48',
          snapshot: {
            categories: [
              { category_id: 'cat_grill', name: 'مشاوي على الفحم', name_ar: 'مشاوي على الفحم', icon: '🔥', sort_order: 1 },
              { category_id: 'cat_dishes', name: 'أطباق ووجبات رئيسية', name_ar: 'أطباق ووجبات رئيسية', icon: '🍲', sort_order: 2 },
              { category_id: 'cat_sandwiches', name: 'سندويتشات وبرغر', name_ar: 'سندويتشات وبرغر', icon: '🍔', sort_order: 3 },
              { category_id: 'cat_drinks', name: 'مشروبات وعصائر طبيعية', name_ar: 'مشروبات وعصائر طبيعية', icon: '🥤', sort_order: 4 }
            ],
            products: [
              { product_id: 'p1', name: 'صحن مشاوي مشكلة عائلي (Mix Grill)', price: 2400, category_id: 'cat_grill', is_available: true, is_featured: true, unit: 'Plat' },
              { product_id: 'p2', name: 'شيش طاووق دجاج متبل', price: 950, category_id: 'cat_grill', is_available: true, is_featured: false, unit: 'Portion' },
              { product_id: 'p3', name: 'كفتة لحم غنمي مشوية', price: 1100, category_id: 'cat_grill', is_available: true, is_featured: true, unit: 'Portion' },
              { product_id: 'p4', name: 'طاجين الزيتون الوهراني بالدجاج', price: 850, category_id: 'cat_dishes', is_available: true, is_featured: false, unit: 'Plat' },
              { product_id: 'p5', name: 'برغر الباهية الملكي (Double Beef)', price: 750, category_id: 'cat_sandwiches', is_available: true, is_featured: true, unit: 'Pièce' },
              { product_id: 'p6', name: 'عصير برتقال وليمون طبيعي طازج', price: 250, category_id: 'cat_drinks', is_available: true, is_featured: false, unit: 'Verre' }
            ]
          },
          tables: [
            { table_number: '01', table_code: '01', label_ar: 'طاولة رقم 01', capacity: 4, zone: 'الصالة الرئيسية' },
            { table_number: '02', table_code: '02', label_ar: 'طاولة رقم 02', capacity: 4, zone: 'الصالة الرئيسية' },
            { table_number: 'VIP1', table_code: 'VIP1', label_ar: 'صالة كبار الزوار (VIP)', capacity: 10, zone: 'VIP' }
          ]
        })
      });

      const data = await res.json();
      if (data.success) {
        setPublishSuccessMessage(`تمت المزامنة بنجاح! الإصدار الجديد: #${data.revision} (${data.tables_count} طاولة)`);
        await loadMenusAndTables();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  // Waiter QR Scanner Logic
  const handleScanToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanInput.trim()) return;

    setIsProcessingAction(true);
    setScanMessage(null);
    try {
      // Clean token if full URL was pasted
      let token = scanInput.trim();
      const match = token.match(/\/qr\/([^/?#]+)/) || token.match(/\/token\/([^/?#]+)/);
      if (match) token = match[1];

      const res = await fetch('/api/orders/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();
      if (data.success && data.order) {
        setScannedOrder(data.order);
        setScanMessage(data.message || 'تم مسح الرمز بنجاح');
      } else {
        setScannedOrder(null);
        setScanMessage(`خطأ: ${data.message || 'لم يتم العثور على الطلب'}`);
      }
    } catch (err: any) {
      setScanMessage(`فشل المسح: ${err.message}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Order Actions (Confirm, Kitchen, Complete, Cancel)
  const handleConfirmOrder = async (orderId: string) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_name: 'النادل - أحمد' })
      });
      const data = await res.json();
      if (data.success) {
        await loadLiveOrders();
        if (scannedOrder?.id === orderId) {
          setScannedOrder(data.order);
        }
      } else {
        alert(data.message || 'فشل في تأكيد الطلب');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSendToKitchen = async (orderId: string) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/kitchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        await loadLiveOrders();
        if (scannedOrder?.id === orderId) {
          setScannedOrder(data.order);
        }
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'CASH' })
      });
      const data = await res.json();
      if (data.success) {
        await loadLiveOrders();
        if (scannedOrder?.id === orderId) {
          setScannedOrder(data.order);
        }
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const waitingOrdersCount = liveOrders.filter(o => o.status === 'WAITING_WAITER').length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-950/40 via-zinc-900 to-zinc-900 border border-rose-900/30 rounded-3xl p-6 relative overflow-hidden shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
              <Utensils className="w-3.5 h-3.5" />
              <span>ميزة مينو الطاولات الرقمي الذكي وطلبات QR • DZPOS Table System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              إدارة قوائم المطاعم وماسح طلبات الطاولات
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
              نظام طلبات الطاولات المتكامل: يقوم الزبون باختيار أطباقه وتوليد رمز QR مشفر، يقوم النادل بمسحه وتأكيده ليتم إرساله للمطبخ وطباعة الوصلات فورياً.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePublishDemoMenu}
              disabled={isPublishing}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
              <span>مزامنة مينو تجريبي (POS Publish)</span>
            </button>
            <button
              onClick={() => {
                loadMenusAndTables();
                loadLiveOrders();
              }}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition border border-zinc-700 cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {publishSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{publishSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('menus')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'menus'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>المطاعم والطاولات المنشورة ({menus.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('live_orders')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'live_orders'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          <ScanLine className="w-4 h-4 text-amber-400" />
          <span>طلبات الطاولات الحية وماسح النادل</span>
          {waitingOrdersCount > 0 && (
            <span className="bg-amber-500 text-zinc-950 text-[11px] px-2 py-0.2 rounded-full font-black animate-pulse">
              {waitingOrdersCount} بانتظار التأكيد
            </span>
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: MENUS & TABLES */}
      {/* ==================================================================== */}
      {activeTab === 'menus' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Published Menus List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rose-400" />
                <h2 className="font-bold text-white text-base">المطاعم المنشورة ({menus.length})</h2>
              </div>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-zinc-500 text-xs">جاري التحميل...</div>
            ) : menus.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl p-4 text-zinc-500 text-xs space-y-2">
                <Utensils className="w-8 h-8 mx-auto text-zinc-700" />
                <p>لا يوجد أي مينو منشور حالياً</p>
                <p className="text-[11px] text-zinc-600">انقر على "مزامنة مينو تجريبي" للبدء</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {menus.map(menu => {
                  const isSelected = menu.id === selectedMenu?.id;
                  return (
                    <div
                      key={menu.id}
                      onClick={() => setSelectedMenuId(menu.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-950/30 border-rose-500/50 shadow-sm'
                          : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white truncate">{menu.restaurant_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-zinc-400">/menu/{menu.public_slug}</span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            menu.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {menu.enabled ? 'مفعّل' : 'معطّل'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                        <div>
                          <span>الأصناف: </span>
                          <span className="font-bold text-zinc-200">{menu.snapshot?.products?.length || 0}</span>
                        </div>
                        <div>
                          <span>الإصدار: </span>
                          <span className="font-mono text-zinc-200">v{menu.revision}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 2 Columns: Selected Menu Details & Table Management */}
          <div className="lg:col-span-2 space-y-6">
            {selectedMenu ? (
              <>
                {/* Menu Details Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white">{selectedMenu.restaurant_name}</h2>
                        <button
                          onClick={() => handleToggleMenu(selectedMenu.id)}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition cursor-pointer ${
                            selectedMenu.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {selectedMenu.enabled ? 'مفعّل للمشاهدة' : 'معطّل'}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{selectedMenu.tagline || 'مينو طاولات رقمي عبر السحابة'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenPublicPreview(selectedMenu.public_slug)}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة المينو العام</span>
                      </button>
                      <button
                        onClick={() => setQrModalTable({ menu: selectedMenu })}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition border border-zinc-700 cursor-pointer"
                        title="عرض كود QR العام"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Public Link Card */}
                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-zinc-500 shrink-0">الرابط العام:</span>
                      <span className="font-mono text-zinc-300 truncate">
                        {`${window.location.origin}/menu/${selectedMenu.public_slug}`}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`/menu/${selectedMenu.public_slug}`, 'main-url')}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedLink === 'main-url' ? 'تم النسخ!' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>

                {/* Tables Grid & Generation */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableIcon className="w-5 h-5 text-rose-400" />
                      <h3 className="font-bold text-white text-base">طاولات المطعم ({selectedMenuTables.length})</h3>
                    </div>

                    <button
                      onClick={() => setIsAddTableOpen(true)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-rose-400" />
                      <span>إضافة طاولة</span>
                    </button>
                  </div>

                  {selectedMenuTables.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl p-6 text-zinc-500 text-xs space-y-2">
                      <TableIcon className="w-8 h-8 mx-auto text-zinc-700" />
                      <p>لم يتم تسجيل أي طاولة لهذا المطعم بعد</p>
                      <button
                        onClick={() => setIsAddTableOpen(true)}
                        className="text-rose-400 hover:underline text-xs"
                      >
                        + اضغط هنا لإضافة أول طاولة وتوليد الـ QR
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedMenuTables.map(t => {
                        const tableUrl = `/menu/${selectedMenu.public_slug}/table/${t.table_code}`;
                        return (
                          <div
                            key={t.id}
                            className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-rose-400 text-sm bg-rose-950/80 px-2 py-0.5 rounded-lg border border-rose-900/60">
                                    {t.table_code}
                                  </span>
                                  <h4 className="font-bold text-white text-sm">{t.label_ar || `طاولة ${t.table_number}`}</h4>
                                </div>
                                {t.zone && (
                                  <span className="text-[11px] text-zinc-400 block mt-1">المنطقة: {t.zone}</span>
                                )}
                              </div>

                              <button
                                onClick={() => handleDeleteTable(t.id)}
                                className="text-zinc-600 hover:text-rose-400 p-1 transition cursor-pointer"
                                title="حذف الطاولة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => onOpenPublicPreview(selectedMenu.public_slug, t.table_code)}
                                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center gap-1 transition cursor-pointer text-[11px]"
                                >
                                  <Eye className="w-3 h-3 text-rose-400" />
                                  <span>معاينة كزبون</span>
                                </button>
                                <button
                                  onClick={() => setQrModalTable({ menu: selectedMenu, table: t })}
                                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition cursor-pointer"
                                  title="طباعة بطاقة الطاولة وQR"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                onClick={() => copyToClipboard(tableUrl, t.id)}
                                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedLink === t.id ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-xs">
                اختر مطعماً من القائمة الجانبية لإدارة طاولاته وروابطه
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: LIVE TABLE ORDERS & WAITER QR SCANNER */}
      {/* ==================================================================== */}
      {activeTab === 'live_orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: QR Scan / Input Simulator */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <ScanLine className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="font-bold text-white text-base">ماسح النادل (Waiter Scanner)</h2>
                <p className="text-xs text-zinc-400">امسح أو الصق رمز QR الخاص بالزبون</p>
              </div>
            </div>

            <form onSubmit={handleScanToken} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-semibold block mb-1">
                  رمز التحقق المشفر أو رابط الـ QR:
                </label>
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="ord_tok_... أو رابط /qr/..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingAction || !scanInput.trim()}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ScanLine className="w-4 h-4" />
                <span>فحص ومسح رمز الطلب</span>
              </button>
            </form>

            {scanMessage && (
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                {scanMessage}
              </div>
            )}

            {/* Scanned Order Action Card */}
            {scannedOrder && (
              <div className="bg-zinc-950 border-2 border-amber-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-mono font-black text-amber-400 text-sm">
                    {scannedOrder.public_order_number}
                  </span>
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono">
                    طاولة {scannedOrder.table_code}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>الحالة الحالية:</span>
                    <span className="font-bold text-white">{scannedOrder.status}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>المجموع:</span>
                    <span className="font-bold text-emerald-400 font-mono">{scannedOrder.total} د.ج</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>النسخة:</span>
                    <span className="font-mono text-zinc-300">v{scannedOrder.version}</span>
                  </div>
                </div>

                {/* Items in Scanned Order */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <span className="text-[11px] text-zinc-500 font-semibold block">أصناف الطلب:</span>
                  {scannedOrder.items.map((it, idx) => (
                    <div key={idx} className="space-y-0.5 border-b border-zinc-900 last:border-b-0 pb-1 last:pb-0">
                      <div className="flex justify-between text-xs text-zinc-200 font-medium">
                        <span>{it.quantity}× {it.product_name_ar || it.product_name}</span>
                        <span className="font-mono text-zinc-400">{it.subtotal} د.ج</span>
                      </div>
                      {(it.customization_summary || it.notes) && (
                        <div className="text-[10px] text-amber-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                          <span>✨</span>
                          <span>{it.customization_summary || it.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Scanned Order State Transitions */}
                <div className="pt-2 space-y-2">
                  {scannedOrder.status === 'WAITING_WAITER' && (
                    <button
                      onClick={() => handleConfirmOrder(scannedOrder.id)}
                      disabled={isProcessingAction}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد الطلب وإرساله للـ POS</span>
                    </button>
                  )}

                  {scannedOrder.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleSendToKitchen(scannedOrder.id)}
                      disabled={isProcessingAction}
                      className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ChefHat className="w-4 h-4" />
                      <span>إرسال الطلب للمطبخ (Kitchen Dispatch)</span>
                    </button>
                  )}

                  {scannedOrder.status === 'SENT_TO_KITCHEN' && (
                    <button
                      onClick={() => handleCompleteOrder(scannedOrder.id)}
                      disabled={isProcessingAction}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-700"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>إتمام الطلب والدفع (Complete)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right 2 Columns: Live Incoming Orders Feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-rose-400" />
                  <h3 className="font-bold text-white text-base">سجل طلبات الطاولات الحية ({liveOrders.length})</h3>
                </div>
                <button
                  onClick={loadLiveOrders}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition border border-zinc-700 cursor-pointer"
                  title="تحديث القائمة"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {liveOrders.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl p-6 text-zinc-500 text-xs space-y-2">
                  <ShoppingBag className="w-10 h-10 mx-auto text-zinc-700" />
                  <p className="font-medium text-zinc-400">لا يوجد أي طلبات طاولات مسجلة حالياً</p>
                  <p className="text-[11px] text-zinc-600">
                    قم بفتح المينو كزبون، أضف بعض الوجبات، واضغط "تأكيد الطلب" لتظهر هنا مباشرة
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {liveOrders.map(order => {
                    const isWaiting = order.status === 'WAITING_WAITER' || order.status === 'PENDING' || (order as any).order_status === 'PENDING';
                    const isConfirmed = order.status === 'CONFIRMED';
                    const isKitchen = order.status === 'SENT_TO_KITCHEN';
                    const isCompleted = order.status === 'COMPLETED';
                    const isCancelled = order.status === 'CANCELLED';

                    return (
                      <div
                        key={order.id}
                        className={`p-4 rounded-2xl border transition space-y-3 ${
                          isWaiting
                            ? 'bg-amber-950/20 border-amber-500/50 shadow-md'
                            : isConfirmed
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : isKitchen
                            ? 'bg-sky-950/20 border-sky-500/40'
                            : 'bg-zinc-950/60 border-zinc-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white text-base bg-zinc-900 px-2.5 py-1 rounded-xl border border-zinc-800">
                              {order.public_order_number}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-rose-400 text-xs">
                                  {order.table_name || `طاولة ${order.table_code}`}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">v{order.version}</span>
                              </div>
                              <span className="text-[11px] text-zinc-400">
                                {new Date(order.created_at).toLocaleTimeString('ar-DZ')}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {isWaiting && (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-full text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                <span>بانتظار تأكيد النادل</span>
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-full text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تم التأكيد</span>
                              </span>
                            )}
                            {isKitchen && (
                              <span className="inline-flex items-center gap-1 bg-sky-500/15 border border-sky-500/40 text-sky-300 px-2.5 py-1 rounded-full text-xs font-bold">
                                <ChefHat className="w-3.5 h-3.5" />
                                <span>في المطبخ</span>
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                                <Receipt className="w-3.5 h-3.5" />
                                <span>مكتمل</span>
                              </span>
                            )}
                            {isCancelled && (
                              <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-full text-xs font-semibold">
                                ملغى
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Order Items Breakdown */}
                        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 text-xs space-y-1.5">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="space-y-0.5 border-b border-zinc-900 last:border-b-0 pb-1 last:pb-0">
                              <div className="flex items-center justify-between text-zinc-200 font-medium">
                                <span>{it.quantity}× {it.product_name_ar || it.product_name}</span>
                                <span className="font-mono text-zinc-400">{it.subtotal} د.ج</span>
                              </div>
                              {(it.customization_summary || it.notes) && (
                                <div className="text-[11px] text-amber-300 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                                  <span>✨</span>
                                  <span>{it.customization_summary || it.notes}</span>
                                </div>
                              )}
                            </div>
                          ))}
                          {order.notes && (
                            <div className="text-[11px] text-amber-300/80 pt-1 border-t border-zinc-900 mt-1">
                              ملاحظات الزبون: {order.notes}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons for Waiter/POS */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="text-xs font-bold text-emerald-400 font-mono">
                            الإجمالي: {order.total} د.ج
                          </div>

                          <div className="flex items-center gap-2">
                            {isWaiting && (
                              <button
                                onClick={() => handleConfirmOrder(order.id)}
                                disabled={isProcessingAction}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تأكيد الطلب (Confirm)</span>
                              </button>
                            )}

                            {isConfirmed && (
                              <button
                                onClick={() => handleSendToKitchen(order.id)}
                                disabled={isProcessingAction}
                                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <ChefHat className="w-3.5 h-3.5" />
                                <span>إرسال للمطبخ</span>
                              </button>
                            )}

                            {isKitchen && (
                              <button
                                onClick={() => handleCompleteOrder(order.id)}
                                disabled={isProcessingAction}
                                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-zinc-700 cursor-pointer disabled:opacity-50"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>إتمام ودفع</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setScanInput(order.secure_token);
                                setScannedOrder(order);
                              }}
                              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition cursor-pointer"
                              title="نسخ الرمز إلى الماسح"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Table */}
      {isAddTableOpen && selectedMenu && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">إضافة طاولة جديدة إلى المينو</h3>
              <button
                onClick={() => setIsAddTableOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTable} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">رمز الطاولة (Table Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 01 أو 05 أو VIP2"
                  value={newTableCode}
                  onChange={(e) => setNewTableCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">تسمية الطاولة بالعربية</label>
                <input
                  type="text"
                  placeholder="مثال: طاولة رقم 01 أو ركن العائلات"
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">المنطقة / الجناح (Zone)</label>
                  <input
                    type="text"
                    value={newTableZone}
                    onChange={(e) => setNewTableZone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">عدد المقاعد</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  حفظ الطاولة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QR Table Poster / Print Preview */}
      {qrModalTable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-zinc-400">بطاقة طاولة جاهزة للطباعة</span>
              <button onClick={() => setQrModalTable(null)} className="text-zinc-500 hover:text-white cursor-pointer">✕</button>
            </div>

            {/* Printable Poster Mockup */}
            <div className="bg-white text-zinc-900 p-6 rounded-2xl shadow-xl space-y-3 border-2 border-rose-500/20">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center mx-auto font-black text-lg">
                🍽️
              </div>
              <h3 className="font-extrabold text-base tracking-tight">{qrModalTable.menu.restaurant_name}</h3>
              {qrModalTable.table ? (
                <div className="inline-block bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1 rounded-full">
                  {qrModalTable.table.label_ar || `طاولة رقم ${qrModalTable.table.table_number}`}
                </div>
              ) : (
                <div className="text-xs text-zinc-500">القائمة الرقمية الكاملة</div>
              )}

              {/* QR Code Canvas Mockup */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 inline-block shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    `${window.location.origin}/menu/${qrModalTable.menu.public_slug}${
                      qrModalTable.table ? `/table/${qrModalTable.table.table_code}` : ''
                    }`
                  )}`}
                  alt="QR Code"
                  className="w-36 h-36 mx-auto rounded"
                />
              </div>

              <p className="text-[11px] text-zinc-600 font-medium">
                امسح الكود بكاميرا هاتفك لتصفح المينو والطلب مباشرة
              </p>
              {qrModalTable.menu.wifi_ssid && (
                <p className="text-[10px] text-zinc-400">
                  واي فاي مجاني: <span className="font-bold text-zinc-700">{qrModalTable.menu.wifi_ssid}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة البوستر</span>
              </button>
              <button
                onClick={() => setQrModalTable(null)}
                className="px-4 py-2.5 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TableMenusView;
