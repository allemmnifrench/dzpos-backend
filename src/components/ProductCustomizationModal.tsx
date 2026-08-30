import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  SlidersHorizontal,
  ShoppingCart,
  Check,
  Edit3,
  Maximize2,
  Utensils
} from 'lucide-react';
import {
  PublishedMenuProduct,
  ProductCustomizationSize,
  ProductCustomizationAddon,
  ProductCustomizationOption
} from '../types/dzpos.js';
import {
  getProductCustomizations,
  calculateCustomizedUnitPrice,
  formatCustomizationSummary
} from '../utils/productCustomizations.js';
import {
  resolveDishImageWithFallback,
  getMatchedFoodImageUrl
} from '../utils/foodImageMatcher.js';

export interface CartCustomizedItem {
  id: string; // unique item instance id
  cartItemId?: string; // alias
  product: PublishedMenuProduct;
  quantity: number;
  selectedSize?: ProductCustomizationSize;
  selectedAddons: ProductCustomizationAddon[];
  selectedOptions: string[];
  notes?: string;
  unitPrice: number;
  totalPrice?: number;
  customizationSummary?: string;
}

export interface ProductCustomizationModalProps {
  product: PublishedMenuProduct;
  existingItem?: CartCustomizedItem;
  initialQuantity?: number;
  initialSize?: ProductCustomizationSize;
  initialAddons?: ProductCustomizationAddon[];
  initialOptions?: string[];
  initialNotes?: string;
  currencySymbol?: string;
  isOpen?: boolean;
  onAddToCart?: (item: CartCustomizedItem) => void;
  onSave?: (item: CartCustomizedItem) => void;
  onClose: () => void;
  formatPrice?: (price: number) => string;
}

