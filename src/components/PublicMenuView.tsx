import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Utensils,
  Search,
  Wifi,
  Clock,
  MapPin,
  Sparkles,
  ShoppingBag,
  Plus,
  Minus,
  X,
  BellRing,
  CheckCircle2,
  Share2,
  Info,
  AlertCircle,
  QrCode as QrCodeIcon,
  RefreshCw,
  Edit3,
  Trash2,
  ChefHat,
  Receipt,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import {
  PublicMenuResponse,
  PublishedMenuProduct,
  TableOrder,
  TableOrderStatus,
  ProductCustomizationSize,
  ProductCustomizationAddon
} from '../types/dzpos.js';
import { ProductCustomizationModal, CartCustomizedItem } from './ProductCustomizationModal.js';
import {
  getMatchedFoodImageUrl,
  resolveDishImageWithFallback,
  DEFAULT_CULINARY_IMAGE,
  getRestaurantCoverImage,
  getRestaurantLogoImage,
  RESTAURANT_INTERIOR_COVERS
} from '../utils/foodImageMatcher.js';

interface PublicMenuViewProps {
  slug?: string;
  tableCode?: string;
  onClosePreview?: () => void;
  isPreview?: boolean;
}

function getDishEmojiAndTheme(name?: string, categoryId?: string) {
  const lower = (name || '').toLowerCase();
  const cat = (categoryId || '').toLowerCase();

  if (lower.includes('أجنحة') || lower.includes('دجاج') || lower.includes('wings') || lower.includes('poulet') || lower.includes('chicken') || lower.includes('طاووق')) {
    return { emoji: '🍗', bg: 'from-amber-950/80 via-zinc-900 to-zinc-950', border: 'border-amber-500/30', text: 'text-amber-400' };
  }
  if (lower.includes('بانيني') || lower.includes('panini') || lower.includes('ساندويتش') || lower.includes('sandwich')) {
    return { emoji: '🥪', bg: 'from-yellow-950/80 via-zinc-900 to-zinc-950', border: 'border-yellow-500/30', text: 'text-yellow-400' };
  }
  if (lower.includes('برغر') || lower.includes('burger')) {
    return { emoji: '🍔', bg: 'from-rose-950/80 via-zinc-900 to-zinc-950', border: 'border-rose-500/30', text: 'text-rose-400' };
  }
  if (lower.includes('تونة') || lower.includes('سمك') || lower.includes('thon') || lower.includes('fish') || lower.includes('poisson')) {
    return { emoji: '🐟', bg: 'from-sky-950/80 via-zinc-900 to-zinc-950', border: 'border-sky-500/30', text: 'text-sky-400' };
  }
  if (lower.includes('جبن') || lower.includes('fromage') || lower.includes('cheese') || cat.includes('ألبان')) {
    return { emoji: '🧀', bg: 'from-amber-950/70 via-zinc-900 to-zinc-950', border: 'border-amber-400/30', text: 'text-amber-300' };
  }
  if (lower.includes('بطاطا') || lower.includes('frites') || lower.includes('fries') || lower.includes('chips')) {
    return { emoji: '🍟', bg: 'from-amber-950/80 via-zinc-900 to-zinc-950', border: 'border-amber-500/30', text: 'text-amber-400' };
  }
  if (lower.includes('بيتزا') || lower.includes('pizza')) {
    return { emoji: '🍕', bg: 'from-red-950/80 via-zinc-900 to-zinc-950', border: 'border-red-500/30', text: 'text-red-400' };
  }
  if (lower.includes('مشاوي') || lower.includes('شواء') || lower.includes('grill') || lower.includes('لحم') || lower.includes('كفتة') || lower.includes('مرقاز') || lower.includes('viande')) {
    return { emoji: '🥩', bg: 'from-rose-950/80 via-zinc-900 to-zinc-950', border: 'border-rose-500/30', text: 'text-rose-400' };
  }
  if (lower.includes('عصير') || lower.includes('jus') || lower.includes('juice') || lower.includes('مشروب') || lower.includes('boisson') || lower.includes('كوكا') || cat.includes('مشروب')) {
    return { emoji: '🍹', bg: 'from-emerald-950/80 via-zinc-900 to-zinc-950', border: 'border-emerald-500/30', text: 'text-emerald-400' };
  }
  if (lower.includes('قهوة') || lower.includes('شاي') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('tea')) {
    return { emoji: '☕', bg: 'from-amber-950/90 via-zinc-900 to-zinc-950', border: 'border-amber-700/30', text: 'text-amber-500' };
  }
  if (lower.includes('حلوى') || lower.includes('كيك') || lower.includes('dessert') || lower.includes('gateau') || lower.includes('cake')) {
    return { emoji: '🍰', bg: 'from-pink-950/80 via-zinc-900 to-zinc-950', border: 'border-pink-500/30', text: 'text-pink-400' };
  }
  if (lower.includes('سلطة') || lower.includes('salade') || lower.includes('salad')) {
    return { emoji: '🥗', bg: 'from-emerald-950/80 via-zinc-900 to-zinc-950', border: 'border-emerald-500/30', text: 'text-emerald-400' };
  }
  return { emoji: '🍽️', bg: 'from-zinc-800 via-zinc-900 to-zinc-950', border: 'border-zinc-700/40', text: 'text-rose-400' };
}

function resolveMenuImageUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  let url = rawUrl.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/storage/') || parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/images/')) {
        return parsed.pathname;
      }
    } catch {}
  }
  if (!url.startsWith('/') && !url.startsWith('data:') && !url.startsWith('http')) {
    return `/storage/products/${encodeURIComponent(url)}`;
  }
  return url;
}

interface DishCardImageProps {
  imageUrl?: string;
  name?: string;
  nameAr?: string;
  categoryId?: string;
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'modal';
  badge?: string;
}

