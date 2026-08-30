import React from 'react';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  Inbox,
  Boxes,
  Layers,
  Terminal,
  FileCode2,
  ShieldAlert,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { AdminRole } from '../types/dzpos.js';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminRole: AdminRole;
  setAdminRole: (role: AdminRole) => void;
  pendingRequestsCount: number;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  adminRole,
  setAdminRole,
  pendingRequestsCount,
  isOnline,
  setIsOnline,
  onRefresh,
  isRefreshing
}) => {
  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', labelFr: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'الزبائن', labelFr: 'Clients', icon: Users },
    { id: 'licenses', label: 'التراخيص', labelFr: 'Licences', icon: KeyRound },
    {
      id: 'requests',
      label: 'الطلبات',
      labelFr: 'Demandes',
      icon: Inbox,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined
    },
    { id: 'activities', label: 'الأنشطة التجارية', labelFr: 'Activités', icon: Boxes },
    { id: 'packs', label: 'ملفات المنتجات (Packs)', labelFr: 'Product Packs', icon: Layers },
    { id: 'pos_simulator', label: 'محاكي DZPOS App', labelFr: 'POS Client Sim', icon: Terminal, highlight: true },
    { id: 'api_docs', label: 'دليل API & Swagger', labelFr: 'API Docs', icon: FileCode2 },
    { id: 'audit', label: 'سجل العمليات', labelFr: 'Audit Logs', icon: ShieldAlert },
    { id: 'settings', label: 'الإعدادات', labelFr: 'Settings', icon: Settings }
  ];

  return (
    <header className="bg-[#0a0a0c] border-b border-zinc-800/80 text-zinc-100 sticky top-0 z-40 shadow-lg shadow-black/40 backdrop-blur-md">
      {/* Top Meta Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md shadow-emerald-950/50 border border-emerald-400/30">
            DZ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-zinc-50">DZPOS Central Backend</span>
              <span className="text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                v2.4.0 Production Ready
              </span>
            </div>
            <p className="text-xs text-zinc-400">نظام إدارة الزبائن، التراخيص، ملفات المنتجات، والمزامنة المركزية</p>
          </div>
        </div>

        {/* Global Controls: Role Switcher & Network State */}
        <div className="flex items-center gap-3 text-xs">
          {/* Refresh Data */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 transition cursor-pointer"
            title="تحديث البيانات من السيرفر"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline font-medium">تحديث</span>
          </button>

          {/* Online/Offline Toggle for Simulator */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-medium transition cursor-pointer ${
              isOnline
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/50'
                : 'bg-amber-950/60 text-amber-300 border-amber-700/60 hover:bg-amber-900/50'
            }`}
            title="تبديل حالة اتصال السيرفر لاختبار Offline-first"
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isOnline ? 'Online (متصل)' : 'Offline (غير متصل)'}</span>
          </button>

          {/* RBAC Role Selector */}
          <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-700/80">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-zinc-400 font-medium hidden sm:inline">الصلاحية:</span>
            <select
              value={adminRole}
              onChange={(e) => setAdminRole(e.target.value as AdminRole)}
              className="bg-transparent text-zinc-100 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="MAIN_ADMIN" className="bg-zinc-900 text-zinc-100">Main Admin (كامل الصلاحيات)</option>
              <option value="ADMIN" className="bg-zinc-900 text-zinc-100">Admin (عمليات وتراخيص)</option>
              <option value="SUPPORT" className="bg-zinc-900 text-zinc-100">Support (عرض ودعم فقط)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar" aria-label="Tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                    : item.highlight
                    ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-700/50'
                    : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
