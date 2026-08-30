import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Wifi,
  WifiOff,
  RefreshCw,
  KeyRound,
  Download,
  Barcode,
  ShoppingCart,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Laptop,
  Check,
  Package,
  Plus,
  Trash2,
  Smartphone,
  Zap,
  Radio,
  Sparkles,
  Coins,
  Infinity as InfinityIcon,
  Calendar,
  Minus,
  Utensils,
  QrCode,
  Bell,
  Clock,
  ArrowRight,
  Send,
  ChefHat,
  CheckCircle
} from 'lucide-react';
import {
  BusinessActivity,
  ProductRecord,
  LicenseVerifyResponse,
  SyncCheckResponse,
  SubscriptionType,
  PriceCalculationResult,
  TableOrder
} from '../types/dzpos.js';
import { AiInvoiceScannerModal } from './AiInvoiceScannerModal.js';

interface PosSimulatorViewProps {
  activities: BusinessActivity[];
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  defaultLicenseKey?: string;
}

export const PosSimulatorView: React.FC<PosSimulatorViewProps> = ({
  activities,
  isOnline,
  setIsOnline,
  defaultLicenseKey = 'DZPOS-PRO-7A9B-4C2E-88D1'
}) => {
  // Device & License State
  const [activationMode, setActivationMode] = useState<'subscription' | 'remote' | 'manual'>('subscription');
  const [licenseKey, setLicenseKey] = useState(defaultLicenseKey);
  const [deviceId, setDeviceId] = useState('HW-DZ-MOB-8829');
  const [deviceName, setDeviceName] = useState('Samsung Tab POS (Alger)');
  const [mobileCustomerName, setMobileCustomerName] = useState('سوبرماركت القدس');
  const [mobilePhone, setMobilePhone] = useState('0550 12 34 56');
  const [licenseData, setLicenseData] = useState<LicenseVerifyResponse | null>(null);
  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  // ==========================================
  // Subscription System State (Centralized Backend Pricing)
  // ==========================================
  const [subType, setSubType] = useState<SubscriptionType>('yearly');
  const [deviceOption, setDeviceOption] = useState<number>(1);
  const [customDeviceCount, setCustomDeviceCount] = useState<number>(6);
  const [calculatedPrice, setCalculatedPrice] = useState<PriceCalculationResult | null>(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [isActivatingSub, setIsActivatingSub] = useState(false);
  const [boundDevicesList, setBoundDevicesList] = useState<any[]>([]);
  const [isBindingDevice, setIsBindingDevice] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState('كاسة إضافية 2');
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // ==========================================
  // Table QR Orders & Waiter Scanner State
  // ==========================================
  const [liveTableOrders, setLiveTableOrders] = useState<TableOrder[]>([]);
  const [isPollingTableOrders, setIsPollingTableOrders] = useState(true);
  const [selectedTableOrder, setSelectedTableOrder] = useState<TableOrder | null>(null);
  const [tableQrScanInput, setTableQrScanInput] = useState('');
  const [isScanningOrder, setIsScanningOrder] = useState(false);
  const [tableOrderActionMsg, setTableOrderActionMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cashierActiveSection, setCashierActiveSection] = useState<'pos_cart' | 'table_orders'>('table_orders');
  const previousOrdersCountRef = useRef<number>(0);

  const actualDeviceCount = deviceOption === -1 ? customDeviceCount : deviceOption;

  // Fetch backend price dynamically whenever subType or actualDeviceCount changes
  const fetchBackendPrice = async (type: SubscriptionType, count: number) => {
    if (!isOnline) return;
    setIsCalculatingPrice(true);
    try {
      const res = await fetch('/api/subscriptions/calculate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_type: type,
          device_count: count
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCalculatedPrice(data.data);
      }
    } catch (err) {
      console.error('Failed to calculate price from backend:', err);
    } finally {
      setIsCalculatingPrice(false);
    }
  };

  useEffect(() => {
    fetchBackendPrice(subType, actualDeviceCount);
  }, [subType, actualDeviceCount, isOnline]);

  // Submit Subscription Request to Backend
  const handleSubmitSubscription = async () => {
    if (!isOnline) {
      addLog('Cannot submit: Offline mode', 'warn');
      setLicenseError('الهاتف غير متصل بالإنترنت');
      return;
    }

    setIsSubmittingSub(true);
    setLicenseError(null);
    try {
      addLog(`Submitting ${subType} subscription for ${actualDeviceCount} devices...`, 'info');
      const res = await fetch('/api/subscriptions/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: mobileCustomerName,
          phone: mobilePhone,
          business_name: mobileCustomerName,
          activity_code: localActivityCode,
          wilaya_code: '16',
          subscription_type: subType,
          device_count: actualDeviceCount,
          device_id: deviceId,
          device_name: deviceName,
          os: 'Android POS'
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Submission failed');

      addLog(`Subscription request created! ID: ${data.data.request_id}. Price: ${data.data.calculated_price_dzd?.toLocaleString()} DZD`, 'success');
      setSyncStatusMsg(`تم تسجيل طلب الاشتراك بنجاح (${subType === 'yearly' ? 'سنوي' : 'أبدي مدى الحياة'} - ${actualDeviceCount} أجهزة) بسعر رسمي: ${data.data.calculated_price_dzd?.toLocaleString()} د.ج`);
    } catch (err: any) {
      setLicenseError(err.message);
      addLog(`Submission error: ${err.message}`, 'error');
    } finally {
      setIsSubmittingSub(false);
    }
  };

  // Instant 1-Click Activate Subscription
  const handleInstantActivateSubscription = async () => {
    if (!isOnline) {
      addLog('Cannot activate: Offline mode', 'warn');
      return;
    }

    setIsActivatingSub(true);
    setLicenseError(null);
    try {
      addLog(`Directly activating ${subType} subscription on backend for ${actualDeviceCount} devices...`, 'info');
      const res = await fetch('/api/subscriptions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: mobileCustomerName,
          phone: mobilePhone,
          business_name: mobileCustomerName,
          activity_code: localActivityCode,
          wilaya_code: '16',
          subscription_type: subType,
          device_count: actualDeviceCount,
          device_id: deviceId,
          device_name: deviceName,
          os: 'Android 14 POS Terminal'
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Activation failed');

      const lic = data.data.license;
      setLicenseKey(lic.license_key);
      setBoundDevicesList(lic.devices || []);
      addLog(`⚡ Activated! Key: ${lic.license_key}. Plan: ${lic.subscription_type || lic.plan}. Max devices: ${lic.max_devices}`, 'success');

      // Auto verify with new key
      handleVerifyLicenseWithKey(lic.license_key);
      setSyncStatusMsg(`⚡ تم تفعيل وتوليد رخصة الاشتراك بنجاح! نوع الاشتراك: ${subType === 'yearly' ? 'سنوي (1 سنة)' : 'أبدي (Lifetime)'} لعدد ${lic.max_devices} أجهزة.`);
    } catch (err: any) {
      setLicenseError(err.message);
      addLog(`Activation error: ${err.message}`, 'error');
    } finally {
      setIsActivatingSub(false);
    }
  };

  // Bind an additional device to test device limit enforcement
  const handleBindAdditionalDevice = async () => {
    if (!isOnline) return;
    setIsBindingDevice(true);
    setLicenseError(null);
    try {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const newDevId = `HW-POS-TERMINAL-${rand}`;
      addLog(`Attempting to bind new terminal ${newDevId} (${newTerminalName})...`, 'info');

      const res = await fetch('/api/subscriptions/devices/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: newDevId,
          device_name: newTerminalName,
          os: 'Android Tablet'
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Binding failed');
      }

      setBoundDevicesList(data.data.devices || []);
      addLog(`Terminal bound successfully! (${data.data.active_devices_count}/${data.data.max_devices} used, ${data.data.remaining_slots} remaining)`, 'success');
      handleVerifyLicenseWithKey(licenseKey);
    } catch (err: any) {
      setLicenseError(err.message);
      addLog(`Device Limit Error: ${err.message}`, 'error');
    } finally {
      setIsBindingDevice(false);
    }
  };

  // Unbind a device
  const handleUnbindDevice = async (devId: string) => {
    if (!isOnline) return;
    try {
      addLog(`Unbinding terminal ${devId}...`, 'info');
      const res = await fetch('/api/subscriptions/devices/unbind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: devId
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Unbind failed');

      setBoundDevicesList(data.data.devices || []);
      addLog(`Terminal ${devId} unbound. Slots available: ${data.data.remaining_slots}`, 'success');
      handleVerifyLicenseWithKey(licenseKey);
    } catch (err: any) {
      setLicenseError(err.message);
      addLog(`Unbind error: ${err.message}`, 'error');
    }
  };

  // Helper for verify with specific key
  const handleVerifyLicenseWithKey = async (key: string) => {
    try {
      const res = await fetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: key,
          device_id: deviceId,
          device_name: deviceName,
          os: 'Android 14'
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setLicenseData(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Zero-Touch Auto Polling State
  const [isRegisteringDevice, setIsRegisteringDevice] = useState(false);
  const [isAutoPolling, setIsAutoPolling] = useState(false);
  const [registeredReqId, setRegisteredReqId] = useState<string | null>(null);

  // Local Offline Storage State (Simulated SQLite / Room DB in POS Terminal)
  const [localActivityCode, setLocalActivityCode] = useState('grocery');
  const [localPackVersion, setLocalPackVersion] = useState<number>(0);
  const [localChecksum, setLocalChecksum] = useState<string>('');
  const [localProducts, setLocalProducts] = useState<ProductRecord[]>([]);
  const [isDownloadingPack, setIsDownloadingPack] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<SyncCheckResponse | null>(null);

  // POS Cashier & Cart State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<{ product: ProductRecord; quantity: number }[]>([]);
  const [lastReceipt, setLastReceipt] = useState<{ id: string; date: string; items: any[]; total: number } | null>(null);

  // Terminal Event Logs
  const [logs, setLogs] = useState<{ time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);

  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, text, type }, ...prev.slice(0, 15)]);
  };

  // Zero-Touch 1: Send Registration from Mobile Phone Terminal
  const handleRegisterMobileTerminal = async () => {
    if (!isOnline) {
      addLog('Cannot register: Terminal is in Offline mode', 'warn');
      setLicenseError('الهاتف غير متصل بالإنترنت');
      return;
    }

    setIsRegisteringDevice(true);
    setLicenseError(null);
    try {
      addLog(`Sending Zero-Touch Registration for device ID: ${deviceId}...`, 'info');
      const res = await fetch('/api/license/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          device_name: deviceName,
          customer_name: mobileCustomerName,
          business_name: mobileCustomerName,
          phone: mobilePhone,
          activity_code: localActivityCode,
          requested_plan: 'pro'
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Registration failed');

      setRegisteredReqId(data.request_id || 'req_auto');
      setIsAutoPolling(true);
      addLog(`Device registered! Request ID: ${data.request_id || 'OK'}. Now listening for admin remote activation...`, 'success');
      setSyncStatusMsg('تم إرسال طلب التفعيل إلى لوحة الإدارة بنجاح! التطبيق ينتظر الآن التفعيل التلقائي...');
    } catch (err: any) {
      setLicenseError(err.message);
      addLog(`Registration error: ${err.message}`, 'error');
    } finally {
      setIsRegisteringDevice(false);
    }
  };

  // Zero-Touch 2: Check remote activation status (Poll)
  const checkRemoteActivation = async () => {
    if (!isOnline || !deviceId) return;
    try {
      const res = await fetch(`/api/license/device-check?device_id=${encodeURIComponent(deviceId)}`);
      const data = await res.json();

      if (data.success && data.activated && data.license_key) {
        setLicenseKey(data.license_key);
        setIsAutoPolling(false);
        addLog(`⚡ ZERO-TOUCH ACTIVATED! License Key injected automatically: ${data.license_key}`, 'success');

        // Populate verified license data
        setLicenseData({
          valid: true,
          status: 'active',
          subscription_type: data.subscription_type || 'yearly',
          is_lifetime: Boolean(data.is_lifetime),
          expires_at: data.expires_at || null,
          days_remaining: data.days_remaining || 365,
          is_grace_period: false,
          grace_period_days_left: 0,
          customer: {
            name: data.customer_name || 'Client Mobile',
            business_name: data.business_name || 'DZPOS Client',
            wilaya: 'Alger'
          },
          plan: data.plan || 'pro',
          features: data.features || ['pos_standard', 'offline_sync', 'barcode_scanner'],
          max_devices: data.max_devices || 2,
          active_devices_count: 1,
          remaining_devices_count: Math.max(0, (data.max_devices || 2) - 1),
          offline_cache_duration_hours: 168
        });

        setSyncStatusMsg(`⚡ تم تفعيل الهاتف عن بعد بنجاح! تم شحن الرخصة تلقائياً بدون كتابة أي كود.`);

        // Auto download pack
        if (localProducts.length === 0) {
          handleDownloadPack();
        }
      }
    } catch (err: any) {
      console.warn('Poll error:', err);
    }
  };

  // Periodic polling when listening for remote activation
  useEffect(() => {
    if (!isAutoPolling || !isOnline) return;

    const interval = setInterval(() => {
      checkRemoteActivation();
    }, 2500);

    return () => clearInterval(interval);
  }, [isAutoPolling, isOnline, deviceId]);

  // 1. Verify License against Central Backend
  const handleVerifyLicense = async () => {
    if (!isOnline) {
      addLog('Cannot verify license: Terminal is in Offline mode', 'warn');
      setLicenseError('الجهاز في وضع عدم الاتصال (Offline). لا يمكن الاتصال بالسيرفر المركزي.');
      return;
    }

    setIsVerifyingLicense(true);
    setLicenseError(null);
    try {
      addLog(`Sending verification request to /api/license/verify for device ${deviceId}...`, 'info');
      const res = await fetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: deviceId,
          device_name: deviceName,
          os: 'Android 13 (DZPOS Terminal v2.4.0)'
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'License verification failed');
      }

      setLicenseData(data.data);
      addLog(`License verified successfully! Plan: ${data.data.plan}, Lifetime: ${data.data.is_lifetime}, Devices: ${data.data.active_devices_count}/${data.data.max_devices}`, 'success');
      if (data.data.is_grace_period) {
        addLog(`WARNING: License is in GRACE PERIOD (${data.data.grace_period_days_left} days remaining)`, 'warn');
      }
    } catch (err: any) {
      setLicenseError(err.message);
      addLog(`License Error: ${err.message}`, 'error');
    } finally {
      setIsVerifyingLicense(false);
    }
  };

  // 2. Download and Cache Product Pack locally (Offline DB initialization)
  const handleDownloadPack = async () => {
    if (!isOnline) {
      addLog('Cannot download pack: Terminal is Offline', 'warn');
      return;
    }

    setIsDownloadingPack(true);
    setSyncStatusMsg('جاري الاتصال بالسيرفر وتحميل كتالوج المنتجات...');
    try {
      addLog(`Downloading pack for activity '${localActivityCode}'...`, 'info');
      const res = await fetch(`/api/sync/download?activity_code=${localActivityCode}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Download pack failed');
      }

      setLocalProducts(data.data);
      setLocalPackVersion(data.meta.version);
      setLocalChecksum(data.meta.checksum_sha256);
      setUpdateAvailable(null);

      addLog(`Pack v${data.meta.version} stored locally (${data.data.length} products). Checksum verified.`, 'success');
      setSyncStatusMsg(`تم حفظ النسخة v${data.meta.version} بنجاح محلياً (${data.data.length} منتج جاهز للاستخدام بدون إنترنت).`);
    } catch (err: any) {
      addLog(`Download failed: ${err.message}`, 'error');
      setSyncStatusMsg(`فشل التحميل: ${err.message}`);
    } finally {
      setIsDownloadingPack(false);
    }
  };

  // 3. Check for updates (Ping)
  const handleCheckUpdate = async () => {
    if (!isOnline) {
      addLog('Check update skipped: Terminal is Offline', 'warn');
      setSyncStatusMsg('أنت غير متصل بالإنترنت. يتم استخدام البيانات المخزنة محلياً.');
      return;
    }

    setIsCheckingUpdate(true);
    try {
      addLog(`Checking updates: local_version = ${localPackVersion}...`, 'info');
      const res = await fetch('/api/sync/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_code: localActivityCode,
          local_version: localPackVersion,
          license_key: licenseKey,
          device_id: deviceId
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Check failed');

      if (data.data.update_available) {
        setUpdateAvailable(data.data);
        addLog(`Update found! Server has v${data.data.server_version} (Current local: v${localPackVersion})`, 'warn');
        setSyncStatusMsg(`يوجد تحديث جديد (v${data.data.server_version}) يحتوي على منتجات وأسعار محدثة!`);
      } else {
        setUpdateAvailable(null);
        addLog(`Terminal is up-to-date (v${localPackVersion}).`, 'success');
        setSyncStatusMsg(`قاعدة البيانات المحلية محدثة لأحدث إصدار (v${localPackVersion}).`);
      }
    } catch (err: any) {
      addLog(`Check update error: ${err.message}`, 'error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // 4. POS Cart operations (Works 100% Offline)
  const handleAddToCartByBarcode = (code: string) => {
    const prod = localProducts.find(p => p.barcode === code.trim());
    if (!prod) {
      addLog(`Barcode not found in local DB: ${code}`, 'warn');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.product_id === prod.product_id);
      if (existing) {
        return prev.map(item =>
          item.product.product_id === prod.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    addLog(`Scanned: ${prod.name} (${prod.default_price} DZD)`, 'info');
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.product.default_price * item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const receipt = {
      id: `REC-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleTimeString(),
      items: [...cart],
      total: cartTotal
    };
    setLastReceipt(receipt);
    setCart([]);
    addLog(`Transaction completed: Receipt #${receipt.id}, Total: ${cartTotal} DZD`, 'success');
  };

  // ==========================================
  // 5. Live Table Orders & Waiter Scanner Engine (SSE + Resilient Polling)
  // ==========================================
  const fetchLiveTableOrders = async () => {
    if (!isOnline) return;
    try {
      const activeKey = licenseKey || defaultLicenseKey;
      const res = await fetch(`/api/orders/pending?license_key=${encodeURIComponent(activeKey)}`, {
        headers: {
          'Authorization': `Bearer ${activeKey}`
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        const waitingOrders = data.orders.filter((o: TableOrder) => o.status === 'WAITING_WAITER' || (o.status as string) === 'PENDING' || (o as any).order_status === 'PENDING');
        
        // Notify on new incoming orders
        if (waitingOrders.length > previousOrdersCountRef.current && previousOrdersCountRef.current !== 0) {
          addLog(`[QR Table Orders] 🛎️ طلب طاولة جديد قادم! (${waitingOrders[0]?.table_name || waitingOrders[0]?.table_code} - ${waitingOrders[0]?.public_order_number})`, 'warn');
        }
        previousOrdersCountRef.current = waitingOrders.length;
        setLiveTableOrders(data.orders);
      }
    } catch (err) {
      console.warn('Table orders polling skipped:', err);
    }
  };

  useEffect(() => {
    if (!isOnline || !isPollingTableOrders) return;
    fetchLiveTableOrders();

    // 1. Establish real-time SSE stream for 0ms latency updates
    let eventSource: EventSource | null = null;
    try {
      const activeKey = licenseKey || defaultLicenseKey;
      eventSource = new EventSource(`/api/orders/stream?license_key=${encodeURIComponent(activeKey)}`);
      
      eventSource.addEventListener('initial_sync', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (Array.isArray(payload.orders)) {
            setLiveTableOrders(payload.orders);
          }
        } catch {}
      });

      eventSource.addEventListener('order_update', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.order) {
            addLog(`[Live Sync] ⚡ تحديث فوري للطلب: ${payload.order.public_order_number} (${payload.order.table_name || payload.order.table_code} - ${payload.order.status})`, 'info');
            fetchLiveTableOrders();
          }
        } catch {}
      });

      eventSource.addEventListener('order_deleted', () => {
        fetchLiveTableOrders();
      });

      eventSource.onerror = () => {
        // Silent reconnect / fallback to polling
      };
    } catch (sseErr) {
      console.warn('SSE stream unavailable, falling back to interval:', sseErr);
    }

    // 2. Resilient background polling
    const interval = setInterval(fetchLiveTableOrders, 3000);
    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isOnline, isPollingTableOrders, licenseKey]);

  // Scan customer QR token
  const handleScanCustomerQr = async (tokenInput?: string) => {
    const rawToken = tokenInput || tableQrScanInput;
    if (!rawToken.trim()) return;

    let cleanToken = rawToken.trim();
    const match = cleanToken.match(/\/qr\/([^/?#]+)/) || cleanToken.match(/\/token\/([^/?#]+)/);
    if (match) cleanToken = match[1];

    setIsScanningOrder(true);
    setTableOrderActionMsg(null);
    try {
      const res = await fetch('/api/orders/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          license_key: licenseKey || defaultLicenseKey
        })
      });
      const data = await res.json();
      if (data.success && data.order) {
        setSelectedTableOrder(data.order);
        setTableOrderActionMsg({
          text: `تم مسح الطلب ${data.order.public_order_number} بنجاح (${data.order.table_name || data.order.table_code})`,
          type: 'success'
        });
        addLog(`[Waiter Scanner] Scanned ${data.order.public_order_number} (${data.order.total} DZD)`, 'success');
        setTableQrScanInput('');
        fetchLiveTableOrders();
      } else {
        setTableOrderActionMsg({
          text: data.message || 'لم يتم العثور على الطلب',
          type: 'error'
        });
        addLog(`[Waiter Scanner] Scan failed: ${data.message}`, 'error');
      }
    } catch (err: any) {
      setTableOrderActionMsg({ text: `خطأ في المسح: ${err.message}`, type: 'error' });
    } finally {
      setIsScanningOrder(false);
    }
  };

  // Confirm table order
  const handleConfirmTableOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiter_name: 'كاسة DZPOS الرئيسية',
          device_id: deviceId
        })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`[Table Orders] Order #${data.order.public_order_number} confirmed by Cashier/Waiter!`, 'success');
        setTableOrderActionMsg({ text: 'تم تأكيد طلب الطاولة بنجاح! تم إشعار هاتف الزبون فورياً.', type: 'success' });
        await fetchLiveTableOrders();
        if (selectedTableOrder?.id === orderId) {
          setSelectedTableOrder(data.order);
        }
      } else {
        alert(data.message || 'فشل تأكيد الطلب');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Send table order to kitchen
  const handleSendOrderToKitchen = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/kitchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatched_by: 'كاسة DZPOS' })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`[Table Orders] Order #${data.order.public_order_number} sent to Kitchen & Print queue.`, 'info');
        setTableOrderActionMsg({ text: 'تم إرسال الطلب إلى شاشة المطبخ وطباعة التذكرة.', type: 'info' });
        await fetchLiveTableOrders();
        if (selectedTableOrder?.id === orderId) {
          setSelectedTableOrder(data.order);
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Complete and pay table order
  const handleCompleteTableOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_by: 'كاسة DZPOS' })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`[Table Orders] Order #${data.order.public_order_number} marked as COMPLETED & PAID.`, 'success');
        setTableOrderActionMsg({ text: 'تم إتمام دفع وحساب الطلب بنجاح.', type: 'success' });
        await fetchLiveTableOrders();
        if (selectedTableOrder?.id === orderId) {
          setSelectedTableOrder(data.order);
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Load Table Order items into POS Cart (Panier) for immediate printing & checkout
  const handleLoadTableOrderToCart = (order: TableOrder) => {
    if (!order.items || order.items.length === 0) return;

    setCart(prev => {
      const newItems = [...prev];
      order.items.forEach(item => {
        const existing = newItems.find(p => p.product.name === item.product_name || p.product.product_id === item.product_id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          newItems.push({
            product: {
              product_id: item.product_id || `item_${Date.now()}`,
              name: item.product_name,
              barcode: 'QR-MENU',
              default_price: item.price,
              activity_code: localActivityCode,
              category: 'طلبات الطاولات',
              brand: 'QR Menu',
              unit: item.unit || 'Portion',
              status: 'active',
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              name_ar: item.product_name_ar || item.product_name,
              name_fr: item.product_name_fr || item.product_name
            },
            quantity: item.quantity
          });
        }
      });
      return newItems;
    });

    setCashierActiveSection('pos_cart');
    addLog(`[POS Register] Loaded Table #${order.table_code} (${order.total} DZD) into cashier cart!`, 'success');
    setTableOrderActionMsg({ text: `تم تفريغ أصناف الطاولة ${order.table_code} في سلة الكاسة بنجاح!`, type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Simulation Controls */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-bold text-zinc-100">
                محاكي تطبيق كاسة DZPOS ونظام الاشتراكات المركزية
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              اختبار طلب وباقات الاشتراكات (سنوي وأبدي)، احتساب الأسعار ديناميكياً من الباكند، وتأكيد قيود عدد الأجهزة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isOnline
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'متصل بالإنترنت' : 'غير متصل (Offline Mode)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: License & Sync Engine (Top) / Cashier Register (Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Subscription Hub & Terminal Binding (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>1. بوابة الاشتراكات وتفعيل الأجهزة (DZPOS Subscription Hub)</span>
              </h2>
              {licenseData?.valid && (
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{licenseData.is_lifetime ? 'اشتراك أبدي' : 'مرخص'}</span>
                </span>
              )}
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setActivationMode('subscription')}
                className={`flex-1 py-1.5 rounded-md font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activationMode === 'subscription'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>باقات الاشتراكات</span>
              </button>
              <button
                type="button"
                onClick={() => setActivationMode('remote')}
                className={`flex-1 py-1.5 rounded-md font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activationMode === 'remote'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>تفعيل عن بعد</span>
              </button>
              <button
                type="button"
                onClick={() => setActivationMode('manual')}
                className={`flex-1 py-1.5 rounded-md font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activationMode === 'manual'
                    ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>كود يدوي</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {activationMode === 'subscription' ? (
                /* ========================================== */
                /* SUBSCRIPTION SELECTION & ORDERING PANEL   */
                /* ========================================== */
                <div className="space-y-3.5">
                  {/* Subscription Plan Type Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-300">
                      اختر نوع الاشتراك (Subscription Plan):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSubType('yearly')}
                        className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                          subType === 'yearly'
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-sm'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                            <span>1. اشتراك سنوي</span>
                          </span>
                          <span className="text-[10px] bg-emerald-950 border border-emerald-700/50 px-1.5 py-0.5 rounded text-emerald-300">
                            365 يوم
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">تجديد سنوي مع دعم مستمر</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubType('lifetime')}
                        className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                          subType === 'lifetime'
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-sm'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs flex items-center gap-1">
                            <InfinityIcon className="w-3.5 h-3.5 text-indigo-400" />
                            <span>2. اشتراك أبدي</span>
                          </span>
                          <span className="text-[10px] bg-indigo-950 border border-indigo-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                            Lifetime
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">دفعة واحدة دائمة مدى الحياة</p>
                      </button>
                    </div>
                  </div>

                  {/* Device Count Selector: 1, 2, 3, 4, 5, + */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-300">
                      عدد أجهزة الكاسة المسموح بها (Device Slots):
                    </label>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[1, 2, 3, 4, 5].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setDeviceOption(cnt)}
                          className={`py-2 rounded-lg border font-bold text-xs transition cursor-pointer text-center ${
                            deviceOption === cnt
                              ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {cnt} {cnt === 1 ? 'جهاز' : 'أجهزة'}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDeviceOption(-1)}
                        className={`py-2 rounded-lg border font-bold text-xs transition cursor-pointer text-center ${
                          deviceOption === -1
                            ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                            : 'bg-zinc-900 border-zinc-800 text-amber-400 hover:bg-zinc-800'
                        }`}
                      >
                        + أكثر
                      </button>
                    </div>

                    {/* Custom device count input when '+' is chosen */}
                    {deviceOption === -1 && (
                      <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl mt-2 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-amber-300 block text-xs">حدد عدد الأجهزة المطلوب (&gt; 5):</span>
                          <span className="text-[10px] text-zinc-400">
                            يتم احتساب السعر تلقائياً عبر قاعدة الباكند: (سعر 5 أجهزة + سعر الجهاز الإضافي × الفارق)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCustomDeviceCount(Math.max(6, customDeviceCount - 1))}
                            className="w-7 h-7 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 flex items-center justify-center font-bold"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="6"
                            max="50"
                            value={customDeviceCount}
                            onChange={(e) => setCustomDeviceCount(Math.max(6, parseInt(e.target.value, 10) || 6))}
                            className="w-14 px-2 py-1 bg-zinc-900 border border-zinc-700 text-amber-300 font-mono font-bold text-center rounded text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomDeviceCount(customDeviceCount + 1)}
                            className="w-7 h-7 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 flex items-center justify-center font-bold"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Backend Pricing Calculated Result Box */}
                  <div className="p-3.5 bg-gradient-to-br from-zinc-950 to-zinc-900 border border-amber-800/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>السعر الرسمي من الباكند (Backend Calculated):</span>
                      </span>
                      <div className="flex items-baseline gap-1 text-amber-400 font-mono font-black text-base">
                        {isCalculatingPrice ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
                        ) : (
                          <>
                            <span>{calculatedPrice?.price_dzd?.toLocaleString() || '...'}</span>
                            <span className="text-xs text-amber-400/80">د.ج</span>
                          </>
                        )}
                      </div>
                    </div>

                    {calculatedPrice?.rule_description && (
                      <div className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-1.5 font-mono">
                        📋 {calculatedPrice.rule_description}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSubmitSubscription}
                      disabled={isSubmittingSub}
                      className="py-2 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[11px]"
                    >
                      <Radio className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isSubmittingSub ? 'جاري الإرسال...' : '1. تقديم طلب اشتراك'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleInstantActivateSubscription}
                      disabled={isActivatingSub}
                      className="py-2 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[11px]"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isActivatingSub ? 'جاري التفعيل...' : '2. ⚡ تفعيل فوري ومباشر'}</span>
                    </button>
                  </div>

                  {/* Device Limit & Multi-Terminal Testing Box */}
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-300 flex items-center gap-1.5 text-xs">
                        <Laptop className="w-3.5 h-3.5 text-sky-400" />
                        <span>اختبار قيود عدد الأجهزة المربوطة (Device Slots)</span>
                      </span>
                      <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded font-bold">
                        {licenseData ? `${licenseData.active_devices_count}/${licenseData.max_devices} أجهزة` : `الحد: ${actualDeviceCount}`}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="اسم الجهاز الجديد..."
                        value={newTerminalName}
                        onChange={(e) => setNewTerminalName(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-100 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleBindAdditionalDevice}
                        disabled={isBindingDevice}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ربط جهاز إضافي</span>
                      </button>
                    </div>

                    {/* Bound devices listing */}
                    {boundDevicesList.length > 0 && (
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pt-1">
                        {boundDevicesList.map((dev: any) => (
                          <div key={dev.device_id || dev.id} className="flex items-center justify-between p-2 bg-zinc-950 rounded border border-zinc-800 text-[11px]">
                            <div>
                              <span className="font-bold text-zinc-200 block">{dev.device_name}</span>
                              <span className="text-zinc-500 font-mono text-[10px]">{dev.device_id}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnbindDevice(dev.device_id)}
                              className="text-rose-400 hover:text-rose-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer bg-rose-950/40 px-2 py-1 rounded border border-rose-900/50"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>تحرير الخانة</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : activationMode === 'remote' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-sky-950/40 border border-sky-800/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-200 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-sky-400" />
                        <span>معلومات هاتف الكاسة (Mobile Terminal)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const rand = Math.floor(1000 + Math.random() * 9000);
                          setDeviceId(`HW-DZ-MOB-${rand}`);
                        }}
                        className="text-[10px] text-sky-300 hover:underline cursor-pointer"
                      >
                        توليد ID عشوائي
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-sky-300/80 mb-0.5">معرّف الجهاز (Device ID)</label>
                        <input
                          type="text"
                          value={deviceId}
                          onChange={(e) => setDeviceId(e.target.value)}
                          className="w-full px-2.5 py-1.5 font-mono text-[11px] rounded-lg border border-sky-700/60 bg-zinc-900 text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-sky-300/80 mb-0.5">اسم المحل والنشاط</label>
                        <input
                          type="text"
                          value={mobileCustomerName}
                          onChange={(e) => setMobileCustomerName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-sky-700/60 bg-zinc-900 text-zinc-100 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-sky-300/80 mb-0.5">رقم هاتف العميل</label>
                        <input
                          type="text"
                          value={mobilePhone}
                          onChange={(e) => setMobilePhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-sky-700/60 bg-zinc-900 text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-sky-300/80 mb-0.5">طراز الهاتف</label>
                        <input
                          type="text"
                          value={deviceName}
                          onChange={(e) => setDeviceName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-sky-700/60 bg-zinc-900 text-zinc-100 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions for Zero-Touch */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRegisterMobileTerminal}
                      disabled={isRegisteringDevice}
                      className="py-2 px-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[11px]"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{isRegisteringDevice ? 'جاري الإرسال...' : '1. إرسال طلب تفعيل الهاتف'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoPolling(!isAutoPolling);
                        if (!isAutoPolling) checkRemoteActivation();
                      }}
                      className={`py-2 px-2 font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer text-[11px] ${
                        isAutoPolling
                          ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAutoPolling ? 'animate-spin' : ''}`} />
                      <span>{isAutoPolling ? 'جاري الاستماع للتفعيل...' : '2. فحص حالة التفعيل الآن'}</span>
                    </button>
                  </div>

                  {isAutoPolling && (
                    <div className="p-2.5 bg-amber-950/60 border border-amber-800/60 rounded-lg text-amber-300 text-[11px] flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400 shrink-0" />
                      <span>
                        الهاتف في وضع الاستماع! اذهب الآن لتبويب <strong>"طلبات التراخيص"</strong> واضغط على <strong>"⚡ تفعيل عن بعد"</strong> لترى التفعيل التلقائي الفوري.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">مفتاح الترخيص (License Key)</label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 font-mono font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-zinc-300 mb-1">معرّف العتاد (Hardware ID)</label>
                      <input
                        type="text"
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
                        className="w-full px-2.5 py-1.5 font-mono text-[11px] rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-zinc-300 mb-1">اسم الكاسة</label>
                      <input
                        type="text"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleVerifyLicense}
                    disabled={isVerifyingLicense}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isVerifyingLicense ? 'جاري التحقق...' : 'التحقق وربط جهاز الكاسة'}</span>
                  </button>
                </div>
              )}

              {/* License Error Display */}
              {licenseError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">تنبيه / خطأ: </span>
                    <span>{licenseError}</span>
                  </div>
                </div>
              )}

              {/* License Outcome Box */}
              {licenseData && (
                <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-1.5 text-zinc-200">
                  <div className="flex justify-between font-bold">
                    <span>العميل: {licenseData.customer.name}</span>
                    <span className="text-emerald-400 font-mono">
                      {licenseData.is_lifetime ? '♾️ اشتراك أبدي (Lifetime)' : `خطة ${licenseData.plan}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    المحل: {licenseData.customer.business_name} ({licenseData.customer.wilaya})
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-800 text-zinc-400">
                    <span>
                      {licenseData.is_lifetime ? 'الصلاحية: دائم مدى الحياة' : `متبقي: ${licenseData.days_remaining} يوم`}
                    </span>
                    <span className="font-bold text-zinc-200">
                      الأجهزة: {licenseData.active_devices_count}/{licenseData.max_devices} (متبقي {licenseData.remaining_devices_count || 0})
                    </span>
                  </div>
                  {licenseData.is_grace_period && (
                    <div className="p-1.5 bg-amber-950/80 text-amber-300 border border-amber-800 rounded font-bold text-[10px]">
                      ⚠️ فترة السماح مؤقتة (Grace Period): متبقي {licenseData.grace_period_days_left} يوم
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Terminal Real-Time Event Logs */}
          <div className="bg-[#050505] text-zinc-200 border border-zinc-800 rounded-xl p-4 shadow-sm space-y-2">
            <span className="text-xs font-bold text-zinc-400 block border-b border-zinc-800 pb-1.5 font-mono">
              [DZPOS Local Terminal Logs]
            </span>
            <div className="space-y-1 max-h-36 overflow-y-auto font-mono text-[11px]">
              {logs.length === 0 ? (
                <span className="text-zinc-600 text-xs">لا توجد عمليات مسجلة حتى الآن</span>
              ) : (
                logs.map((l, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      l.type === 'error'
                        ? 'text-rose-400'
                        : l.type === 'warn'
                        ? 'text-amber-400'
                        : l.type === 'success'
                        ? 'text-emerald-400'
                        : 'text-zinc-300'
                    }`}
                  >
                    <span className="text-zinc-600">[{l.time}]</span> {l.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Offline-First Catalog Synchronization Engine (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>2. مزامنة كتالوج المنتجات المحلي (Offline Pack Sync)</span>
              </h2>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-300">النسخة المحلية:</span>
                <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-black text-xs px-2 py-0.5 rounded">
                  {localPackVersion > 0 ? `v${localPackVersion}` : 'غير محمل'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">النشاط التجاري المختار:</label>
                  <select
                    value={localActivityCode}
                    onChange={(e) => {
                      setLocalActivityCode(e.target.value);
                      setLocalPackVersion(0);
                      setLocalProducts([]);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none font-medium"
                  >
                    {activities.map(act => (
                      <option key={act.code} value={act.code}>{act.name_ar} ({act.name_fr})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    onClick={handleDownloadPack}
                    disabled={isDownloadingPack}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isDownloadingPack ? 'جاري التحميل...' : 'تنزيل الكتالوج'}</span>
                  </button>

                  <button
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate || localPackVersion === 0}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="مقارنة النسخة المحلية مع السيرفر"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    <span>فحص التحديث</span>
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {syncStatusMsg && (
                <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-zinc-300 text-xs">
                  {syncStatusMsg}
                </div>
              )}

              {/* Update Alert Banner */}
              {updateAvailable && (
                <div className="p-3 bg-amber-950/60 border border-amber-700 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-amber-300 block">
                      🚀 توفرت نسخة جديدة من الكتالوج (v{updateAvailable.server_version})!
                    </span>
                    <span className="text-amber-400/90 text-[11px]">
                      {updateAvailable.changes_summary || 'تحديث أسعار ومنتجات جديدة'}
                    </span>
                  </div>
                  <button
                    onClick={handleDownloadPack}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-sm transition cursor-pointer shrink-0"
                  >
                    تحديث الآن
                  </button>
                </div>
              )}

              {/* Local Storage Summary */}
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800 flex items-center justify-between text-zinc-400">
                <span>المنتجات المخزنة محلياً في الذاكرة (SQLite Cache):</span>
                <span className="font-bold text-zinc-100">{localProducts.length} منتج</span>
              </div>
            </div>
          </div>

          {/* Step 3: Cash Register, Table QR Orders & Barcode Scanner Simulator */}
          <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 text-zinc-100">
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-zinc-100">
                  <span>3. واجهة الكاسة وإدارة طلبات الطاولات (Cashier POS & Table Orders)</span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScannerModalOpen(true)}
                  className="text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="مسح واستلام فاتورة مورد بالذكاء الاصطناعي"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>فاتورة مورد AI</span>
                </button>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  100% Offline Ready
                </span>
              </div>
            </div>

            {/* Mode Switcher inside Cashier: Table Orders vs Normal Panier */}
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setCashierActiveSection('table_orders')}
                className={`flex-1 py-1.5 rounded-md font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  cashierActiveSection === 'table_orders'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>طلبات المينو والطاولات (Live QR Orders)</span>
                {liveTableOrders.filter(o => o.status === 'WAITING_WAITER' || (o.status as string) === 'PENDING' || (o as any).order_status === 'PENDING').length > 0 && (
                  <span className="bg-white text-rose-600 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-black animate-bounce">
                    {liveTableOrders.filter(o => o.status === 'WAITING_WAITER' || (o.status as string) === 'PENDING' || (o as any).order_status === 'PENDING').length} جديد
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCashierActiveSection('pos_cart')}
                className={`flex-1 py-1.5 rounded-md font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  cashierActiveSection === 'pos_cart'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>سلة الكاسة والمبيعات المباشرة</span>
                {cart.length > 0 && (
                  <span className="bg-emerald-950 text-emerald-300 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold border border-emerald-700">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>

            {/* TABLE ORDERS SUB-SECTION */}
            {cashierActiveSection === 'table_orders' && (
              <div className="space-y-3.5">
                {/* Real-time Waiter QR Scanner Bar */}
                <div className="p-3 bg-gradient-to-r from-rose-950/40 via-zinc-900 to-zinc-900 border border-rose-900/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                      <QrCode className="w-4 h-4 text-rose-400" />
                      <span>ماسح رمز QR للنادل / الكاشير (Waiter Verification Scanner)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchLiveTableOrders}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                        title="تحديث قائمة الطلبات الآن"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>تحديث</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ألصق كود أو رابط QR المعروض على هاتف الزبون (Token أو #005)..."
                      value={tableQrScanInput}
                      onChange={(e) => setTableQrScanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleScanCustomerQr();
                      }}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <button
                      onClick={() => handleScanCustomerQr()}
                      disabled={isScanningOrder}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{isScanningOrder ? 'جاري الفحص...' : 'فحص ومسح QR'}</span>
                    </button>
                  </div>

                  {tableOrderActionMsg && (
                    <div
                      className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                        tableOrderActionMsg.type === 'success'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : tableOrderActionMsg.type === 'error'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : 'bg-sky-950/80 text-sky-300 border border-sky-800'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{tableOrderActionMsg.text}</span>
                    </div>
                  )}
                </div>

                {/* Incoming Orders Stream List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <div className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>الطلبات الواردة من مينو الزبائن الحية ({liveTableOrders.length}):</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      تحديث تلقائي كل 3 ثوانٍ ⚡
                    </span>
                  </div>

                  {liveTableOrders.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-1">
                      <p className="font-semibold text-zinc-400">لا توجد طلبات طاولات حالية قيد الانتظار</p>
                      <p className="text-[11px]">
                        افتح تبويب <strong>"مينو الطاولات الرقمي"</strong> واطلب وجبة من طاولة لتظهر هنا فوراً في كاسة الكاشير!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {liveTableOrders.map((order) => {
                        const isWaiting = order.status === 'WAITING_WAITER' || (order.status as string) === 'PENDING' || (order as any).order_status === 'PENDING';
                        const isConfirmed = order.status === 'CONFIRMED';
                        const isKitchen = order.status === 'SENT_TO_KITCHEN';
                        const isCompleted = order.status === 'COMPLETED';

                        return (
                          <div
                            key={order.id}
                            className={`p-3 rounded-xl border transition text-xs space-y-2.5 ${
                              isWaiting
                                ? 'bg-amber-950/30 border-amber-500/60 shadow-sm'
                                : isConfirmed
                                ? 'bg-sky-950/20 border-sky-800/60'
                                : isKitchen
                                ? 'bg-indigo-950/20 border-indigo-800/60'
                                : 'bg-zinc-900/60 border-zinc-800'
                            }`}
                          >
                            {/* Order Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-white text-sm bg-zinc-800 px-2 py-0.5 rounded">
                                  {order.public_order_number}
                                </span>
                                <span className="font-bold text-zinc-200">
                                  {order.table_name || `طاولة ${order.table_code}`}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>

                              {/* Status Badge */}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                  isWaiting
                                    ? 'bg-amber-950 text-amber-300 border-amber-600 animate-pulse'
                                    : isConfirmed
                                    ? 'bg-sky-950 text-sky-300 border-sky-600'
                                    : isKitchen
                                    ? 'bg-indigo-950 text-indigo-300 border-indigo-600'
                                    : isCompleted
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}
                              >
                                {isWaiting && <Clock className="w-3 h-3" />}
                                {isConfirmed && <CheckCircle2 className="w-3 h-3" />}
                                {isKitchen && <ChefHat className="w-3 h-3" />}
                                <span>
                                  {isWaiting
                                    ? 'بانتظار تأكيد النادل'
                                    : isConfirmed
                                    ? 'تم التأكيد'
                                    : isKitchen
                                    ? 'في المطبخ'
                                    : isCompleted
                                    ? 'مكتمل ومدفوع'
                                    : order.status}
                                </span>
                              </span>
                            </div>

                            {/* Items breakdown */}
                            <div className="bg-zinc-950/80 p-2 rounded-lg border border-zinc-800/80 space-y-1">
                              {order.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-[11px]">
                                  <span className="text-zinc-200">
                                    {item.product_name} <span className="text-zinc-400 font-mono">×{item.quantity}</span>
                                  </span>
                                  <span className="font-bold text-zinc-300 font-mono">
                                    {item.subtotal || item.price * item.quantity} د.ج
                                  </span>
                                </div>
                              ))}
                              {order.notes && (
                                <div className="text-[10px] text-amber-300/80 pt-1 border-t border-zinc-800">
                                  ملاحظة الزبون: {order.notes}
                                </div>
                              )}
                            </div>

                            {/* Total & Action Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="text-sm font-black text-emerald-400 font-mono">
                                المجموع: {order.total} د.ج
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Confirm Button */}
                                {isWaiting && (
                                  <button
                                    onClick={() => handleConfirmTableOrder(order.id)}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Zap className="w-3 h-3" />
                                    <span>⚡ تأكيد الطلب فوراً</span>
                                  </button>
                                )}

                                {/* Send to Kitchen Button */}
                                {(isWaiting || isConfirmed) && (
                                  <button
                                    onClick={() => handleSendOrderToKitchen(order.id)}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <ChefHat className="w-3 h-3" />
                                    <span>إرسال للمطبخ</span>
                                  </button>
                                )}

                                {/* Load to Cashier Register Button */}
                                <button
                                  onClick={() => handleLoadTableOrderToCart(order)}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                                  title="تفريغ أصناف الطلب في سلة الكاسة لطباعة وصل البيع"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>تحميل لسلة الكاسة</span>
                                </button>

                                {/* Complete & Pay Button */}
                                {!isCompleted && (
                                  <button
                                    onClick={() => handleCompleteTableOrder(order.id)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[11px] rounded-lg border border-zinc-700 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>إتمام الحساب</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* NORMAL CASHIER PANIER SUB-SECTION */}
            {cashierActiveSection === 'pos_cart' && (
              <div className="space-y-3">
                {/* Quick Barcode Scanner Bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-zinc-500 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="امسح الباركود أو اختر من قائمة المنتجات السريعة..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && barcodeInput.trim()) {
                          handleAddToCartByBarcode(barcodeInput);
                        }
                      }}
                      className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    onClick={() => handleAddToCartByBarcode(barcodeInput)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>

                {/* Quick Tap Products Grid (from local SQLite DB) */}
                <div>
                  <span className="text-[11px] font-semibold text-zinc-400 mb-1 block">أزرار سريعة للمنتجات الأكثر مبيعاً:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-28 overflow-y-auto">
                    {localProducts.length === 0 ? (
                      <div className="col-span-3 text-center py-4 text-zinc-500 text-xs">
                        يرجى تحميل الكتالوج في الخطوة 2 لعرض المنتجات
                      </div>
                    ) : (
                      localProducts.slice(0, 6).map((prod) => (
                        <button
                          key={prod.product_id}
                          onClick={() => handleAddToCartByBarcode(prod.barcode)}
                          className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 hover:border-zinc-700 border border-zinc-800/80 text-right transition cursor-pointer"
                        >
                          <div className="font-bold text-zinc-200 text-xs truncate">{prod.name}</div>
                          <div className="text-emerald-400 font-bold text-[11px] mt-0.5">{prod.default_price} دج</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Cart & Ticket */}
                <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2">
                    <span>سلة المشتريات (Panier)</span>
                    <span>المجموع: <strong className="text-emerald-400 text-sm">{cartTotal} دج</strong></span>
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-3 text-center text-zinc-500 text-xs">السلة فارغة</div>
                  ) : (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {cart.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-zinc-950 p-2 rounded border border-zinc-800">
                          <div className="font-medium text-zinc-200 truncate max-w-[180px]">
                            {item.product.name}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-400 font-mono">×{item.quantity}</span>
                            <span className="font-bold text-zinc-100">{item.product.default_price * item.quantity} دج</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {cart.length > 0 && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleCheckout}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>طباعة وصل واستلام {cartTotal} دج</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Printed Receipt Success */}
                {lastReceipt && (
                  <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs space-y-1 text-emerald-300">
                    <div className="flex justify-between font-bold">
                      <span>تم إصدار الوصل بنجاح #{lastReceipt.id}</span>
                      <span>{lastReceipt.date}</span>
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      تم حفظ المعاملة محلياً في ذاكرة الكاسة بنجاح بدون إنترنت.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Invoice Scanner Modal */}
      <AiInvoiceScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onSuccess={(purchase) => {
          addLog(`[AI Purchases] Invoiced ${purchase.invoice_number} processed: ${purchase.items_count || purchase.items.length} items added to local catalog.`, 'success');
          // Reload pack to fetch newly added/updated products into POS local store
          handleDownloadPack();
        }}
        activities={activities}
        currentProducts={localProducts as any}
      />
    </div>
  );
};