function DishCardImage({
  imageUrl,
  name,
  nameAr,
  categoryId,
  className = 'w-20 h-20 rounded-xl',
  imgClassName = 'w-full h-full object-cover',
  size = 'md',
  badge
}: DishCardImageProps) {
  const [hasPrimaryError, setHasPrimaryError] = useState(false);
  const [hasFallbackError, setHasFallbackError] = useState(false);
  const displayName = nameAr || name || '';
  const theme = getDishEmojiAndTheme(displayName, categoryId);

  // Determine primary URL and intelligent matched internet photo fallback
  const resolvedPrimaryUrl = resolveMenuImageUrl(imageUrl);
  const matchedInternetPhoto = getMatchedFoodImageUrl(displayName, categoryId);

  useEffect(() => {
    setHasPrimaryError(false);
    setHasFallbackError(false);
  }, [imageUrl, displayName]);

  const emojiSize = size === 'modal' ? 'text-5xl sm:text-6xl' : size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl';

  // Determine which image to show
  // 1. Primary if provided and not errored
  // 2. Otherwise matched internet photo from Unsplash if not errored
  // 3. Otherwise beautiful styled emoji fallback
  const showPrimary = resolvedPrimaryUrl && !hasPrimaryError;
  const showFallback = (!resolvedPrimaryUrl || hasPrimaryError) && matchedInternetPhoto && !hasFallbackError;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${theme.bg} border ${theme.border} flex items-center justify-center shrink-0 shadow-inner ${className}`}>
      {showPrimary ? (
        <img
          src={resolvedPrimaryUrl}
          alt={displayName}
          className={`${imgClassName} transition duration-500`}
          referrerPolicy="no-referrer"
          onError={() => setHasPrimaryError(true)}
          loading="lazy"
        />
      ) : showFallback ? (
        <img
          src={matchedInternetPhoto}
          alt={displayName}
          className={`${imgClassName} transition duration-500`}
          referrerPolicy="no-referrer"
          onError={() => setHasFallbackError(true)}
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full p-2 select-none">
          <span className={`${emojiSize} drop-shadow-md`}>
            {theme.emoji}
          </span>
          {size === 'modal' && (
            <span className={`text-xs font-bold mt-2 ${theme.text} bg-zinc-950/80 px-3 py-1 rounded-full border border-zinc-800`}>
              {displayName}
            </span>
          )}
        </div>
      )}

      {badge && (
        <span className="absolute top-1 right-1 bg-amber-500 text-zinc-950 font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
          {badge}
        </span>
      )}
    </div>
  );
}

interface RestaurantHeroHeaderProps {
  restaurant: any;
  table?: any;
  onOpenWifi: () => void;
  onShare: () => void;
}

function RestaurantHeroHeader({
  restaurant,
  table,
  onOpenWifi,
  onShare
}: RestaurantHeroHeaderProps) {
  const seed = restaurant.name_ar || restaurant.name || restaurant.id || 'restaurant-interior';
  const defaultCover = getRestaurantCoverImage(restaurant.cover_url, seed);
  const defaultLogo = getRestaurantLogoImage(restaurant.logo_url, seed);

  const [coverIndex, setCoverIndex] = useState(0);
  const [coverSrc, setCoverSrc] = useState(defaultCover);
  const [logoSrc, setLogoSrc] = useState(defaultLogo);
  const [hasCoverError, setHasCoverError] = useState(false);
  const [hasLogoError, setHasLogoError] = useState(false);

  useEffect(() => {
    setCoverSrc(getRestaurantCoverImage(restaurant.cover_url, seed));
    setLogoSrc(getRestaurantLogoImage(restaurant.logo_url, seed));
    setHasCoverError(false);
    setHasLogoError(false);
  }, [restaurant.cover_url, restaurant.logo_url, seed]);

  const handleCoverError = () => {
    setHasCoverError(true);
    const nextIdx = (coverIndex + 1) % RESTAURANT_INTERIOR_COVERS.length;
    setCoverIndex(nextIdx);
    setCoverSrc(RESTAURANT_INTERIOR_COVERS[nextIdx]);
  };

  const handleLogoError = () => {
    setHasLogoError(true);
    setLogoSrc(RESTAURANT_INTERIOR_COVERS[1]);
  };

  return (
    <div className="relative h-64 sm:h-72 w-full bg-zinc-950 overflow-hidden shadow-2xl">
      {/* Background Restaurant Interior Photography */}
      <img
        src={coverSrc}
        alt={restaurant.name || 'Restaurant Interior'}
        className="w-full h-full object-cover opacity-75 scale-105 transform hover:scale-100 transition duration-1000 ease-out"
        referrerPolicy="no-referrer"
        onError={handleCoverError}
      />

      {/* Multi-layer Dark Gradient for optimal contrast and luxury atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-zinc-950" />

      {/* Top Header Bar: Table status badge + Quick Action Buttons */}
      <div className="absolute top-4 right-4 left-4 flex items-center justify-between z-20">
        {/* Table Number Badge */}
        {table ? (
          <div className="flex items-center gap-2 bg-rose-600/95 backdrop-blur-md text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg border border-rose-400/40">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80" />
            <span>{table.label_ar || `طاولة رقم ${table.table_number}`}</span>
            {table.zone && <span className="text-rose-100 text-[11px]">({table.zone})</span>}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md text-zinc-200 text-xs px-3.5 py-1.5 rounded-full border border-zinc-700/60 font-semibold shadow-md">
            <Utensils className="w-3.5 h-3.5 text-rose-400" />
            <span>مينو المطعم الرقمي</span>
          </div>
        )}

        {/* Action Buttons (Wifi, Share) */}
        <div className="flex items-center gap-2">
          {restaurant.wifi_ssid && (
            <button
              onClick={onOpenWifi}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-zinc-200 hover:text-white hover:bg-black/70 transition shadow-lg cursor-pointer"
              title="معلومات الواي فاي"
            >
              <Wifi className="w-4 h-4 text-emerald-400" />
            </button>
          )}
          <button
            onClick={onShare}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-zinc-200 hover:text-white hover:bg-black/70 transition shadow-lg cursor-pointer"
            title="مشاركة المينو"
          >
            <Share2 className="w-4 h-4 text-zinc-200" />
          </button>
        </div>
      </div>

      {/* Floating Restaurant Identity Card in Header */}
      <div className="absolute bottom-4 right-4 left-4 flex items-center justify-between gap-3.5 z-20">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md truncate">
            {restaurant.name_ar || restaurant.name}
          </h1>
          {restaurant.tagline && (
            <p className="text-xs sm:text-sm text-rose-300 font-medium truncate mt-0.5 drop-shadow">
              {restaurant.tagline}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-300 mt-1.5 font-medium">
            {restaurant.opening_hours && (
              <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/5">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{restaurant.opening_hours}</span>
              </div>
            )}
            {restaurant.city && (
              <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/5">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{restaurant.city}</span>
              </div>
            )}
          </div>
        </div>

        {/* Restaurant Decor / Logo Thumbnail */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900/90 border-2 border-rose-500/40 overflow-hidden shadow-2xl shrink-0 backdrop-blur-sm p-0.5">
          <img
            src={logoSrc}
            alt={restaurant.name}
            className="w-full h-full object-cover rounded-xl"
            referrerPolicy="no-referrer"
            onError={handleLogoError}
          />
        </div>
      </div>
    </div>
  );
}

export function PublicMenuView({
  slug: propSlug,
  tableCode: propTableCode,
  onClosePreview,
  isPreview = false
}: PublicMenuViewProps) {
  // Extract slug and tableCode from URL if not provided via props
  const [slug, setSlug] = useState<string>(() => {
    if (propSlug) return propSlug;
    const path = window.location.pathname;
    const match = path.match(/^\/menu\/([^/]+)/);
    return match ? match[1] : 'el-bahia-resto';
  });

  const [tableCode, setTableCode] = useState<string | undefined>(() => {
    if (propTableCode) return propTableCode;
    const path = window.location.pathname;
    const match = path.match(/\/table\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('table') || undefined;
  });

  const [menuData, setMenuData] = useState<PublicMenuResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active View: 'menu' or 'order_qr'
  const [activeView, setActiveView] = useState<'menu' | 'order_qr'>('menu');

  // Filter & Product modal states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<PublishedMenuProduct | null>(null);
  const [showWifiModal, setShowWifiModal] = useState<boolean>(false);
  const [showWaiterModal, setShowWaiterModal] = useState<boolean>(false);
  const [waiterCalled, setWaiterCalled] = useState<boolean>(false);

  // Cart / Order Tray State
  const [cart, setCart] = useState<CartCustomizedItem[]>([]);
  const [customizingProduct, setCustomizingProduct] = useState<{
    product: PublishedMenuProduct;
    existingItem?: CartCustomizedItem;
  } | null>(null);
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Active Order state (Customer QR Flow)
  const [activeOrder, setActiveOrder] = useState<TableOrder | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [isEditingOrder, setIsEditingOrder] = useState<boolean>(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState<boolean>(false);
  const [confirmationToast, setConfirmationToast] = useState<string | null>(null);

  // Storage key for active order persistence across refresh
  const resolvedTableCode = tableCode || menuData?.table?.table_code || '01';
  const orderStorageKey = `dzpos_active_order_${slug}_${resolvedTableCode}`;

  // 1. Fetch public menu data
  const fetchMenu = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/menu/public/${slug}`;
      if (tableCode) {
        url += `?table=${encodeURIComponent(tableCode)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'المينو غير متوفر حالياً');
      }

      setMenuData(data);
    } catch (err: any) {
      console.error('Error loading menu:', err);
      setError(err.message || 'تعذر تحميل قائمة الطعام');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [slug, tableCode]);

  // 2. Generate Real QR Code Data URL whenever activeOrder changes
  useEffect(() => {
    let isMounted = true;
    if (activeOrder?.secure_token) {
      setIsGeneratingQr(true);
      // We encode the full verification URL or token
      const qrPayload = `${window.location.origin}/api/orders/qr/${encodeURIComponent(activeOrder.secure_token)}`;
      QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 1.5,
        color: {
          dark: '#09090b',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
        .then((url: string) => {
          if (isMounted) {
            setQrDataUrl(url);
            setIsGeneratingQr(false);
          }
        })
        .catch((err: any) => {
          console.error('Error generating QR code:', err);
          if (isMounted) setIsGeneratingQr(false);
        });
    } else {
      setQrDataUrl(null);
    }

    return () => {
      isMounted = false;
    };
  }, [activeOrder?.secure_token, activeOrder?.version]);

  // 3. Restore active order from localStorage on initial load
  useEffect(() => {
    const checkSavedOrder = async () => {
      try {
        const savedToken = localStorage.getItem(orderStorageKey);
        if (!savedToken) return;

        const res = await fetch(`/api/menu/public/orders/${encodeURIComponent(savedToken)}`);
        const data = await res.json();

        if (data.success && data.order) {
          const ord = data.order as TableOrder;
          if (['WAITING_WAITER', 'CONFIRMED', 'SENT_TO_KITCHEN'].includes(ord.status)) {
            setActiveOrder(ord);
            setActiveView('order_qr');
          } else {
            // If completed or cancelled, remove stale order
            localStorage.removeItem(orderStorageKey);
          }
        } else {
          localStorage.removeItem(orderStorageKey);
        }
      } catch (e) {
        console.warn('Failed to restore active order from storage:', e);
      }
    };

    checkSavedOrder();
  }, [orderStorageKey]);

  // 4. Lightweight Polling for Live Order Status Updates
  useEffect(() => {
    if (!activeOrder?.secure_token) return;
    if (['COMPLETED', 'CANCELLED'].includes(activeOrder.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/menu/public/orders/${encodeURIComponent(activeOrder.secure_token)}`);
        const data = await res.json();

        if (data.success && data.order) {
          const updated = data.order as TableOrder;
          
          // Check if status transitioned to CONFIRMED
          if (activeOrder.status === 'WAITING_WAITER' && updated.status === 'CONFIRMED') {
            setConfirmationToast('🎉 تم تأكيد طلبك بنجاح من قبل النادل! تم إرسال الطلب للمطبخ.');
            setTimeout(() => setConfirmationToast(null), 5000);
          } else if (activeOrder.status !== 'SENT_TO_KITCHEN' && updated.status === 'SENT_TO_KITCHEN') {
            setConfirmationToast('👨‍🍳 طلبك قيد التحضير في المطبخ الآن.');
            setTimeout(() => setConfirmationToast(null), 5000);
          }

          setActiveOrder(updated);

          // If order is finished, clean up storage
          if (['COMPLETED', 'CANCELLED'].includes(updated.status)) {
            localStorage.removeItem(orderStorageKey);
          }
        }
      } catch (e) {
        console.debug('Polling error (transient):', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeOrder?.secure_token, activeOrder?.status, orderStorageKey]);

  // Cart operations
  const handleSaveCustomizedItem = (item: CartCustomizedItem) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(ci => ci.cartItemId === item.cartItemId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = item;
        return updated;
      }
      return [...prev, item];
    });
    setCustomizingProduct(null);
    setIsCartOpen(true);
  };

  const updateCartItemQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(ci => ci.cartItemId === cartItemId);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter(ci => ci.cartItemId !== cartItemId);
      }
      return prev.map(ci => ci.cartItemId === cartItemId ? { ...ci, quantity: newQty } : ci);
    });
  };

  const removeCartItem = (cartItemId: string) => {
    setCart(prev => prev.filter(ci => ci.cartItemId !== cartItemId));
  };

  const openProductCustomization = (product: PublishedMenuProduct) => {
    setCustomizingProduct({ product });
  };

  const openEditCartItem = (item: CartCustomizedItem) => {
    setCustomizingProduct({
      product: item.product,
      existingItem: item
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // 5. Submit New Order to Backend
  const handleCreateOrder = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;

    setIsSubmittingOrder(true);
    setOrderError(null);

    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const tCode = tableCode || menuData?.table?.table_code || '01';
      const payload = {
        restaurant_slug: slug,
        table_code: tCode,
        table_number: tCode,
        items: cart.map(item => ({
          product_id: item.product.product_id || item.product.id || '',
          quantity: item.quantity,
          notes: item.notes,
          selected_size: item.selectedSize,
          selected_addons: item.selectedAddons,
          selected_options: item.selectedOptions,
          customization_summary: item.customizationSummary
        })),
        notes: customerNotes.trim() || undefined,
        idempotency_key: idempotencyKey
      };

      const res = await fetch(`/api/menu/public/${slug}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل في تسجيل الطلب. يرجى المحاولة ثانية.');
      }

      const newOrder = data.order as TableOrder;
      setActiveOrder(newOrder);
      localStorage.setItem(orderStorageKey, newOrder.secure_token);

      setIsCartOpen(false);
      setIsEditingOrder(false);
      setActiveView('order_qr');
    } catch (err: any) {
      console.error('Create order error:', err);
      setOrderError(err.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // 6. Start Editing Order
  const handleStartEditOrder = () => {
    if (!activeOrder || activeOrder.status !== 'WAITING_WAITER') {
      alert('لا يمكن تعديل الطلب بعد تأكيده من قبل النادل.');
      return;
    }

    // Reconstruct cart items from activeOrder
    const products = menuData?.snapshot?.products || [];
    const restoredCart: CartCustomizedItem[] = activeOrder.items.map((it, idx) => {
      const prod = products.find(p => p.product_id === it.product_id || p.id === it.product_id) || {
        product_id: it.product_id,
        name: it.product_name,
        name_ar: it.product_name_ar,
        name_fr: it.product_name_fr,
        price: it.price,
        is_available: true,
        category_id: it.category_id || 'default'
      };
      return {
        cartItemId: `cart_item_restored_${Date.now()}_${idx}`,
        product: prod,
        quantity: it.quantity,
        selectedSize: it.selected_size,
        selectedAddons: it.selected_addons || [],
        selectedOptions: it.selected_options || [],
        notes: it.notes || '',
        unitPrice: it.price,
        customizationSummary: it.customization_summary || it.notes
      };
    });

    setCart(restoredCart);
    setCustomerNotes(activeOrder.notes || '');
    setIsEditingOrder(true);
    setIsCartOpen(true);
    setActiveView('menu');
  };

  // 7. Save Edited Order to Backend
  const handleSaveOrderEdits = async () => {
    if (!activeOrder || isSubmittingOrder) return;
    if (cart.length === 0) {
      setOrderError('لا يمكن حفظ طلب فارغ. يرجى اختيار صنف واحد على الأقل أو إلغاء الطلب.');
      return;
    }

    setIsSubmittingOrder(true);
    setOrderError(null);

    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.product.product_id || item.product.id || '',
          quantity: item.quantity,
          notes: item.notes,
          selected_size: item.selectedSize,
          selected_addons: item.selectedAddons,
          selected_options: item.selectedOptions,
          customization_summary: item.customizationSummary
        })),
        notes: customerNotes.trim() || undefined
      };

      const res = await fetch(`/api/menu/public/orders/${encodeURIComponent(activeOrder.secure_token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error_code === 'ORDER_ALREADY_LOCKED') {
          throw new Error('تم تأكيد الطلب للتو من قبل النادل، تم قفل التعديل.');
        }
        throw new Error(data.message || 'فشل في تحديث الطلب');
      }

      setActiveOrder(data.order);
      setIsEditingOrder(false);
      setIsCartOpen(false);
      setActiveView('order_qr');
    } catch (err: any) {
      console.error('Update order error:', err);
      setOrderError(err.message || 'حدث خطأ أثناء تعديل الطلب');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // 8. Cancel Order by Customer
  const handleCancelOrder = async () => {
    if (!activeOrder || isCancellingOrder) return;

    setIsCancellingOrder(true);
    try {
      const res = await fetch(`/api/menu/public/orders/${encodeURIComponent(activeOrder.secure_token)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'إلغاء من قبل الزبون قبل التأكيد' })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'تعذر إلغاء الطلب');
      }

      localStorage.removeItem(orderStorageKey);
      setActiveOrder(null);
      setCart([]);
      setCustomerNotes('');
      setShowCancelConfirmModal(false);
      setActiveView('menu');
    } catch (err: any) {
      alert(err.message || 'فشل في إلغاء الطلب');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Filter products
  const categories = menuData?.snapshot?.categories || [];
  const products = menuData?.snapshot?.products || [];

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategoryId === 'all' || p.category_id === selectedCategoryId;
    const matchesSearch = !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.name_ar && p.name_ar.includes(searchQuery)) ||
      (p.name_fr && p.name_fr.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const featuredProducts = products.filter(p => p.is_featured);

  const formatPrice = (price: number) => {
    return `${price.toLocaleString('fr-DZ')} ${menuData?.restaurant?.currency_symbol || 'د.ج'}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="w-16 h-16 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium">جاري تحميل قائمة الطعام...</p>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">عفواً، المينو غير متاح</h2>
        <p className="text-zinc-400 text-sm max-w-md mb-6">{error || 'لم نتمكن من العثور على المينو المطلوب'}</p>
        <button
          onClick={fetchMenu}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-medium transition cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const { restaurant, table } = menuData;

  // =========================================================================
  // VIEW: DEDICATED ORDER CONFIRMATION & WAITER QR SCREEN
  // =========================================================================
  if (activeView === 'order_qr' && activeOrder) {
    const isWaiting = activeOrder.status === 'WAITING_WAITER';
    const isConfirmed = activeOrder.status === 'CONFIRMED';
    const isKitchen = activeOrder.status === 'SENT_TO_KITCHEN';
    const isCompleted = activeOrder.status === 'COMPLETED';
    const isCancelled = activeOrder.status === 'CANCELLED';

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-12 select-none" dir="rtl">
        {/* Toast Alert for Confirmation */}
        {confirmationToast && (
          <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-emerald-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold leading-snug">{confirmationToast}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 p-4 sticky top-0 z-30 backdrop-blur-md">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button
              onClick={() => setActiveView('menu')}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700/60 transition cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>تصفح المينو</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <h1 className="text-xs font-bold text-white truncate max-w-[140px]">
                {restaurant.name_ar || restaurant.name}
              </h1>
            </div>

            <div className="bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs px-2.5 py-1 rounded-full font-mono font-bold">
              {activeOrder.table_name || `طاولة ${activeOrder.table_code}`}
            </div>
          </div>
        </div>

        {/* Main Content Area (Compact, Mobile-First, QR First) */}
        <main className="max-w-md mx-auto px-4 py-5 space-y-4">
          {/* Status Header Badge */}
          <div className="text-center space-y-1">
            {isWaiting && (
              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>بانتظار تأكيد النادل</span>
              </div>
            )}
            {isConfirmed && (
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>✓ تم تأكيد طلبك</span>
              </div>
            )}
            {isKitchen && (
              <div className="inline-flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/40 text-sky-300 px-3 py-1 rounded-full text-xs font-bold">
                <ChefHat className="w-3.5 h-3.5 text-sky-400" />
                <span>👨‍🍳 طلبك قيد التحضير</span>
              </div>
            )}
            {isCompleted && (
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span>✨ تم إتمام الطلب والدفع</span>
              </div>
            )}
            {isCancelled && (
              <div className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1 rounded-full text-xs font-bold">
                <X className="w-3.5 h-3.5" />
                <span>تم إلغاء الطلب</span>
              </div>
            )}

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight pt-1">
              {isWaiting ? 'طلبك جاهز للتأكيد' : isConfirmed ? 'تم إرسال طلبك للمطبخ' : isKitchen ? 'وجبتك قيد الطهي' : isCompleted ? 'شكراً لزيارتكم' : 'الطلب ملغى'}
            </h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              {isWaiting
                ? 'اطلب من النادل مسح رمز QR من شاشة هاتفك لتأكيد الطلب'
                : isConfirmed
                ? 'قام النادل بتأكيد طلبك وتم إرساله إلى طابعات المطبخ'
                : isKitchen
                ? 'فريق المطبخ يقوم بإعداد طلبكم بعناية'
                : isCompleted
                ? 'نتمنى لكم وجبة شهية وتجربة ممتعة!'
                : 'تم إلغاء هذا الطلب.'}
            </p>
          </div>

          {/* Prominent High-Contrast QR Code Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4 text-center">
            {/* The QR Container */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mx-auto border border-zinc-200 relative">
              {isGeneratingQr || !qrDataUrl ? (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-zinc-800 gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-rose-600" />
                  <span className="text-xs font-mono font-bold">جاري توليد رمز الـ QR...</span>
                </div>
              ) : (
                <img
                  src={qrDataUrl}
                  alt={`QR Order ${activeOrder.public_order_number}`}
                  className="w-56 h-56 mx-auto rounded-lg block"
                />
              )}
            </div>

            {/* Order Identity Row */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800/80">
              <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">رقم الطلب</span>
                <span className="text-xs sm:text-sm font-extrabold text-white font-mono">
                  {activeOrder.public_order_number}
                </span>
              </div>

              <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">رقم الطاولة</span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-400 font-mono truncate block">
                  {activeOrder.table_code}
                </span>
              </div>

              <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">المجموع</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono truncate block">
                  {formatPrice(activeOrder.total)}
                </span>
              </div>
            </div>

            {/* Version and Token Info */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
                الإصدار: v{activeOrder.version}
              </span>
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>رمز مؤمن ومشفر</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {isWaiting && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleStartEditOrder}
                  className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl text-xs transition border border-zinc-700 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>تعديل الطلب</span>
                </button>

                <button
                  onClick={() => setShowCancelConfirmModal(true)}
                  className="py-3 bg-zinc-900 hover:bg-rose-950 text-rose-300 font-semibold rounded-2xl text-xs transition border border-zinc-800 hover:border-rose-900 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>إلغاء الطلب</span>
                </button>
              </div>
            )}

            {!isWaiting && (
              <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl text-center text-xs text-zinc-400 space-y-1">
                <span className="font-semibold text-zinc-300 block">🔒 تم قفل الطلب بعد تأكيد النادل</span>
                <span className="text-[11px] text-zinc-400">
                  إذا أردت طلب أطباق أو مشروبات إضافية يمكنك فتح المينو وإنشاء طلب جديد.
                </span>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem(orderStorageKey);
                      setActiveOrder(null);
                      setCart([]);
                      setActiveView('menu');
                    }}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                  >
                    + إنشاء طلب إضافي جديد
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setActiveView('menu')}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-2xl text-xs font-semibold transition border border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Utensils className="w-3.5 h-3.5 text-rose-400" />
              <span>العودة لتصفح قائمة الطعام</span>
            </button>
          </div>

          {/* Collapsible Order Items Snapshot */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-rose-400" />
                <span>أصناف الطلب ({activeOrder.items_count} قطع)</span>
              </span>
              <span className="text-rose-400 font-mono">{formatPrice(activeOrder.total)}</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pt-1">
              {activeOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  className="text-xs bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/70 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 pl-2">
                      <span className="font-bold text-white block truncate">
                        {item.product_name_ar || item.product_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-zinc-400 text-[11px]">×{item.quantity}</span>
                      <span className="font-mono font-bold text-zinc-200">{formatPrice(item.subtotal)}</span>
                    </div>
                  </div>

                  {/* Customization Details */}
                  {(item.customization_summary || item.notes) && (
                    <div className="bg-zinc-900/90 px-2 py-1 rounded-lg border border-zinc-800 text-[10px] text-amber-300 flex items-start gap-1">
                      <span className="shrink-0">✨</span>
                      <span className="leading-tight">{item.customization_summary || item.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {activeOrder.notes && (
              <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800 text-[11px] text-zinc-300">
                <span className="text-zinc-500 font-bold block mb-0.5">ملاحظات عامة للنادل والمطبخ:</span>
                <p>{activeOrder.notes}</p>
              </div>
            )}
          </div>
        </main>

        {/* Cancel Confirmation Modal */}
        {showCancelConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">هل أنت متأكد من إلغاء الطلب؟</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  سيتم إلغاء الطلب رقم {activeOrder.public_order_number} وحذف رمز التحقق من هاتفك.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="py-2.5 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold"
                >
                  تراجع
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={isCancellingOrder}
                  className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {isCancellingOrder ? 'جاري الإلغاء...' : 'نعم، إلغاء الطلب'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN ONLINE MENU VIEW (Product Catalog & Floating Active Order Banner)
  // =========================================================================
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-32 select-none" dir="rtl">
      {/* Top Preview Bar if viewed within Admin UI */}
      {isPreview && (
        <div className="sticky top-0 z-50 bg-rose-600 text-white text-xs py-2 px-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span className="bg-rose-800 px-2 py-0.5 rounded font-mono">معاينة مباشرة</span>
            <span>هكذا يظهر المينو للزبائن عند مسح رمز QR</span>
          </div>
          {onClosePreview && (
            <button
              onClick={onClosePreview}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded text-xs transition"
            >
              إغلاق المعاينة
            </button>
          )}
        </div>
      )}

      {/* Floating Alert if an active order exists and user is browsing menu */}
      {activeOrder && (
        <div
          onClick={() => setActiveView('order_qr')}
          className="sticky top-0 z-40 bg-amber-600/95 hover:bg-amber-500 text-zinc-950 px-4 py-2.5 shadow-lg flex items-center justify-between cursor-pointer transition"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 animate-ping" />
            <span className="text-xs font-black">
              طلبك {activeOrder.public_order_number} ({activeOrder.status === 'WAITING_WAITER' ? 'بانتظار تأكيد النادل' : 'تم تأكيده'})
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold bg-zinc-950 text-amber-300 px-2.5 py-1 rounded-lg">
            <QrCodeIcon className="w-3.5 h-3.5" />
            <span>عرض رمز الـ QR</span>
          </div>
        </div>
      )}

      {/* Dynamic Restaurant Hero Header with Interior Photography */}
      <RestaurantHeroHeader
        restaurant={restaurant}
        table={table}
        onOpenWifi={() => setShowWifiModal(true)}
        onShare={() => {
          if (navigator.share) {
            navigator.share({
              title: restaurant.name,
              text: restaurant.tagline || 'تصفح قائمة طعامنا الرقمية',
              url: window.location.href
            }).catch(() => {});
          } else {
            navigator.clipboard.writeText(window.location.href);
            alert('تم نسخ رابط المينو إلى الحافظة');
          }
        }}
      />

      {/* Main Content Container */}
      <div className="max-w-3xl mx-auto px-4 mt-4 space-y-5">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن وجبة، مشاوي، بيتزا، برغر، عصير..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl py-3 pr-11 pl-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500 transition shadow-sm"
          />
          <Search className="w-5 h-5 text-zinc-400 absolute right-3.5 top-3.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-3.5 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categories Horizontal Scroll */}
        <div className="overflow-x-auto no-scrollbar py-1 -mx-4 px-4 flex gap-2">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <span>✨ الكل ({products.length})</span>
          </button>

          {categories.map(cat => {
            const count = products.filter(p => p.category_id === cat.category_id).length;
            const isSelected = selectedCategoryId === cat.category_id;
            return (
              <button
                key={cat.category_id}
                onClick={() => setSelectedCategoryId(cat.category_id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span>{cat.name_ar || cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-rose-800 text-rose-100' : 'bg-zinc-800 text-zinc-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Featured Section if 'all' is selected and no search query */}
        {selectedCategoryId === 'all' && !searchQuery && featuredProducts.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">الأكثر طلباً وتوصية الشيف</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {featuredProducts.slice(0, 4).map(prod => (
                <div
                  key={prod.product_id || prod.id}
                  onClick={() => openProductCustomization(prod)}
                  className="bg-zinc-900/80 border border-rose-950/60 hover:border-rose-500/40 rounded-2xl p-3 flex gap-3 cursor-pointer transition group shadow-sm"
                >
                  <DishCardImage
                    imageUrl={prod.image_url}
                    name={prod.name}
                    nameAr={prod.name_ar}
                    categoryId={prod.category_id}
                    className="w-20 h-20 rounded-xl"
                    badge="مميز"
                  />
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-rose-400 transition">
                        {prod.name_ar || prod.name}
                      </h3>
                      {prod.description && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                          {prod.description_ar || prod.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-800/60">
                      <span className="text-xs sm:text-sm font-bold text-rose-400">
                        {formatPrice(prod.price)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openProductCustomization(prod);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>اختيار</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products List Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              {selectedCategoryId === 'all'
                ? 'جميع الأطباق والمشروبات'
                : categories.find(c => c.category_id === selectedCategoryId)?.name_ar || 'قائمة المنتجات'}
            </span>
            <span>{filteredProducts.length} صنف</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-6">
              <Utensils className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-300 text-sm font-semibold">لم نجد أي صنف يطابق بحثك</p>
              <p className="text-zinc-500 text-xs mt-1">جرب البحث بكلمة أخرى أو تغيير القسم</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map(prod => (
                <div
                  key={prod.product_id || prod.id}
                  onClick={() => openProductCustomization(prod)}
                  className="bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-3 flex gap-3 cursor-pointer transition group"
                >
                  <DishCardImage
                    imageUrl={prod.image_url}
                    name={prod.name}
                    nameAr={prod.name_ar}
                    categoryId={prod.category_id}
                    className="w-20 h-20 rounded-xl"
                  />

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-400 transition truncate">
                          {prod.name_ar || prod.name}
                        </h3>
                        {prod.unit && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                            {prod.unit}
                          </span>
                        )}
                      </div>
                      {prod.description && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                          {prod.description_ar || prod.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-800/60">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-rose-400">
                          {formatPrice(prod.price)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openProductCustomization(prod);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>اختيار</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Bar (Cart & Call Waiter) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 p-3 sm:p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Call Waiter Button */}
          <button
            onClick={() => setShowWaiterModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-2xl text-xs font-semibold transition active:scale-95 shrink-0 cursor-pointer"
          >
            <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
            <span className="hidden sm:inline">طلب النادل / الحساب</span>
            <span className="sm:hidden">النادل</span>
          </button>

          {/* Cart Tray Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex-1 flex items-center justify-between px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-600/30 transition active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>{isEditingOrder ? 'تعديل سلة الطلب' : 'سلة طلبات الطاولة'}</span>
              {cartCount > 0 && (
                <span className="bg-white text-rose-600 text-xs px-2 py-0.5 rounded-full font-extrabold">
                  {cartCount}
                </span>
              )}
            </div>
            <span>{cartTotal > 0 ? formatPrice(cartTotal) : 'تصفح الأصناف'}</span>
          </button>
        </div>
      </div>

      {/* Cart / Tray Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-sm">
                  {isEditingOrder ? 'تعديل أصناف الطلب' : 'سلة طلبات الطاولة'}
                </h3>
                {table && (
                  <span className="text-xs bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-full font-mono">
                    {table.label_ar || `طاولة ${table.table_number}`}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {orderError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 space-y-2">
                  <ShoppingBag className="w-12 h-12 mx-auto text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-400">السلة فارغة حالياً</p>
                  <p className="text-xs">اضغط على زر (+) بجانب أي وجبة لإضافتها هنا</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cart.map(item => {
                    const itemTotal = item.unitPrice * item.quantity;
                    return (
                      <div
                        key={item.cartItemId}
                        className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80 space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                              {item.product.name_ar || item.product.name}
                            </h4>
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-xs text-rose-400 font-bold font-mono">
                                {formatPrice(itemTotal)}
                              </span>
                              {item.quantity > 1 && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  ({formatPrice(item.unitPrice)} للقطعة)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Edit customization button */}
                            <button
                              onClick={() => openEditCartItem(item)}
                              title="تعديل الإضافات والخيارات"
                              className="p-1.5 text-zinc-400 hover:text-amber-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete item button */}
                            <button
                              onClick={() => removeCartItem(item.cartItemId)}
                              title="حذف من السلة"
                              className="p-1.5 text-zinc-400 hover:text-rose-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Customization Badges & Add-ons */}
                        {(item.selectedSize || (item.selectedAddons && item.selectedAddons.length > 0) || (item.selectedOptions && item.selectedOptions.length > 0) || item.notes) && (
                          <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-800/60 space-y-1 text-[11px]">
                            {item.selectedSize && (
                              <div className="flex items-center gap-1.5 text-zinc-300">
                                <span className="text-zinc-500 font-medium">الحجم:</span>
                                <span className="font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/50">
                                  {item.selectedSize.name_ar || item.selectedSize.name}
                                  {item.selectedSize.price_delta ? ` (+${item.selectedSize.price_delta} د.ج)` : ''}
                                </span>
                              </div>
                            )}

                            {item.selectedAddons && item.selectedAddons.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center pt-0.5">
                                <span className="text-zinc-500 font-medium">إضافات:</span>
                                {item.selectedAddons.map(add => (
                                  <span
                                    key={add.id}
                                    className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-medium"
                                  >
                                    {add.emoji && <span>{add.emoji}</span>}
                                    <span>{add.name_ar || add.name}</span>
                                    <span className="text-rose-400 font-mono">+{add.price}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center pt-0.5">
                                <span className="text-zinc-500 font-medium">تفضيلات:</span>
                                {item.selectedOptions.map(opt => (
                                  <span
                                    key={opt}
                                    className="bg-zinc-800/90 text-amber-200 px-1.5 py-0.5 rounded text-[10px]"
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.notes && (
                              <p className="text-[10px] text-zinc-400 pt-0.5">
                                <span className="text-zinc-500">ملاحظة:</span> {item.notes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Quantity Stepper */}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40">
                          <button
                            onClick={() => openEditCartItem(item)}
                            className="text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>تغيير الإضافات والحجم</span>
                          </button>

                          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
                            <button
                              onClick={() => updateCartItemQuantity(item.cartItemId, -1)}
                              className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-white font-mono">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartItemQuantity(item.cartItemId, 1)}
                              className="w-7 h-7 rounded-lg bg-rose-600 text-white hover:bg-rose-500 flex items-center justify-center transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Customer Notes */}
                  <div className="pt-2">
                    <label className="text-[11px] text-zinc-400 font-semibold block mb-1">
                      ملاحظات خاصة للطلب (مثال: بدون بصل، صوص حار على جنب...):
                    </label>
                    <textarea
                      rows={2}
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="أضف أي طلبات خاصة هنا..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/70"
                    />
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 bg-zinc-950 border-t border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400 font-medium">المجموع الكلي:</span>
                  <span className="text-lg font-black text-rose-400 font-mono">{formatPrice(cartTotal)}</span>
                </div>

                {isEditingOrder ? (
                  <button
                    onClick={handleSaveOrderEdits}
                    disabled={isSubmittingOrder}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-black rounded-xl text-sm shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingOrder ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ التعديلات...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>حفظ التعديلات وتحديث الرمز (Update QR)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleCreateOrder}
                    disabled={isSubmittingOrder}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingOrder ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري إرسال الطلب...</span>
                      </>
                    ) : (
                      <>
                        <QrCodeIcon className="w-4 h-4" />
                        <span>تأكيد الطلب وتوليد رمز QR للنادل</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
            <div className="relative h-48 sm:h-56 bg-zinc-800">
              <DishCardImage
                imageUrl={selectedProduct.image_url}
                name={selectedProduct.name}
                nameAr={selectedProduct.name_ar}
                categoryId={selectedProduct.category_id}
                className="w-full h-full rounded-none"
                imgClassName="w-full h-full object-cover"
                size="modal"
              />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition cursor-pointer z-10 shadow-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    {selectedProduct.name_ar || selectedProduct.name}
                  </h2>
                  {selectedProduct.name_fr && (
                    <p className="text-xs text-zinc-400 font-sans mt-0.5">{selectedProduct.name_fr}</p>
                  )}
                </div>
                <div className="text-left shrink-0">
                  <span className="text-base sm:text-lg font-extrabold text-rose-400 font-mono">
                    {formatPrice(selectedProduct.price)}
                  </span>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed">
                  {selectedProduct.description_ar || selectedProduct.description}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                {selectedProduct.preparation_time_minutes && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>وقت التحضير المقدر: ~{selectedProduct.preparation_time_minutes} دقيقة</span>
                  </div>
                )}
                {selectedProduct.unit && (
                  <div className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-sky-400" />
                    <span>الوحدة: {selectedProduct.unit}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center gap-3">
              <button
                onClick={() => {
                  const prod = selectedProduct;
                  setSelectedProduct(null);
                  openProductCustomization(prod);
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>تخصيص وإضافة للطلب ({formatPrice(selectedProduct.price)})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Customization / Add-ons Modal */}
      {customizingProduct && (
        <ProductCustomizationModal
          product={customizingProduct.product}
          existingItem={customizingProduct.existingItem}
          isOpen={true}
          onClose={() => setCustomizingProduct(null)}
          onSave={handleSaveCustomizedItem}
          formatPrice={formatPrice}
        />
      )}

      {/* Wi-Fi Credentials Modal */}
      {showWifiModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">شبكة واي فاي المطعم مجاناً</h3>
              <p className="text-xs text-zinc-400 mt-1">اتصل بشبكة المطعم السريعة وتصفح المينو بكل حرية</p>
            </div>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2 text-right">
              <div>
                <span className="text-[11px] text-zinc-500 block">اسم الشبكة (SSID):</span>
                <span className="text-xs font-mono font-bold text-white">{restaurant.wifi_ssid}</span>
              </div>
              {restaurant.wifi_password && (
                <div>
                  <span className="text-[11px] text-zinc-500 block">كلمة المرور (Password):</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{restaurant.wifi_password}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowWifiModal(false)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Call Waiter Modal */}
      {showWaiterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">طلب النادل إلى الطاولة</h3>
              {table ? (
                <p className="text-xs text-rose-400 mt-1 font-semibold">{table.label_ar || `طاولة رقم ${table.table_number}`}</p>
              ) : (
                <p className="text-xs text-zinc-400 mt-1">يرجى من النادل الحضور لخدمتكم</p>
              )}
            </div>

            {waiterCalled ? (
              <div className="bg-emerald-950/60 border border-emerald-800 p-3.5 rounded-2xl text-emerald-300 text-xs space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                <p className="font-bold">تم إرسال الإشعار!</p>
                <p className="text-[11px] text-zinc-400">سيتوجه النادل إلى طاولتكم في لحظات.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => setWaiterCalled(true)}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
                >
                  🔔 استدعاء النادل لأخذ الطلب
                </button>
                <button
                  onClick={() => setWaiterCalled(true)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs transition border border-zinc-700 cursor-pointer"
                >
                  🧾 طلب الحساب / الفاتورة (L'addition)
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowWaiterModal(false);
                setWaiterCalled(false);
              }}
              className="w-full py-2 bg-zinc-950 text-zinc-400 hover:text-white rounded-xl text-xs transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicMenuView;
