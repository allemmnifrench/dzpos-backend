import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Layers,
  Edit2,
  CheckCircle2,
  XCircle,
  FileText,
  Tag,
  ArrowUpDown
} from 'lucide-react';
import { BusinessActivity } from '../types/dzpos.js';

interface ActivitiesViewProps {
  activities: BusinessActivity[];
  onCreateActivity: (data: Partial<BusinessActivity>) => Promise<void>;
  onUpdateActivity: (id: string, data: Partial<BusinessActivity>) => Promise<void>;
  onNavigateToPack: (activityCode: string) => void;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({
  activities,
  onCreateActivity,
  onUpdateActivity,
  onNavigateToPack
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<BusinessActivity | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [icon, setIcon] = useState('shopping-cart');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !nameAr || !nameFr) return;

    setIsSubmitting(true);
    try {
      await onCreateActivity({
        code: code.trim().toLowerCase().replace(/\s+/g, '_'),
        name_ar: nameAr,
        name_fr: nameFr,
        name_en: nameEn || nameFr,
        icon,
        description,
        is_active: true
      });
      setIsCreateOpen(false);
      setCode('');
      setNameAr('');
      setNameFr('');
      setNameEn('');
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;

    setIsSubmitting(true);
    try {
      await onUpdateActivity(editingActivity.id, {
        name_ar: nameAr,
        name_fr: nameFr,
        name_en: nameEn,
        icon,
        description
      });
      setEditingActivity(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (act: BusinessActivity) => {
    setEditingActivity(act);
    setNameAr(act.name_ar);
    setNameFr(act.name_fr);
    setNameEn(act.name_en || '');
    setIcon(act.icon || 'shopping-cart');
    setDescription(act.description || '');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-400" />
            <span>الأنشطة التجارية (Business Activities & Sectors)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            تهيئة وتصنيف قطاعات التجارة (بقالة، كوزميتيك، مطاعم، صيدليات...) لربطها بكتالوجات المنتجات الجاهزة للتحميل.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md shadow-emerald-950/50 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة نشاط تجاري جديد</span>
        </button>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activities.map((act) => (
          <div
            key={act.id}
            className={`bg-[#0c0c0e] rounded-xl border p-5 shadow-sm transition space-y-3.5 ${
              act.is_active ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-800/60 bg-zinc-950/40 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-zinc-100 text-base">{act.name_ar}</div>
                <div className="text-xs text-zinc-400 font-medium">{act.name_fr}</div>
                {act.name_en && <div className="text-[11px] text-zinc-500 font-medium">{act.name_en}</div>}
              </div>
              <span className="font-mono text-[10px] bg-zinc-900 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">
                {act.code}
              </span>
            </div>

            {act.description && (
              <p className="text-xs text-zinc-400 line-clamp-2">{act.description}</p>
            )}

            {/* Version & Products counter */}
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400">النسخة المنشورة:</span>
                <span className="font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 rounded text-[11px]">
                  v{act.latest_pack_version}
                </span>
              </div>
              <div className="text-zinc-300 font-semibold">
                {act.total_products} منتج
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
              <button
                onClick={() => onNavigateToPack(act.code)}
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>إدارة ملف المنتجات</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(act)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                  title="تعديل بيانات النشاط"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onUpdateActivity(act.id, { is_active: !act.is_active })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                    act.is_active
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {act.is_active ? 'مفعل' : 'معطل'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Activity Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-800 space-y-4 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-emerald-400" />
                <span>إضافة نشاط تجاري جديد</span>
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
                <label className="block font-semibold text-zinc-300 mb-1">الرمز الفريد (Code Slug) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: butchery أو bakery"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">الاسم بالعربية (Nom en Arabe) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: جزارة ولحوم طازجة"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">الاسم بالفرنسية (Nom en Français) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: Boucherie & Viandes"
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">الوصف</label>
                <textarea
                  rows={2}
                  placeholder="وصف مختصر للنشاط والمنتجات المقترحة..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ النشاط'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-[#111114] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-800 space-y-4 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-100">تعديل النشاط التجاري</h2>
              <button
                onClick={() => setEditingActivity(null)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">الاسم بالعربية *</label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">الاسم بالفرنسية *</label>
                <input
                  type="text"
                  required
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition cursor-pointer"
                >
                  {isSubmitting ? 'جاري التحديث...' : 'تحديث البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
