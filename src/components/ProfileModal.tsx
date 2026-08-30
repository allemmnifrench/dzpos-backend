import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Lock,
  Calendar,
  Sparkles
} from 'lucide-react';
import { AdminUser, AdminRole } from '../types/dzpos.js';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AdminUser;
  authToken?: string | null;
  onProfileUpdated: (updatedUser: AdminUser) => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  authToken,
  onProfileUpdated
}: ProfileModalProps) {
  const [fullName, setFullName] = useState(currentUser.full_name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [username, setUsername] = useState(currentUser.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sync fields when currentUser changes or modal is opened
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setEmail(currentUser.email || '');
      setUsername(currentUser.username || '');
    }
  }, [currentUser, isOpen]);

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const getRoleLabel = (role: AdminRole) => {
    switch (role) {
      case 'MAIN_ADMIN':
        return { label: 'مسؤول رئيسي (Super Admin)', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'ADMIN':
        return { label: 'مدير عمليات (Operations Admin)', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'SUPPORT':
        return { label: 'فريق الدعم (Support Agent)', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      default:
        return { label: role, bg: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  const roleInfo = getRoleLabel(currentUser.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic validations
    if (!fullName.trim()) {
      setErrorMsg('الاسم الكامل مطلوب');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صالح');
      return;
    }
    if (!username.trim()) {
      setErrorMsg('اسم المستخدم مطلوب');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        setErrorMsg('كلمة المرور الجديدة يجب أن تكون 4 أحرف أو أرقام على الأقل');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('تأكيد كلمة المرور غير متطابق');
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || ''}`,
          'x-admin-user-id': currentUser.id,
          'x-admin-user': currentUser.username,
          'x-admin-role': currentUser.role
        },
        body: JSON.stringify({
          id: currentUser.id,
          user_id: currentUser.id,
          full_name: fullName.trim(),
          email: email.trim(),
          username: username.trim(),
          current_password: currentPassword,
          new_password: newPassword ? newPassword.trim() : undefined
        })
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'فشل تحديث الملف الشخصي');
      }

      setSuccessMsg(result.message || 'تم حفظ البيانات بنجاح');
      if (result.data?.user) {
        onProfileUpdated(result.data.user);
      }

      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-[#0e0e11] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-emerald-950/50">
              {(fullName?.charAt(0) || currentUser?.full_name?.charAt(0) || currentUser?.username?.charAt(0) || 'A').toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                تعديل الملف الشخصي
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full border bg-zinc-800/80 text-zinc-400 border-zinc-700">
                  {currentUser.username}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">إدارة معلومات الحساب الإداري والأمان</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center gap-3 text-red-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* User Role Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs text-zinc-400 font-medium">رتبة الحساب في النظام</div>
                <div className="text-sm font-semibold text-zinc-200">{currentUser.full_name}</div>
              </div>
            </div>
            <div className={`text-xs px-3 py-1 rounded-full border font-medium inline-flex items-center gap-1.5 self-start sm:self-auto ${roleInfo.bg}`}>
              <Sparkles className="w-3 h-3" />
              {roleInfo.label}
            </div>
          </div>

          {/* Personal Info Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              المعلومات الأساسية
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
                  الاسم الكامل <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl pr-10 pl-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                    placeholder="مثال: محمد بن علي"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
                  اسم المستخدم (Username) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl pr-9 pl-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 transition-colors font-mono"
                    placeholder="superadmin"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1.5 font-medium">
                البريد الإلكتروني <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#141418] border border-zinc-800 rounded-xl pr-10 pl-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                  placeholder="admin@dzpos.dz"
                />
              </div>
            </div>
          </div>

          {/* Security & Password Section */}
          <div className="space-y-4 pt-2 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                تغيير كلمة المرور (اختياري)
              </h3>
              <span className="text-[11px] text-zinc-500">اتركها فارغة إذا كنت لا تريد تغييرها</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-300 mb-1.5 font-medium">كلمة المرور الجديدة</label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl pr-10 pl-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1.5 font-medium">تأكيد كلمة المرور</label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl pr-10 pl-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Account Meta */}
          <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/60 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>تاريخ إنشاء الحساب:</span>
              <span className="text-zinc-300 font-mono">
                {currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('ar-DZ') : '2026-01-01'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>معرف الحساب:</span>
              <span className="text-zinc-300 font-mono text-[11px]">{currentUser.id}</span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900/80 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