export function ProductCustomizationModal({
  product,
  existingItem,
  initialQuantity = 1,
  initialSize,
  initialAddons = [],
  initialOptions = [],
  initialNotes = '',
  currencySymbol = 'د.ج',
  isOpen = true,
  onAddToCart,
  onSave,
  onClose,
  formatPrice
}: ProductCustomizationModalProps) {
  if (!isOpen) return null;

  const { sizes, addons, specialOptions } = useMemo(
    () => getProductCustomizations(product),
    [product]
  );

  const [quantity, setQuantity] = useState<number>(() => {
    return existingItem ? existingItem.quantity : initialQuantity;
  });

  const [selectedSize, setSelectedSize] = useState<ProductCustomizationSize | undefined>(() => {
    if (existingItem?.selectedSize) return existingItem.selectedSize;
    if (initialSize) return initialSize;
    return sizes.find(s => s.is_default) || sizes[0] || undefined;
  });

  const [selectedAddons, setSelectedAddons] = useState<ProductCustomizationAddon[]>(() => {
    return existingItem ? existingItem.selectedAddons : initialAddons;
  });

  const [selectedOptions, setSelectedOptions] = useState<string[]>(() => {
    return existingItem ? existingItem.selectedOptions : initialOptions;
  });

  const [notes, setNotes] = useState<string>(() => {
    return existingItem?.notes || initialNotes;
  });

  const [imageError, setImageError] = useState(false);

  // Compute live unit price and total price
  const unitPrice = useMemo(() => {
    return calculateCustomizedUnitPrice(product.price, selectedSize, selectedAddons);
  }, [product.price, selectedSize, selectedAddons]);

  const totalPrice = useMemo(() => {
    return unitPrice * quantity;
  }, [unitPrice, quantity]);

  // Toggle Addon selection
  const handleToggleAddon = (addon: ProductCustomizationAddon) => {
    setSelectedAddons(prev => {
      const exists = prev.some(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  // Toggle Special Option selection
  const handleToggleOption = (optionName: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionName)) {
        return prev.filter(o => o !== optionName);
      }
      return [...prev, optionName];
    });
  };

  // Handle Add / Save to Cart
  const handleConfirm = () => {
    const summary = formatCustomizationSummary(selectedSize, selectedAddons, selectedOptions, notes);
    const itemId = existingItem?.cartItemId || existingItem?.id || `cart_${product.product_id || product.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const customizedItem: CartCustomizedItem = {
      id: itemId,
      cartItemId: itemId,
      product,
      quantity,
      selectedSize,
      selectedAddons,
      selectedOptions,
      notes: notes.trim() || undefined,
      unitPrice,
      totalPrice,
      customizationSummary: summary
    };

    if (onSave) {
      onSave(customizedItem);
    } else if (onAddToCart) {
      onAddToCart(customizedItem);
    }
    onClose();
  };

  const displayName = product.name_ar || product.name;
  const imageSrc = !imageError && product.image_url
    ? product.image_url
    : getMatchedFoodImageUrl(displayName, product.category_id);

  const renderPrice = (p: number) => {
    if (formatPrice) return formatPrice(p);
    return `${p.toLocaleString('fr-DZ')} ${currencySymbol}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div
        className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-white animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header matching DZPOS theme */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer border border-zinc-700/60"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center justify-center gap-1.5 text-white">
              <span>تخصيص المنتج</span>
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              اختر الحجم والإضافات
            </p>
          </div>

          <div className="w-9 h-9 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/60 flex items-center justify-center shadow-inner">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 bg-zinc-950">
          {/* 1. Top Product Card preview with Quantity Stepper */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3.5 shadow-sm">
            {/* Dish Photo */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0 shadow-inner flex items-center justify-center">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Utensils className="w-8 h-8 text-zinc-500" />
              )}
            </div>

            {/* Title & Dynamic Base Price */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                {displayName}
              </h3>
              <div className="mt-1.5">
                <span className="inline-block bg-rose-950/60 text-rose-300 border border-rose-800/80 text-sm font-black px-3 py-1 rounded-xl font-mono shadow-sm">
                  {renderPrice(unitPrice)}
                </span>
              </div>
            </div>

            {/* Quantity Stepper: [ +  1  - ] */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-black transition cursor-pointer active:scale-95 shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>

              <span className="w-7 text-center font-black text-base font-mono text-white">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:hover:bg-zinc-800 flex items-center justify-center font-black transition cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Section: الحجم (Sizes) */}
          {sizes.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-sm font-black text-white">الحجم</h4>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-rose-500/20 text-rose-400 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-rose-500/40">
                    إجباري
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">اختر واحد</span>
                </div>
              </div>

              {/* Sizes Selection Cards Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {sizes.map(size => {
                  const isSelected = selectedSize?.id === size.id;
                  const sizePrice = typeof size.price === 'number'
                    ? size.price
                    : product.price + (size.price_delta || 0);

                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30 scale-[1.02]'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-black">
                        {size.name_ar || size.name}
                      </span>
                      <span className={`text-[11px] font-bold font-mono ${isSelected ? 'text-rose-100' : 'text-zinc-400'}`}>
                        {renderPrice(sizePrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Section: الإضافات (Add-ons / Extras) */}
          {addons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-sm font-black text-white">الإضافات</h4>
                </div>

                <span className="text-xs text-zinc-400 font-medium">اختيار متعدد</span>
              </div>

              {/* Add-ons Cards Grid matching website theme */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {addons.map(addon => {
                  const isSelected = selectedAddons.some(a => a.id === addon.id);

                  return (
                    <div
                      key={addon.id}
                      onClick={() => handleToggleAddon(addon)}
                      className={`p-3 rounded-2xl border transition flex flex-col justify-between gap-2 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500 text-white shadow-md ring-1 ring-rose-500/50'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base shrink-0">{addon.emoji || '✨'}</span>
                          <span className="text-xs font-bold truncate">
                            {addon.name_ar || addon.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                        {/* Radio/Checkbox Indicator Circle */}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition shrink-0 ${
                            isSelected
                              ? 'bg-rose-600 border-rose-500 text-white'
                              : 'border-zinc-700 bg-zinc-950'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>

                        <span className="text-[11px] font-black font-mono text-zinc-300">
                          {addon.price > 0 ? `+${renderPrice(addon.price)}` : 'مجاني'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Section: خيارات خاصة (Special Options / Preferences) */}
          {specialOptions.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 flex items-center justify-center">
                    <Utensils className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-sm font-black text-white">خيارات خاصة</h4>
                </div>

                <span className="text-xs text-zinc-400 font-medium">اختيار متعدد</span>
              </div>

              {/* Special Options Chips / Pills */}
              <div className="flex flex-wrap gap-2">
                {specialOptions.map(opt => {
                  const isSelected = selectedOptions.includes(opt.name_ar || opt.name);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleOption(opt.name_ar || opt.name)}
                      className={`px-3.5 py-2 rounded-2xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30 scale-[1.02]'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      {opt.emoji && <span className="text-sm">{opt.emoji}</span>}
                      <span>{opt.name_ar || opt.name}</span>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Section: ملاحظة للطلب (Order Notes) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400 flex items-center justify-center">
                <Edit3 className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-sm font-black text-white">ملاحظة للطلب</h4>
            </div>

            <div className="relative">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثلاً: بدون بصل، صوص زيادة..."
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl py-3 pr-4 pl-10 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition shadow-inner"
              />
              <Edit3 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Modal Bottom Sticky Actions & Total Bar */}
        <div className="p-4 sm:p-5 bg-zinc-950 border-t border-zinc-800 space-y-3 shrink-0 shadow-2xl">
          {/* Dynamic Total calculation card */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
            <span className="text-sm font-bold text-zinc-400">
              الإجمالي
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono text-rose-400 tracking-tight">
                {renderPrice(totalPrice)}
              </span>
            </div>
          </div>

          {/* Action buttons: أضف إلى السلة & إلغاء */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold rounded-2xl text-sm border border-zinc-800 transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-sm shadow-xl shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>أضف إلى السلة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCustomizationModal;
