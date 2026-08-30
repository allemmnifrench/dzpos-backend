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
  ChevronLeft,
  LogOut,
  UserCog,
  Shield,
  Coins,
  Receipt,
  Sparkles,
  Utensils
} from 'lucide-react';
import { AdminRole, AdminUser } from '../types/dzpos.js';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminRole: AdminRole;
  setAdminRole: (role: AdminRole) => void;
  pendingRequestsCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentUser?: AdminUser | null;
  onLogout?: () => void;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  adminRole,
  setAdminRole,
  pendingRequestsCount,
  isOpen,
  setIsOpen,
  currentUser,
  onLogout,
  onOpenProfile
}) => {
  const managementItems = [
    {
      id: 'dashboard',
      labelAr: 'لوحة التحكم',
      labelEn: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'subscriptions',
      labelAr: 'الاشتراكات والأسعار',
      labelEn: 'Subscriptions & Pricing',
      icon: Coins,
      highlight: true
    },
    {
      id: 'customers',
      labelAr: 'قاعدة الزبائن',
      labelEn: 'Customers',
      icon: Users
    },
    {
      id: 'licenses',
      labelAr: 'إدارة التراخيص',
      labelEn: 'Licenses',
      icon: KeyRound
    },
    {
      id: 'requests',
      labelAr: 'طلبات التراخيص',
      labelEn: 'Requests',
      icon: Inbox,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined
    },
    {
      id: 'packs',
      labelAr: 'كتالوجات المنتجات',
      labelEn: 'Product Packs',
      icon: Layers
    },
    {
      id: 'purchases',
      labelAr: 'المشتريات وفواتير AI',
      labelEn: 'AI Purchases & Invoices',
      icon: Receipt,
      highlight: true
    },
    {
      id: 'table_menus',
      labelAr: 'مينو الطاولات الرقمي',
      labelEn: 'Table QR Menus',
      icon: Utensils,
      highlight: true
    }
  ];

  const systemItems = [
    {
      id: 'activities',
      labelAr: 'الأنشطة والمهن',
      labelEn: 'Activities',
      icon: Boxes
    },
    {
      id: 'audit',
      labelAr: 'سجل العمليات الأمني',
      labelEn: 'Audit Logs',
      icon: ShieldAlert
    },
    {
      id: 'pos_simulator',
      labelAr: 'محاكي كاسة DZPOS',
      labelEn: 'POS Simulator',
      icon: Terminal,
      highlight: true
    },
    {
      id: 'api_docs',
      labelAr: 'دليل OpenAPI 3.0',
      labelEn: 'API Docs',
      icon: FileCode2
    },
    {
      id: 'settings',
      labelAr: 'إعدادات النظام',
      labelEn: 'Settings',
      icon: Settings
    }
  ];

  const roleLabels: Record<AdminRole, { title: string; subtitle: string; color: string }> = {
    MAIN_ADMIN: { title: 'مدير رئيسي', subtitle: 'Super Admin', color: 'text-amber-400' },
    ADMIN: { title: 'مدير عمليات', subtitle: 'Operations', color: 'text-emerald-400' },
    SUPPORT: { title: 'دعم فني', subtitle: 'Support', color: 'text-blue-400' }
  };

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-64 lg:w-72 bg-[#0c0d12] border-l border-zinc-800/80 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-sm">
              DZ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-100 tracking-tight">DZPOS Cloud</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                  v2.4
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">النظام السحابي المركزي</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 lg:hidden cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Section 1: Core Operations */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              العمليات والتراخيص
            </div>

            {managementItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    <span>{item.labelAr}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-mono font-bold px-1.5 py-0.2 rounded">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Section 2: System Tools & Settings */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              الأدوات والإعدادات
            </div>

            {systemItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                      : item.highlight
                      ? 'text-emerald-400 hover:bg-emerald-500/10'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-emerald-400'
                          : item.highlight
                          ? 'text-emerald-400'
                          : 'text-zinc-400'
                      }`}
                    />
                    <span>{item.labelAr}</span>
                  </div>

                  {item.highlight && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* User Card Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#090a0f]">
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex items-center gap-2.5 min-w-0 text-right hover:opacity-90 transition cursor-pointer flex-1 group"
              title="تعديل الملف الشخصي"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-200 shrink-0">
                {currentUser?.username.slice(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="text-right min-w-0 flex-1">
                <div className="font-semibold text-xs text-zinc-200 truncate group-hover:text-emerald-400 transition-colors">
                  {currentUser?.full_name || roleLabels[adminRole].title}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono truncate">
                  @{currentUser?.username || 'admin'}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {onOpenProfile && (
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                  title="تعديل الملف الشخصي"
                >
                  <UserCog className="w-3.5 h-3.5" />
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-md hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
