import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Building2,
  DollarSign,
  Search,
  Check,
  Eye,
  Sliders,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  Percent,
  ScanLine
} from 'lucide-react';
import {
  AiInvoiceAnalysisResult,
  PurchaseInvoice,
  PurchaseItem,
  BusinessActivity,
  Product
} from '../types/dzpos.js';

interface AiInvoiceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedPurchase: PurchaseInvoice) => void;
  activities: BusinessActivity[];
  currentProducts?: Product[];
}

export const AiInvoiceScannerModal: React.FC<AiInvoiceScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activities,
  currentProducts = []
}) => {
  // Navigation & Scan Phase
  const [activeTab, setActiveTab] = useState<'upload' | 'camera' | 'sample'>('upload');
  const [selectedActivity, setSelectedActivity] = useState<string>('grocery');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [scanResult, setScanResult] = useState<AiInvoiceAnalysisResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiCreds, setAiCreds] = useState<any | null>(null);

  // Review Form States
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [supplierAddress, setSupplierAddress] = useState<string>('');
  const [supplierTaxId, setSupplierTaxId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [orderRef, setOrderRef] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Espèces');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [autoConfirmStock, setAutoConfirmStock] = useState<boolean>(true);

  // Camera stream references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Catalog product selection popup
  const [activeItemSelectIndex, setActiveItemSelectIndex] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');

  // Fetch AI credentials on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/v1/ai/credentials')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setAiCreds(data.data);
          }
        })
        .catch(err => console.error('Failed to fetch AI credentials:', err));
    }
  }, [isOpen]);

  // Clean up camera stream when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setScanResult(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    setErrorMsg(null);
    setIsAnalyzing(false);
    setItems([]);
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsCameraActive(true);
      } else {
        setCameraError('الكاميرا غير مدعومة في هذا المتصفح. يمكنك اختيار صورة من جهازك.');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن أو رفع صورة من الجهاز.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture image from camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPreviewUrl(dataUrl);
    stopCamera();

    // Convert data URL to Blob/File
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `invoice_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
        handleAnalyze(file, dataUrl);
      });
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMsg(null);

      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      handleAnalyze(file);
    }
  };

  // Sample Invoices for Instant AI Test
  const handleSelectSample = (sampleType: 'grocery' | 'hardware' | 'restaurant') => {
    setSelectedActivity(sampleType === 'grocery' ? 'grocery' : sampleType === 'hardware' ? 'hardware' : 'restaurant');
    setSelectedFile(null);
    setPreviewUrl(null);
    handleAnalyze(null, undefined, sampleType);
  };

  // Trigger Backend AI Analysis
  const handleAnalyze = async (file?: File | null, base64Override?: string, sampleType?: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisStep('جاري قراءة وثيقة الفاتورة وتحسين التباين...');

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else if (base64Override) {
        formData.append('image_base64', base64Override);
      }
      formData.append('activity_code', sampleType ? (sampleType === 'grocery' ? 'grocery' : 'hardware') : selectedActivity);
      if (sampleType) {
        formData.append('is_sample_test', 'true');
      }

      setTimeout(() => {
        setAnalysisStep('جاري استخراج بيانات المورد، الرقم التسلسلي والأسطر المالية...');
      }, 700);

      setTimeout(() => {
        setAnalysisStep('جاري مطابقة أسماء المنتجات والأكواد الشريطة مع كتالوج DZPOS...');
      }, 1400);

      const response = await fetch('/api/purchases/analyze-invoice', {
        method: 'POST',
        body: file ? formData : JSON.stringify({
          activity_code: sampleType ? (sampleType === 'grocery' ? 'grocery' : 'hardware') : selectedActivity,
          image_base64: base64Override || '',
          is_sample_test: !!sampleType
        }),
        headers: file ? {} : { 'Content-Type': 'application/json' }
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'فشل في تحليل الفاتورة بواسطة الذكاء الاصطناعي.');
      }

      const resData: AiInvoiceAnalysisResult = json.data;
      setScanResult(resData);

      // Populate editable review fields
      setSupplierName(resData.supplier_name || '');
      setSupplierPhone(resData.supplier_phone || '');
      setSupplierAddress(resData.supplier_address || '');
      setSupplierTaxId(resData.supplier_tax_id || '');
      setInvoiceNumber(resData.invoice_number || `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setInvoiceDate(resData.invoice_date || new Date().toISOString().split('T')[0]);
      setOrderRef(resData.order_ref || '');
      setPaymentMethod(resData.payment_method || 'Espèces');
      setNotes(resData.notes || '');

      // Populate line items
      const mappedItems: PurchaseItem[] = resData.items.map((item, idx) => {
        const bestCandidate = item.matched_candidates?.[0];
        return {
          id: `pi_temp_${idx}_${Date.now()}`,
          product_id: item.product_id || bestCandidate?.product_id,
          matched_product_name: item.matched_product_name || bestCandidate?.name || item.raw_name,
          raw_name: item.raw_name,
          barcode: item.barcode || bestCandidate?.barcode || '',
          category: item.category || bestCandidate?.category || 'عام',
          unit: item.unit || bestCandidate?.unit || 'Pièce',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          selling_price: item.selling_price || (bestCandidate ? bestCandidate.price : Math.round(item.unit_price * 1.25)),
          discount: item.discount || 0,
          tax_rate: item.tax_rate ?? 0,
          tax_amount: item.tax_amount || 0,
          total_ht: item.total_ht || (item.quantity * item.unit_price),
          total_ttc: item.total_ttc || (item.quantity * item.unit_price),
          confidence: item.confidence,
          match_status: item.match_status,
          matched_candidates: item.matched_candidates,
          is_new_product: item.match_status === 'new_product'
        };
      });

      setItems(mappedItems);
    } catch (err: any) {
      console.error('Invoice analysis error:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء معالجة الفاتورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Recalculate financial totals dynamically
  const calculateTotals = () => {
    let subtotalHt = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalTtc = 0;

    items.forEach(itm => {
      const lineHt = (itm.quantity * itm.unit_price) - (itm.discount || 0);
      const lineTax = (lineHt * (itm.tax_rate || 0)) / 100;
      const lineTtc = lineHt + lineTax;

      subtotalHt += (itm.quantity * itm.unit_price);
      totalDiscount += (itm.discount || 0);
      totalTax += lineTax;
      totalTtc += lineTtc;
    });

    return {
      subtotalHt: Math.round(subtotalHt * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalTtc: Math.round(totalTtc * 100) / 100
    };
  };

  const totals = calculateTotals();

  // Line item field update helper
  const handleItemChange = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Auto update line totals
      const qty = field === 'quantity' ? Number(value) : item.quantity;
      const price = field === 'unit_price' ? Number(value) : item.unit_price;
      const disc = field === 'discount' ? Number(value) : (item.discount || 0);
      const taxRate = field === 'tax_rate' ? Number(value) : (item.tax_rate || 0);

      const lineHt = Math.max(0, (qty * price) - disc);
      const lineTax = (lineHt * taxRate) / 100;
      item.total_ht = Math.round(lineHt * 100) / 100;
      item.tax_amount = Math.round(lineTax * 100) / 100;
      item.total_ttc = Math.round((lineHt + lineTax) * 100) / 100;

      updated[index] = item;
      return updated;
    });
  };

  // Add empty row
  const handleAddItem = () => {
    const newItem: PurchaseItem = {
      id: `pi_manual_${Date.now()}`,
      matched_product_name: '',
      raw_name: '',
      barcode: '',
      category: 'عام',
      unit: 'Pièce',
      quantity: 1,
      unit_price: 100,
      selling_price: 130,
      discount: 0,
      tax_rate: 0,
      tax_amount: 0,
      total_ht: 100,
      total_ttc: 100,
      match_status: 'new_product',
      is_new_product: true
    };
    setItems(prev => [...prev, newItem]);
  };

  // Remove row
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Select catalog match candidate for item
  const handleApplyCandidate = (index: number, product: Product | null) => {
    if (product) {
      handleItemChange(index, 'product_id', product.product_id);
      handleItemChange(index, 'matched_product_name', product.name || product.name_ar);
      handleItemChange(index, 'barcode', product.barcode || '');
      handleItemChange(index, 'category', product.category || 'عام');
      handleItemChange(index, 'unit', product.unit || 'Pièce');
      handleItemChange(index, 'selling_price', product.price || Math.round(items[index].unit_price * 1.25));
      handleItemChange(index, 'match_status', 'matched');
      handleItemChange(index, 'is_new_product', false);
    } else {
      // Mark as brand new product
      handleItemChange(index, 'product_id', undefined);
      handleItemChange(index, 'matched_product_name', items[index].raw_name);
      handleItemChange(index, 'match_status', 'new_product');
      handleItemChange(index, 'is_new_product', true);
    }
    setActiveItemSelectIndex(null);
  };

  // Save / Confirm purchase to server
  const handleSavePurchase = async (status: 'confirmed' | 'draft') => {
    if (!supplierName.trim()) {
      setErrorMsg('يرجى تحديد اسم المورد.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('يجب أن تحتوي الفاتورة على منتج واحد على الأقل.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payload: Partial<PurchaseInvoice> & { auto_confirm?: boolean } = {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        order_ref: orderRef,
        supplier_name: supplierName,
        supplier_phone: supplierPhone,
        supplier_address: supplierAddress,
        supplier_tax_id: supplierTaxId,
        status: status,
        auto_confirm: status === 'confirmed',
        payment_status: 'paid',
        payment_method: paymentMethod,
        subtotal_ht: totals.subtotalHt,
        total_tax: totals.totalTax,
        total_discount: totals.totalDiscount,
        total_ttc: totals.totalTtc,
        items,
        notes,
        activity_code: selectedActivity,
        file_url: scanResult?.file_url,
        file_name: scanResult?.file_name || selectedFile?.name,
        ai_metadata: scanResult ? {
          analyzed_at: new Date().toISOString(),
          model: scanResult.ai_metadata?.model || 'gemini-3.7-flash',
          confidence_avg: scanResult.confidence_overall,
          latency_ms: scanResult.ai_metadata?.latency_ms,
          tokens_used: scanResult.ai_metadata?.tokens_used
        } : undefined
      };

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.error || 'فشل في حفظ فاتورة الشراء.');
      }

      onSuccess(resJson.data);
      onClose();
    } catch (err: any) {
      console.error('Error saving purchase:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ الفاتورة.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div
        id="ai-invoice-modal-card"
        className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>إضافة فاتورة شراء بالذكاء الاصطناعي</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal border border-emerald-500/30">
                  Gemini 3.7 Vision
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                قراءة آلية، استخراج البيانات المالية، ومطابقة المنتجات مع المخزون والكتالوج بضغطة واحدة
              </p>
            </div>
          </div>
          <button
            id="close-ai-invoice-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-xs text-rose-400 hover:underline"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* PHASE 1: Scan & Upload Screen (When not reviewed yet) */}
          {!scanResult && !isAnalyzing && (
            <div className="space-y-6">
              {/* Architecture & AI Key Source Badge */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/70 to-slate-900 border border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-100">نمط المعالجة: مباشر على تطبيق الكاسة (Client Direct AI)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 font-mono">
                        {aiCreds?.model || 'gemini-3.7-flash'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      الباكند هو مصدر المفاتيح والمواصفات (<code className="text-emerald-400">/api/v1/ai/credentials</code>) وتتم المعالجة والمطابقة محلياً في التطبيق مع مزامنة النتائج.
                    </p>
                  </div>
                </div>
                {aiCreds && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-black/40 px-2.5 py-1 rounded-lg border border-zinc-800 self-end sm:self-auto font-mono">
                    <span className={`w-2 h-2 rounded-full ${aiCreds.key_available ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                    <span>المفتاح: {aiCreds.key_available ? 'نشط وموزّع' : 'غير متوفر (يحتاج ضبط)'}</span>
                    <span>•</span>
                    <span>المتبقي اليوم: {aiCreds.remaining_today}/{aiCreds.daily_limit}</span>
                  </div>
                )}
              </div>

              {aiCreds && !aiCreds.key_available && (
                <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold text-amber-300">مفتاح Google Gemini API غير متوفر حالياً:</strong>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">
                      لقراءة صور الفواتير الحقيقية واستخراج أسطرها بدقة، يرجى إدخال مفتاح Gemini API في تبويب <strong>«الإعدادات»</strong> (Settings)، أو يمكنك استخدام <strong>«النماذج التجريبية الجاهزة»</strong> لاختبار آلية الفحص والمطابقة.
                    </p>
                  </div>
                </div>
              )}

              {/* Activity Selector & Modes */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-300">النشاط المستهدف:</span>
                  <select
                    id="activity-selector"
                    value={selectedActivity}
                    onChange={e => setSelectedActivity(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    {activities.map(act => (
                      <option key={act.code} value={act.code}>
                        {act.name_ar} ({act.name_fr})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Upload Mode Tabs */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    id="tab-upload-file-btn"
                    onClick={() => { setActiveTab('upload'); stopCamera(); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'upload'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>رفع ملف / صورة / PDF</span>
                  </button>
                  <button
                    id="tab-camera-btn"
                    onClick={() => { setActiveTab('camera'); startCamera(); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'camera'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>تصوير بالكاميرا</span>
                  </button>
                  <button
                    id="tab-sample-btn"
                    onClick={() => { setActiveTab('sample'); stopCamera(); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'sample'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>نماذج تجريبية جاهزة</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Upload File */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <label
                    htmlFor="invoice-file-input"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-700 hover:border-emerald-500/80 rounded-2xl cursor-pointer bg-slate-800/30 hover:bg-slate-800/60 transition-all group p-6 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform text-emerald-400">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <p className="text-base font-medium text-slate-200 mb-1">
                      اسحب وأفلت فاتورة المورد هنا، أو <span className="text-emerald-400 underline">تصفح جهازك</span>
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      يدعم الصور (JPG, PNG, WEBP) وملفات المستندات (PDF) حتى 25 ميغابايت
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800">
                      <span>✓ الفواتير الورقية</span>
                      <span>•</span>
                      <span>✓ وصولات التسليم (BL)</span>
                      <span>•</span>
                      <span>✓ الفواتير الحرارية</span>
                    </div>
                    <input
                      id="invoice-file-input"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Tab 2: Camera Capture */}
              {activeTab === 'camera' && (
                <div className="space-y-4">
                  {cameraError ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                      {cameraError}
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* Viewfinder Target Box */}
                      <div className="absolute inset-8 border-2 border-emerald-500/60 rounded-xl pointer-events-none flex flex-col justify-between p-4">
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400"></div>
                          <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400"></div>
                        </div>
                        <div className="text-center text-xs text-emerald-300 bg-black/60 py-1 px-3 rounded-full mx-auto backdrop-blur-sm">
                          قم بمحاذاة الفاتورة داخل الإطار
                        </div>
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400"></div>
                          <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400"></div>
                        </div>
                      </div>

                      {/* Capture Trigger Button */}
                      <div className="absolute bottom-4 inset-x-0 flex justify-center">
                        <button
                          id="capture-invoice-photo-btn"
                          onClick={capturePhoto}
                          className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/40 transition-transform active:scale-95"
                        >
                          <Camera className="w-5 h-5" />
                          <span>التقاط وتحليل الفاتورة</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Quick Samples */}
              {activeTab === 'sample' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => handleSelectSample('grocery')}
                    className="p-5 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/60 cursor-pointer transition-all space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        نموذج مواد غذائية وسوبرماركت
                      </span>
                      <span className="text-xs text-slate-400 font-mono">4 منتجات</span>
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                      فاتورة EURL DistriFood Algérie (مواد غذائية بالجملة)
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      تحتوي على حليب كانديا، زيت إيليو 5 لتر، مشروب حمود بوعلام، وجبن لافاش كيري مع أرقام الباركود والأسعار.
                    </p>
                    <button className="w-full py-2 bg-slate-700/50 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تجربة الفحص والتعرف الذكي</span>
                    </button>
                  </div>

                  <div
                    onClick={() => handleSelectSample('hardware')}
                    className="p-5 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/60 cursor-pointer transition-all space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                        نموذج خردوات ومواد بناء (Quincaillerie)
                      </span>
                      <span className="text-xs text-slate-400 font-mono">4 منتجات</span>
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                      فاتورة SARL BatiPro Algérie (أدوات وعُدد صناعية)
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      تحتوي على مثقاب كهربائي CROWN، صاروخ تجليخ، شريط قياس ستانلي، وأكياس إسمنت مع حساب الـ TVA 19%.
                    </p>
                    <button className="w-full py-2 bg-slate-700/50 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تجربة الفحص والتعرف الذكي</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PHASE 2: Animated Scanning & AI Thinking Screen */}
          {isAnalyzing && (
            <div className="py-16 px-6 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping"></div>
                <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                  <Sparkles className="w-10 h-10 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-full">
                  <ScanLine className="w-4 h-4 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-bold text-white">جاري تحليل الفاتورة بواسطة الذكاء الاصطناعي...</h3>
                <p className="text-sm text-emerald-400 font-medium animate-pulse">{analysisStep}</p>
                <p className="text-xs text-slate-500">
                  يقوم نموذج Gemini 3.7 بالتعرف التلقائي على اللغة، استخراج الجداول الحسابية، وتعيين دقة كل حقل بدقة متناهية.
                </p>
              </div>

              {/* Progress skeleton bar */}
              <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-[pulse_1s_ease-in-out_infinite] w-3/4"></div>
              </div>
            </div>
          )}

          {/* PHASE 3: Review & Edit Screen (Results ready) */}
          {scanResult && !isAnalyzing && (
            <div className="space-y-6">
              {/* Fallback Warning Banner if real Gemini OCR was not used */}
              {scanResult.is_fallback && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-xs sm:text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold text-amber-300">وضع المحاكاة التوضيحي (Simulated Fallback Mode)</strong>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      {scanResult.ocr_warning || 'تم توليد هذه البيانات كعينة توضيحية لعدم توفر اتصال مباشر بمفتاح Google Gemini API. لقراءة واستخراج بيانات صور الفواتير الحقيقية بدقة، يرجى إدخال مفتاح Gemini API صالح في الإعدادات.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Duplicate Warning Banner */}
              {scanResult.duplicate_warning && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold mb-0.5">تنبيه: احتمال وجود فاتورة شراء مكررة!</strong>
                    <span>
                      تم العثور على فاتورة سابقة بنفس الرقم ({scanResult.duplicate_warning.existing_invoice_number}) للمورد "{scanResult.duplicate_warning.existing_supplier}" مسجلة بتاريخ {scanResult.duplicate_warning.existing_invoice_date}. يرجى التحقق قبل الحفظ.
                    </span>
                  </div>
                </div>
              )}

              {/* Top Meta & Confidence Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">معدل ثقة الذكاء الاصطناعي:</span>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {Math.round(scanResult.confidence_overall * 100)}% دقة استخراج
                  </span>
                  {scanResult.ai_metadata && (
                    <span className="text-slate-500">({scanResult.ai_metadata.latency_ms}ms)</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setScanResult(null); setSelectedFile(null); }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>إعادة الفحص / رفع صورة أخرى</span>
                  </button>
                </div>
              </div>

              {/* Section 1: Supplier & Invoice Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                {/* Supplier Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>اسم المورد / التاجر:</span>
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="مثال: SARL DistriFood"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                {/* Supplier Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">هاتف المورد:</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={e => setSupplierPhone(e.target.value)}
                    placeholder="0550 ..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Invoice Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>رقم الفاتورة / Facture N°:</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Invoice Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>تاريخ الفاتورة:</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Supplier Tax ID (NIF/RC) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">الرقم الجبائي / NIF / RC:</label>
                  <input
                    type="text"
                    value={supplierTaxId}
                    onChange={e => setSupplierTaxId(e.target.value)}
                    placeholder="NIF / NIS / RC"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>

                {/* Supplier Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">عنوان المورد:</label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={e => setSupplierAddress(e.target.value)}
                    placeholder="الولاية، البلدية..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Order Reference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">مرجع الطلب / Bon de Commande:</label>
                  <input
                    type="text"
                    value={orderRef}
                    onChange={e => setOrderRef(e.target.value)}
                    placeholder="BC-2026-..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">طريقة الدفع:</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Espèces">نقداً (Espèces)</option>
                    <option value="Chèque">شيك بنكي (Chèque)</option>
                    <option value="Virement">تحويل بنكي (Virement)</option>
                    <option value="À terme / Crédit">على الحساب / مؤجل (À terme)</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Line Items Products Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>المنتجات المستخرجة ({items.length} أسطر)</span>
                  </h3>
                  <button
                    id="add-invoice-line-item-btn"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 border border-slate-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة سطر منتج يدوي</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-800 select-none">
                        <tr>
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3 w-32">حالة المطابقة</th>
                          <th className="p-3 min-w-[200px]">اسم المنتج في الفاتورة والكتالوج</th>
                          <th className="p-3 w-36">الباركود</th>
                          <th className="p-3 w-24">الكمية</th>
                          <th className="p-3 w-28">سعر الشراء HT</th>
                          <th className="p-3 w-28">سعر البيع المقترح</th>
                          <th className="p-3 w-20">خصم (د.ج)</th>
                          <th className="p-3 w-20">TVA %</th>
                          <th className="p-3 w-28 text-left">الإجمالي TTC</th>
                          <th className="p-3 w-12 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                            {/* Row Index */}
                            <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>

                            {/* Match Status Badge */}
                            <td className="p-3">
                              {item.match_status === 'matched' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>مطابق 100%</span>
                                </span>
                              ) : item.match_status === 'fuzzy' ? (
                                <button
                                  onClick={() => setActiveItemSelectIndex(idx)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                                >
                                  <Sliders className="w-3 h-3" />
                                  <span>مطابقة تقريبية</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  <Plus className="w-3 h-3" />
                                  <span>منتج جديد</span>
                                </span>
                              )}
                            </td>

                            {/* Product Name & Candidate Picker */}
                            <td className="p-3">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={item.matched_product_name || item.raw_name}
                                  onChange={e => handleItemChange(idx, 'matched_product_name', e.target.value)}
                                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                                {item.raw_name && item.raw_name !== item.matched_product_name && (
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    الأصل بالفاتورة: {item.raw_name}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Barcode */}
                            <td className="p-3">
                              <input
                                type="text"
                                value={item.barcode || ''}
                                onChange={e => handleItemChange(idx, 'barcode', e.target.value)}
                                placeholder="613..."
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                              />
                            </td>

                            {/* Quantity */}
                            <td className="p-3">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                              />
                            </td>

                            {/* Purchase Price HT */}
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unit_price}
                                onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 text-left"
                              />
                            </td>

                            {/* Selling Price */}
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.selling_price || ''}
                                onChange={e => handleItemChange(idx, 'selling_price', Number(e.target.value))}
                                placeholder="سعر البيع"
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500 text-left"
                              />
                            </td>

                            {/* Discount */}
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.discount || 0}
                                onChange={e => handleItemChange(idx, 'discount', Number(e.target.value))}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-1.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500 text-left"
                              />
                            </td>

                            {/* Tax Rate % */}
                            <td className="p-3">
                              <select
                                value={item.tax_rate ?? 0}
                                onChange={e => handleItemChange(idx, 'tax_rate', Number(e.target.value))}
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-1 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
                              >
                                <option value={0}>0%</option>
                                <option value={9}>9%</option>
                                <option value={19}>19%</option>
                              </select>
                            </td>

                            {/* Line Total TTC */}
                            <td className="p-3 text-left font-bold text-white font-mono">
                              {((item.total_ttc || 0)).toLocaleString('fr-DZ')} <span className="text-[10px] text-slate-400 font-normal">د.ج</span>
                            </td>

                            {/* Delete Button */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Section 3: Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/60">
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">الإجمالي قبل الضريبة (Total HT):</span>
                  <div className="text-lg font-bold text-slate-200 font-mono">
                    {totals.subtotalHt.toLocaleString('fr-DZ')} <span className="text-xs text-slate-400 font-normal">د.ج</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400">قيمة التخفيضات (Remise):</span>
                  <div className="text-lg font-bold text-amber-400 font-mono">
                    {totals.totalDiscount.toLocaleString('fr-DZ')} <span className="text-xs text-slate-400 font-normal">د.ج</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400">مجموع الرسوم (TVA Total):</span>
                  <div className="text-lg font-bold text-blue-400 font-mono">
                    {totals.totalTax.toLocaleString('fr-DZ')} <span className="text-xs text-slate-400 font-normal">د.ج</span>
                  </div>
                </div>

                <div className="space-y-1 bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/30">
                  <span className="text-xs font-semibold text-emerald-300">الصافي للدفع (Total TTC):</span>
                  <div className="text-xl font-extrabold text-emerald-400 font-mono">
                    {totals.totalTtc.toLocaleString('fr-DZ')} <span className="text-xs text-emerald-300 font-normal">د.ج</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">ملاحظات الفاتورة:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="ملاحظات التسليم، رقم وصل الاستلام..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Actions */}
        {scanResult && !isAnalyzing && (
          <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 z-20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {items.length} منتج مسجل • الإجمالي: {totals.totalTtc.toLocaleString('fr-DZ')} د.ج
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="save-draft-purchase-btn"
                onClick={() => handleSavePurchase('draft')}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
              >
                حفظ كمسودة للمراجعة لاحقاً
              </button>

              <button
                id="confirm-and-sync-purchase-btn"
                onClick={() => handleSavePurchase('confirmed')}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الترحيل...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الفاتورة وترحيل الكميات للمخزون</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Selector Popup */}
      {activeItemSelectIndex !== null && items[activeItemSelectIndex] && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white">اختر المنتج المطابق من الكتالوج</h4>
              <button
                onClick={() => setActiveItemSelectIndex(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 block">الاسم في الفاتورة:</span>
              <p className="text-xs font-mono font-bold text-amber-300 bg-slate-800 p-2 rounded-lg">
                {items[activeItemSelectIndex].raw_name}
              </p>
            </div>

            {/* Candidate options */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <span className="text-xs text-slate-400 font-semibold">المقترحات الأقرب بالذكاء الاصطناعي:</span>
              {items[activeItemSelectIndex].matched_candidates && items[activeItemSelectIndex].matched_candidates!.length > 0 ? (
                items[activeItemSelectIndex].matched_candidates!.map((cand, cIdx) => (
                  <div
                    key={cIdx}
                    onClick={() => {
                      const found = currentProducts.find(p => p.product_id === cand.product_id);
                      handleApplyCandidate(activeItemSelectIndex, found || {
                        product_id: cand.product_id,
                        activity_code: selectedActivity,
                        name: cand.name,
                        name_ar: cand.name,
                        name_fr: cand.name,
                        barcode: cand.barcode,
                        category: cand.category,
                        brand: 'عام',
                        unit: cand.unit,
                        price: cand.price,
                        default_price: cand.price,
                        purchase_price: items[activeItemSelectIndex].unit_price,
                        stock_qty: 0,
                        min_stock_alert: 5,
                        tax_rate: 0,
                        status: 'active',
                        version: 1,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      });
                    }}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-emerald-900/30 border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{cand.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">بارcode: {cand.barcode || 'بدون'} | تصنيف: {cand.category}</div>
                    </div>
                    <div className="text-left">
                      <span className="text-emerald-400 font-bold font-mono">{Math.round(cand.confidence * 100)}%</span>
                      <span className="block text-[10px] text-slate-400">تطابق</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">لا توجد مقترحات تلقائية قريبة.</p>
              )}
            </div>

            {/* Create as new product action */}
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => handleApplyCandidate(activeItemSelectIndex, null)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                اعتماد كمنتج جديد في الكتالوج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
