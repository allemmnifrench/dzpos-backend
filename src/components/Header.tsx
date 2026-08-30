import React, { useState, useEffect } from 'react';
import {
  Menu,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  LogOut,
  UserCheck,
  Cloud
} from 'lucide-react';
import { AdminRole, AdminUser } from '../types/dzpos.js';

interface HeaderProps {
  activeTab: string;
  adminRole: AdminRole;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onToggleSidebar: () => void;
  currentUser?: AdminUser | null;
  onLogout?: () => void;
  onOpenProfile?: () => void;
}

const tabTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'لوحة المراقبة العامة', subtitle: 'نظرة عامة على مؤشرات النظام والتراخيص الفعالة' },
  subscriptions: { title: 'إدارة الاشتراكات والأسعار', subtitle: 'تعديل أسعار الباقات السنوية والأبدية وإدارة تراخيص الأجهزة' },
  customers: { title: 'قاعدة الزبائن ونقاط البيع', subtitle: 'إدارة الزبائن والمحلات المسجلة عبر 58 ولاية' },
  licenses: { title: 'إدارة التراخيص والأجهزة', subtitle: 'توليد المفاتيح، إدارة الصلاحيات، وربط Hardware ID' },
  requests: { title: 'طلبات الشراء والتجديد', subtitle: 'مراجعة واعتماد طلبات التراخيص الواردة' },
  activities: { title: 'الأنشطة والمهن التجارية', subtitle: 'إدارة وتخصيص الأنشطة التجارية في النظام' },
  packs: { title: 'كتالوجات حزم المنتجات', subtitle: 'إدارة إصدارات المنتجات والمزامنة بدون إنترنت' },
  pos_simulator: { title: 'محاكي كاسة DZPOS', subtitle: 'تجربة بيئة العمل والمزامنة Offline-first' },
  api_docs: { title: 'دليل OpenAPI 3.0', subtitle: 'توثيق واجهات برمجة التطبيقات ونقاط الاتصال' },
  audit: { title: 'سجل العمليات الأمني', subtitle: 'سجل تدقيق كامل لكافة الأنشطة والعمليات الإدارية' },
  settings: { title: 'إعدادات النظام والسياسات', subtitle: 'تهيئة فترات السماح، كوتات الأجهزة، والأمان' }
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  adminRole,
  isOnline,
  setIsOnline,
  onRefresh,
  isRefreshing,
  onToggleSidebar,
  currentUser,
  onLogout,
  onOpenProfile
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const current = tabTitles[activeTab] || { title: 'نظام DZPOS المركزي', subtitle: 'لوحة التحكم' };

  return (
    <header className="h-15 bg-[#0c0d12] border-b border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Right side: Mobile Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>{current.title}</span>
          </h1>
          <p className="text-[11px] text-zinc-400 hidden md:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Left side: Controls */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        {/* Cloud Persistence Indicator */}
        <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 text-[11px] font-medium" title="قاعدة البيانات السحابية الدائمة مفعلة ومربوطة (Firebase Firestore)">
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          <span>سحابة دائمة (Firestore)</span>
        </div>

        {/* Server Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800/80 text-zinc-400 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span>توقيت السيرفر:</span>
          <span className="text-zinc-200 font-semibold">{time || '12:00:00'}</span>
        </div>

        {/* Refresh Data */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 transition cursor-pointer"
          title="تحديث البيانات من السيرفر"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
          <span className="hidden sm:inline font-medium text-xs">تحديث</span>
        </button>

        {/* Online / Offline Simulator */}
        <button
          type="button"
          onClick={() => setIsOnline(!isOnline)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
          }`}
          title="محاكاة اتصال السيرفر"
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline font-mono">{isOnline ? 'Online' : 'Offline'}</span>
        </button>

        {/* User profile button */}
        {currentUser && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            title="تعديل الملف الشخصي"
          >
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-200">
              {(currentUser?.full_name?.charAt(0) || currentUser?.username?.charAt(0) || 'A').toUpperCase()}
            </div>
          </button>
        )}
      </div>
    </header>
  );
};
