import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Upload,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  FileText,
  ShieldCheck,
  Tag,
  Hash,
  Database,
  Archive,
  Image as ImageIcon,
  FolderArchive,
  FileCode,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  Search
} from 'lucide-react';
import { BusinessActivity, ProductPack, ProductPackVersion, ProductRecord } from '../types/dzpos.js';

interface ProductPacksViewProps {
  activities: BusinessActivity[];
  packs: ProductPack[];
  versions: ProductPackVersion[];
  selectedActivityCode?: string;
  onValidateFile: (activityCode: string, fileType: 'json' | 'csv', content: string) => Promise<any>;
  onCreateVersion: (activityCode: string, products: ProductRecord[], summary: string, autoPublish: boolean) => Promise<void>;
  onPublishVersion: (versionId: string) => Promise<void>;
  onRollback: (activityCode: string, targetVersion: number, reason: string) => Promise<void>;
  onDownloadPack: (activityCode: string, version?: number) => void;
  onUploadZipPack?: (file: File, activityCode?: string) => Promise<any>;
}

export const ProductPacksView: React.FC<ProductPacksViewProps> = ({
  activities,
  packs,
  versions,
  selectedActivityCode = 'grocery',
  onValidateFile,
  onCreateVersion,
  onPublishVersion,
  onRollback,
  onDownloadPack,
  onUploadZipPack
}) => {
  const [currentActivity, setCurrentActivityState] = useState<string>(() => {
    try {
      return localStorage.getItem('dzpos_selected_activity') || selectedActivityCode || 'grocery';
    } catch {
      return selectedActivityCode || 'grocery';
    }
  });

  const setCurrentActivity = (act: string) => {
    setCurrentActivityState(act);
    try {
      localStorage.setItem('dzpos_selected_activity', act);
    } catch (e) {
      console.warn('Failed to save selected activity to localStorage:', e);
    }
  };

  const [activeTabMode, setActiveTabMode] = useState<'zip_upload' | 'manual_text'>('zip_upload');

  useEffect(() => {
    if (selectedActivityCode && !localStorage.getItem('dzpos_selected_activity')) {
      setCurrentActivityState(selectedActivityCode);
    }
  }, [selectedActivityCode]);

  // Version Products Preview Modal State
  const [previewVersionData, setPreviewVersionData] = useState<{
    version: number;
    activityCode: string;
    products: any[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');

  // ZIP Upload State
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isUploadingZip, setIsUploadingZip] = useState<boolean>(false);
  const [zipUploadResult, setZipUploadResult] = useState<any | null>(null);
  const [zipUploadError, setZipUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Text / CSV / JSON State
  const [rawContent, setRawContent] = useState<string>('');
  const [fileType, setFileType] = useState<'csv' | 'json'>('csv');
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [changesSummary, setChangesSummary] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  // Active pack & versions for the selected activity
  const activePack = packs.find(p => p.activity_code === currentActivity);
  const packVersions = versions.filter(v => v.activity_code === currentActivity).sort((a, b) => b.version - a.version);

  const handleOpenVersionPreview = async (activityCode: string, versionNum: number) => {
    setPreviewVersionData({
      version: versionNum,
      activityCode,
      products: [],
      loading: true,
      error: null
    });
    setPreviewSearch('');

    try {
      const res = await fetch(`/api/product-packs/${activityCode}/versions/${versionNum}/products`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'فشل جلب منتجات النسخة');
      setPreviewVersionData({
        version: versionNum,
        activityCode,
        products: data.data.products || [],
        loading: false,
        error: null
      });
    } catch (err: any) {
      setPreviewVersionData(prev => prev ? { ...prev, loading: false, error: err.message } : null);
    }
  };

  // Handle ZIP File Selection & Submission
  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFile(file);
      setZipUploadResult(null);
      setZipUploadError(null);
    }
  };

  const handleExecuteZipUpload = async () => {
    if (!zipFile) {
      setZipUploadError('يرجى اختيار ملف .zip أولاً');
      return;
    }

    setIsUploadingZip(true);
    setZipUploadError(null);
    setZipUploadResult(null);

    try {
      if (onUploadZipPack) {
        const res = await onUploadZipPack(zipFile, currentActivity);
        setZipUploadResult(res);
      } else {
        const formData = new FormData();
        formData.append('file', zipFile);
        formData.append('activity_code', currentActivity);

        const response = await fetch('/api/sync/upload-zip', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message || data.message || 'فشل رفع الملف');
        setZipUploadResult(data);
      }
    } catch (err: any) {
      console.error(err);
      setZipUploadError(err.message || 'حدث خطأ أثناء معالجة ملف الـ ZIP');
    } finally {
      setIsUploadingZip(false);
    }
  };

  // Pre-load Algerian Sample Data Templates
  const loadSampleTemplate = (type: 'grocery' | 'cosmetics' | 'hardware') => {
    if (type === 'grocery') {
      const csv = `Designation,Code_Barre,Prix,Categorie,Unite
Hamoud Boualem Selecto 1L,6130001001012,110,Boissons,Bouteille
Hamoud Boualem Slim Citron 1L,6130001001029,110,Boissons,Bouteille
Huile Elio 5L,6130102003018,650,Huiles,Bidon
Couscous Mama Fin 1kg,6130205004011,140,Pâtes & Couscous,Paquet
Café Facto Moulu 250g,6130304005014,240,Café & Thé,Paquet
Fromage Portion Tartino 24p,6130406006017,320,Produits Laitiers,Boîte
Eau Minérale Lalla Khedidja 1.5L,6130507007010,40,Eaux,Bouteille
Lait Candia UHT 1L,6130608008013,150,Produits Laitiers,Brique`;
      setRawContent(csv);
      setFileType('csv');
    } else if (type === 'cosmetics') {
      const csv = `Designation,Code_Barre,Prix,Categorie,Unite
Shampooing Venus Oeuf 400ml,6131102001015,180,Capillaire,Flacon
Savon Liquide Test 500ml,6131203002018,220,Hygiène,Flacon
Dentifrice Signal Anti-Carie 75ml,6131304003011,160,Bucodentaire,Tube
Déodorant Nivea Men 150ml,4005808123456,420,Parfumerie,Spray`;
      setRawContent(csv);
      setFileType('csv');
    } else {
      const csv = `Designation,Code_Barre,Prix,Categorie,Unite
Tournevis Testeur 220V Total,6925582110012,250,Outillage,Pièce
Ruban Isolant Noir 10m,6132001001019,80,Électricité,Rouleau
Mètre Ruban 5m Ingco,6925582120011,450,Mesure,Pièce
Silicone Transparent 280ml,8690001002014,380,Quincaillerie,Cartouche`;
      setRawContent(csv);
      setFileType('csv');
    }
  };

  const handleManualTextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isJson = file.name.endsWith('.json');
    setFileType(isJson ? 'json' : 'csv');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawContent(content || '');
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!rawContent.trim()) return;
    setIsValidating(true);
    try {
      const result = await onValidateFile(currentActivity, fileType, rawContent);
      setValidationResult(result);
    } catch (err: any) {
      alert(err.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmCreateVersion = async () => {
    if (!validationResult || !validationResult.preview || validationResult.preview.length === 0) return;
    setIsCreatingVersion(true);
    try {
      await onCreateVersion(
        currentActivity,
        validationResult.preview,
        changesSummary || 'تحديث دوري لبيانات المنتجات والأسعار',
        autoPublish
      );
      setRawContent('');
      setValidationResult(null);
      setChangesSummary('');
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleRollbackClick = async (targetVer: number) => {
    const reason = prompt(`يرجى كتابة سبب التراجع إلى النسخة v${targetVer}:`, 'اكتشاف أخطاء في تسعيرة النسخة الحالية');
    if (reason !== null) {
      await onRollback(currentActivity, targetVer, reason);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>إدارة ملفات المنتجات والنسخ الاحتياطية (Product Packs & ZIP Backups)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            رفع ملفات .zip المصدرة من تطبيق الكاشير، استخراج قاعدة SQLite والصور تلقائياً، وإدارة إصدارات الكتالوج مع SHA-256.
          </p>
        </div>

        {/* Activity Selector */}
        <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-lg border border-zinc-700">
          <span className="text-xs font-semibold text-zinc-300">النشاط المحدد:</span>
          <select
            value={currentActivity}
            onChange={(e) => {
              setCurrentActivity(e.target.value);
              setValidationResult(null);
              setZipUploadResult(null);
            }}
            className="bg-zinc-800 text-xs font-bold text-zinc-100 rounded px-2.5 py-1 border border-zinc-700 focus:outline-none"
          >
            {activities.map(act => (
              <option key={act.code} value={act.code}>{act.name_ar} ({act.name_fr})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Pack Status Card */}
      {activePack && (
        <div className="bg-[#0e1613] text-white rounded-xl p-5 border border-emerald-800/60 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-zinc-100">{activePack.pack_name}</span>
                <span className="bg-emerald-500 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full">
                  النسخة الحية: v{activePack.latest_published_version}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                إجمالي المنتجات المتاحة للتطبيق: <strong className="text-emerald-400">{activePack.total_products} منتج</strong> | آخر نشر: {new Date(activePack.updated_at).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onDownloadPack(activePack.activity_code, activePack.latest_published_version)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل النسخة المنشورة (JSON)</span>
              </button>
              <a
                href={`/storage/packs/${activePack.activity_code}_v${activePack.latest_published_version}.zip`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-amber-400" />
                <span>تحميل أرشيف .ZIP</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Upload & Validate (Left) / Versions History & Rollback (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upload Studio (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 text-zinc-100">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTabMode('zip_upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTabMode === 'zip_upload'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  <FolderArchive className="w-4 h-4 text-amber-300" />
                  <span>رفع نسخة كاملة (.ZIP مع قاعدة البيانات والصور)</span>
                </button>
                <button
                  onClick={() => setActiveTabMode('manual_text')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTabMode === 'manual_text'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>استيراد CSV / JSON يدوي</span>
                </button>
              </div>
            </div>

            {/* TAB 1: ZIP BACKUP UPLOADER */}
            {activeTabMode === 'zip_upload' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <FolderArchive className="w-4 h-4 text-amber-400" />
                        <span>استيراد نسخة DZPOS الاحتياطية (.zip)</span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        يقبل الملف المصدر من تطبيق الأندرويد مباشرة، ويقوم باستخراج المكونات تلقائياً:
                      </p>
                    </div>
                  </div>

                  {/* Components Breakdown Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-mono text-zinc-200 font-bold block">square_pos_database.db</span>
                        <span className="text-[10px] text-zinc-500">قاعدة بيانات SQLite والمنتجات</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-mono text-zinc-200 font-bold block">product_images/</span>
                        <span className="text-[10px] text-zinc-500">مجلد صور المنتجات والباركود</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <span className="font-mono text-zinc-200 font-bold block">backup_manifest.json</span>
                        <span className="text-[10px] text-zinc-500">معلومات النسخة والتاريخ</span>
                      </div>
                    </div>
                  </div>

                  {/* Dropzone & File Input */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 bg-zinc-950/90 rounded-xl border-2 border-dashed border-zinc-700 hover:border-emerald-500/80 transition flex flex-col items-center justify-center text-center cursor-pointer group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      onChange={handleZipFileChange}
                      className="hidden"
                    />

                    <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                      <Upload className="w-6 h-6 text-emerald-400" />
                    </div>

                    <span className="text-xs font-bold text-zinc-200">
                      {zipFile ? zipFile.name : 'اضغط لاختيار ملف .zip أو اسحبه وأفلته هنا'}
                    </span>
                    <span className="text-[11px] text-zinc-500 mt-1">
                      {zipFile ? `الحجم: ${(zipFile.size / 1024).toFixed(1)} KB` : 'يدعم حزم النسخ الاحتياطية المصدرة من أجهزة نقاط البيع'}
                    </span>
                  </div>

                  {/* Submit Action */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-zinc-400">
                      النشاط المستهدف: <strong className="text-emerald-400">{activities.find(a => a.code === currentActivity)?.name_ar}</strong>
                    </div>

                    <button
                      onClick={handleExecuteZipUpload}
                      disabled={!zipFile || isUploadingZip}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingZip ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>جاري فك الضغط واستخراج البيانات...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>رفع ومعالجة الحزمة ونشرها فوراً</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Error Notification */}
                  {zipUploadError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{zipUploadError}</span>
                    </div>
                  )}

                  {/* Success Result Card */}
                  {zipUploadResult && (
                    <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>{zipUploadResult.message}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">الإصدار المنشور</span>
                          <span className="text-sm font-bold text-zinc-100 font-mono">v{zipUploadResult.version}</span>
                        </div>
                        <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">إجمالي المنتجات</span>
                          <span className="text-sm font-bold text-emerald-400">{zipUploadResult.total_products} منتج</span>
                        </div>
                        <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">الصور المستخرجة</span>
                          <span className="text-sm font-bold text-amber-400">{zipUploadResult.total_images} صورة</span>
                        </div>
                        <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">التصنيفات</span>
                          <span className="text-sm font-bold text-blue-400">{zipUploadResult.total_categories} تصنيف</span>
                        </div>
                      </div>

                      <div className="p-2 bg-zinc-950 rounded border border-zinc-800 font-mono text-[10px] text-zinc-400 break-all">
                        SHA-256: {zipUploadResult.checksum_sha256}
                      </div>

                      {/* Extracted Images Mini Gallery */}
                      {zipUploadResult.extracted_images && zipUploadResult.extracted_images.length > 0 && (
                        <div className="space-y-1.5 pt-2">
                          <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>معاينة بعض الصور المستخرجة من الحزمة ({zipUploadResult.extracted_images.length}):</span>
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto py-1">
                            {zipUploadResult.extracted_images.slice(0, 8).map((imgName: string, idx: number) => (
                              <div key={idx} className="relative group shrink-0 w-14 h-14 rounded-lg bg-zinc-900 border border-zinc-700 overflow-hidden">
                                <img
                                  src={imgName.startsWith('http') || imgName.startsWith('/') || imgName.startsWith('data:') ? imgName : `/storage/products/${encodeURIComponent(imgName)}`}
                                  alt={imgName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as any).src = 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=100&h=100&fit=crop';
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-900/60">
                        <a
                          href={zipUploadResult.download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>رابط المزامنة للتطبيق (JSON Sync API)</span>
                        </a>
                        <a
                          href={zipUploadResult.zip_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-semibold border border-zinc-700 transition flex items-center gap-1.5"
                        >
                          <Archive className="w-3.5 h-3.5 text-amber-400" />
                          <span>تحميل ملف .ZIP الأصلي</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MANUAL CSV / JSON STUDIO */}
            {activeTabMode === 'manual_text' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs text-zinc-400">استيراد نصي مباشر أو استخدام النماذج:</span>
                  {/* Sample Templates Fast-Load */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-zinc-400 hidden sm:inline">نماذج سريعة:</span>
                    <button
                      onClick={() => loadSampleTemplate('grocery')}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
                    >
                      مواد غذائية
                    </button>
                    <button
                      onClick={() => loadSampleTemplate('cosmetics')}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
                    >
                      كوزميتيك
                    </button>
                    <button
                      onClick={() => loadSampleTemplate('hardware')}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
                    >
                      كَنكايري
                    </button>
                  </div>
                </div>

                {/* File Drag / Select Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-zinc-900/60 rounded-xl border border-dashed border-zinc-700">
                  <div className="text-xs text-zinc-300">
                    <span className="font-semibold block">اختر ملف من جهازك (CSV أو JSON):</span>
                    <span className="text-[11px] text-zinc-400">الأعمدة المطلوبة: Designation, Code_Barre, Prix, Categorie</span>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={handleManualTextUpload}
                    className="text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Raw Content Textarea */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-1">
                    <span>محتوى الملف النصي (CSV / JSON Raw Data):</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer text-zinc-300">
                        <input
                          type="radio"
                          checked={fileType === 'csv'}
                          onChange={() => setFileType('csv')}
                          className="accent-emerald-500"
                        />
                        <span>CSV</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-zinc-300">
                        <input
                          type="radio"
                          checked={fileType === 'json'}
                          onChange={() => setFileType('json')}
                          className="accent-emerald-500"
                        />
                        <span>JSON</span>
                      </label>
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="الصق بيانات CSV أو JSON هنا مباشرة أو اضغط على أحد النماذج التجريبية في الأعلى..."
                    className="w-full p-3 font-mono text-xs rounded-lg border border-zinc-700 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-zinc-950 text-zinc-200"
                  />
                </div>

                {/* Validate Action */}
                <div className="flex justify-end">
                  <button
                    onClick={handleValidate}
                    disabled={isValidating || !rawContent.trim()}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>{isValidating ? 'جاري الفحص...' : 'فحص ومطابقة المخطط (Validate Schema)'}</span>
                  </button>
                </div>

                {/* Validation Outcome Report & Preview */}
                {validationResult && (
                  <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {validationResult.is_valid ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-400" />
                        )}
                        <span className="text-xs font-bold text-zinc-100">
                          {validationResult.is_valid ? 'الملف صالح ومطابق بنجاح' : 'توجد أخطاء في تنسيق الملف'}
                        </span>
                      </div>

                      <span className="text-xs text-zinc-400">
                        إجمالي السجلات المفحوصة: <strong className="text-zinc-100">{validationResult.total_rows}</strong>
                      </span>
                    </div>

                    {/* Errors list */}
                    {validationResult.errors && validationResult.errors.length > 0 && (
                      <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-300 space-y-1">
                        <span className="font-semibold block">الأخطاء المكتشفة:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                          {validationResult.errors.map((err: string, idx: number) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Preview Table */}
                    {validationResult.preview && validationResult.preview.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-zinc-300">
                          معاينة أول {Math.min(validationResult.preview.length, 5)} منتجات:
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-zinc-900 text-zinc-400">
                              <tr>
                                <th className="p-2">الاسم</th>
                                <th className="p-2">الباركود</th>
                                <th className="p-2">السعر (دج)</th>
                                <th className="p-2">التصنيف</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 font-mono text-[11px]">
                              {validationResult.preview.slice(0, 5).map((p: any, idx: number) => (
                                <tr key={idx} className="hover:bg-zinc-900/50">
                                  <td className="p-2 font-sans text-zinc-200">{p.name}</td>
                                  <td className="p-2 text-zinc-400">{p.barcode}</td>
                                  <td className="p-2 text-emerald-400 font-bold">{p.default_price || p.price}</td>
                                  <td className="p-2 text-zinc-400">{p.category || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Version Confirmation Form */}
                        <div className="pt-3 border-t border-zinc-800 space-y-2.5 text-xs">
                          <div>
                            <label className="block font-semibold text-zinc-300 mb-1">ملخص التغييرات في هذه النسخة:</label>
                            <input
                              type="text"
                              placeholder="مثال: تحديث أسعار المشروبات وإضافة أصناف جديدة 2026..."
                              value={changesSummary}
                              onChange={(e) => setChangesSummary(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer text-zinc-300 font-medium">
                              <input
                                type="checkbox"
                                checked={autoPublish}
                                onChange={(e) => setAutoPublish(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>نشر هذه النسخة فوراً ليتمكن الزبائن من تحميلها</span>
                            </label>

                            <button
                              onClick={handleConfirmCreateVersion}
                              disabled={isCreatingVersion || !validationResult.is_valid}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md transition cursor-pointer disabled:opacity-50"
                            >
                              {isCreatingVersion ? 'جاري الحفظ...' : 'تأكيد وحفظ النسخة الجديدة'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Version History & Rollback System (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-indigo-400" />
                <span>سجل النسخ ونظام التراجع (Version History & Rollback)</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                تتبع جميع الإصدارات السابقة، والتراجع الفوري بنقرة واحدة عند وقوع أخطاء في الأسعار.
              </p>
            </div>

            <div className="space-y-3">
              {packVersions.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800 space-y-2">
                  <RotateCcw className="w-8 h-8 mx-auto text-zinc-600 opacity-60" />
                  <p className="font-semibold text-zinc-400">لا توجد نسخ مسجلة لهذا النشاط بعد</p>
                  <p className="text-[11px] text-zinc-500">قم برفع ملف .zip من تطبيق الكاشير أو استيراد ملف CSV لإنشاء النسخة الأولى.</p>
                </div>
              ) : (
                packVersions.map((v) => {
                  const isCurrentPublished = activePack?.latest_published_version === v.version && v.status === 'published';
                  const versionKey = v.version_id || (v as any).id || `ver_${v.activity_code}_${v.version}`;

                  return (
                    <div
                      key={versionKey}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 transition ${
                        isCurrentPublished
                          ? 'border-emerald-700/60 bg-emerald-950/30 ring-1 ring-emerald-500/20'
                          : v.status === 'archived'
                          ? 'border-zinc-800/60 bg-zinc-950/60 opacity-80'
                          : 'border-zinc-800 bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-zinc-100 font-mono">v{v.version}</span>
                          {isCurrentPublished ? (
                            <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              النسخة الحالية المنشورة
                            </span>
                          ) : (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              v.status === 'ready'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : v.status === 'draft'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {v.status}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-zinc-500">
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-300 font-medium">
                        {v.changes_summary || 'تحديث البيانات'}
                      </p>

                      <div className="text-[10px] font-mono text-zinc-400 truncate bg-zinc-950 p-1.5 rounded border border-zinc-800">
                        SHA-256: {v.checksum_sha256}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[11px]">
                        <span className="text-zinc-400 font-medium">
                          {v.total_products} منتج | {Math.round((v.file_size_bytes || 0) / 1024)} KB
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenVersionPreview(v.activity_code, v.version)}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition border border-zinc-700/60"
                            title="معاينة محتويات المنتجات والأسعار داخل هذه النسخة"
                          >
                            <Eye className="w-3 h-3 text-emerald-400" />
                            <span>معاينة ({v.total_products})</span>
                          </button>

                          <button
                            onClick={() => onDownloadPack(v.activity_code, v.version)}
                            className="text-zinc-400 hover:text-zinc-100 font-semibold cursor-pointer"
                          >
                            تحميل
                          </button>

                          {v.status === 'ready' && (
                            <button
                              onClick={() => onPublishVersion(v.version_id || (v as any).id)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                            >
                              نشر الآن
                            </button>
                          )}

                          {!isCurrentPublished && (
                            <button
                              onClick={() => handleRollbackClick(v.version)}
                              className="px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 font-bold transition flex items-center gap-1 cursor-pointer"
                              title="استعادة هذه النسخة كنسخة منشورة حالياً"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>تراجع إلى v{v.version}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Version Products Preview */}
      {previewVersionData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>معاينة منتجات النسخة v{previewVersionData.version}</span>
                    <span className="text-xs font-mono text-emerald-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                      {previewVersionData.activityCode}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    إجمالي المنتجات المسجلة في هذه النسخة: {previewVersionData.products.length} منتج
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPreviewVersionData(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-950 flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="بحث بالاسم أو الباركود أو التصنيف..."
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                className="bg-transparent text-xs text-zinc-100 w-full focus:outline-none"
              />
              {previewSearch && (
                <button
                  onClick={() => setPreviewSearch('')}
                  className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {previewVersionData.loading ? (
                <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs">جاري تحميل المنتجات من النسخة...</span>
                </div>
              ) : previewVersionData.error ? (
                <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{previewVersionData.error}</span>
                </div>
              ) : (
                (() => {
                  const filtered = previewVersionData.products.filter(p => {
                    if (!previewSearch) return true;
                    const q = previewSearch.toLowerCase();
                    return (
                      (p.name && p.name.toLowerCase().includes(q)) ||
                      (p.name_ar && p.name_ar.toLowerCase().includes(q)) ||
                      (p.barcode && p.barcode.includes(q)) ||
                      (p.category && p.category.toLowerCase().includes(q))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-zinc-500 text-xs">
                        لا توجد منتجات مطابقة لنتيجة البحث
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filtered.map((prod, idx) => (
                        <div
                          key={prod.product_id || idx}
                          className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl flex items-start gap-3 text-xs hover:border-zinc-700 transition"
                        >
                          <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                            {prod.image_url ? (
                              <img
                                src={prod.image_url.startsWith('http') || prod.image_url.startsWith('/') || prod.image_url.startsWith('data:') ? prod.image_url : `/storage/products/${encodeURIComponent(prod.image_url)}`}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as any).src = 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=100&h=100&fit=crop';
                                }}
                              />
                            ) : (
                              <Tag className="w-5 h-5 text-zinc-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold text-zinc-100 truncate block">
                                {prod.name || prod.name_ar || prod.name_fr}
                              </span>
                              <span className="font-bold text-emerald-400 font-mono shrink-0">
                                {prod.default_price || prod.price || 0} د.ج
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                              <span className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-300">
                                {prod.barcode || 'بدون باركود'}
                              </span>
                              <span className="text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                {prod.category || 'عام'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs">
              <span className="text-zinc-500">
                إصدار الحزمة: v{previewVersionData.version} ({previewVersionData.activityCode})
              </span>
              <button
                onClick={() => setPreviewVersionData(null)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-semibold transition cursor-pointer"
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
