import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { AdminRole, AdminUser } from '../types/dzpos.js';

interface LoginViewProps {
  onLoginSuccess: (user: AdminUser, token: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const u = username;
    const p = password;

    if (!u.trim() || !p.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u.trim(),
          password: p.trim()
        })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'فشل تسجيل الدخول، تأكد من صحة البيانات');
      }

      if (rememberMe) {
        localStorage.setItem('dzpos_auth_token', data.data.token);
        localStorage.setItem('dzpos_auth_user', JSON.stringify(data.data.user));
      } else {
        sessionStorage.setItem('dzpos_auth_token', data.data.token);
        sessionStorage.setItem('dzpos_auth_user', JSON.stringify(data.data.user));
      }

      onLoginSuccess(data.data.user, data.data.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بالسيرفر المركزي');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-black">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 p-0.5 shadow-xl shadow-emerald-950/60 border border-emerald-400/40 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <span className="font-black text-2xl tracking-tighter text-emerald-400 font-mono">DZ</span>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight flex items-center justify-center gap-2">
              <span>DZPOS Central Cloud Hub</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 font-normal max-w-md mx-auto">
              بوابة الدخول المركزية لإدارة التراخيص، الزبائن، ملفات المنتجات، والمزامنة عبر 58 ولاية
            </p>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-[#0c0c0e] border border-zinc-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          <div className="border-b border-zinc-800 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>تسجيل الدخول إلى لوحة التحكم</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                أدخل بيانات الاعتماد الخاصة بحسابك الإداري
              </p>
            </div>
            <span className="text-[11px] font-mono font-semibold bg-zinc-900 text-zinc-400 px-2.5 py-1 rounded-md border border-zinc-800">
              RBAC v2.4.0
            </span>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">خطأ في الدخول: </span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {/* Username / Email Field */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-zinc-300">
                اسم المستخدم أو البريد الإلكتروني <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: superadmin أو admin@dzpos.dz"
                  required
                  dir="ltr"
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-zinc-700/80 bg-zinc-900/90 text-zinc-100 placeholder-zinc-500 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-semibold text-zinc-300">
                  كلمة المرور <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-zinc-500">مشفرة بتشفير آمن SHA-256</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-zinc-700/80 bg-zinc-900/90 text-zinc-100 placeholder-zinc-500 text-xs focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Assistance */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-400 hover:text-zinc-200">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>تذكر تسجيل الدخول على هذا المتصفح</span>
              </label>
              <span className="text-zinc-500 text-[11px]">اتصال محمي ومشفّر SSL</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحقق من الصلاحيات...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>دخول إلى النظام المركزي</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feature Highlights / Security Badges */}
        <div className="grid grid-cols-3 gap-3 text-center text-zinc-400 text-[11px]">
          <div className="bg-[#0c0c0e]/60 border border-zinc-800/80 rounded-xl p-2.5 flex flex-col items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-zinc-200">تشفير 256-Bit</span>
            <span className="text-[10px] text-zinc-500">حماية كاملة للبيانات</span>
          </div>

          <div className="bg-[#0c0c0e]/60 border border-zinc-800/80 rounded-xl p-2.5 flex flex-col items-center gap-1">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-zinc-200">58 ولاية جزائرية</span>
            <span className="text-[10px] text-zinc-500">مزامنة فورية ودقيقة</span>
          </div>

          <div className="bg-[#0c0c0e]/60 border border-zinc-800/80 rounded-xl p-2.5 flex flex-col items-center gap-1">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-zinc-200">Offline-First POS</span>
            <span className="text-[10px] text-zinc-500">عمل دائم بدون إنترنت</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-zinc-500">
          DZPOS Central Platform • جميع الحقوق محفوظة © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};
