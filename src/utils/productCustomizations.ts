import {
  PublishedMenuProduct,
  ProductCustomizationSize,
  ProductCustomizationAddon,
  ProductCustomizationOption
} from '../types/dzpos.js';

export interface ProductCustomizationResult {
  sizes: ProductCustomizationSize[];
  addons: ProductCustomizationAddon[];
  specialOptions: ProductCustomizationOption[];
}

/**
 * Returns customization options (sizes, add-ons, special options) for any dish.
 * If the product object already has explicit sizes/addons/special_options, they are returned.
 * Otherwise, smart defaults are inferred based on the dish name and category to match DZPOS standard menus.
 */
export function getProductCustomizations(product: PublishedMenuProduct): ProductCustomizationResult {
  const basePrice = Number(product.price) || 0;
  const name = (product.name_ar || product.name || '').toLowerCase();
  const cat = (product.category_id || product.category_name || '').toLowerCase();

  // 1. Check if product already has explicit sizes/addons/special_options
  if (
    (product.sizes && product.sizes.length > 0) ||
    (product.addons && product.addons.length > 0) ||
    (product.special_options && product.special_options.length > 0)
  ) {
    const sizes = product.sizes && product.sizes.length > 0 ? product.sizes : getDefaultSizes(basePrice, name);
    const addons = product.addons && product.addons.length > 0 ? product.addons : getDefaultAddons(name, cat);
    const specialOptions = product.special_options && product.special_options.length > 0 ? product.special_options : getDefaultSpecialOptions(name, cat);
    return { sizes, addons, specialOptions };
  }

  // 2. Generate smart defaults based on dish type
  const sizes = getDefaultSizes(basePrice, name);
  const addons = getDefaultAddons(name, cat);
  const specialOptions = getDefaultSpecialOptions(name, cat);

  return { sizes, addons, specialOptions };
}

function getDefaultSizes(basePrice: number, name: string): ProductCustomizationSize[] {
  if (name.includes('بيتزا') || name.includes('pizza')) {
    return [
      { id: 'size_small', name: 'صغير', name_ar: 'صغير', name_fr: 'Junior', price: basePrice, price_delta: 0, is_default: true },
      { id: 'size_medium', name: 'متوسط', name_ar: 'متوسط', name_fr: 'Moyenne', price: basePrice + 150, price_delta: 150 },
      { id: 'size_large', name: 'كبير', name_ar: 'كبير', name_fr: 'Familiale', price: basePrice + 300, price_delta: 300 }
    ];
  }

  if (name.includes('برغر') || name.includes('burger') || name.includes('طاكوس') || name.includes('tacos') || name.includes('ساندويتش') || name.includes('sandwich')) {
    return [
      { id: 'size_small', name: 'صغير', name_ar: 'صغير', name_fr: 'Simple', price: basePrice, price_delta: 0, is_default: true },
      { id: 'size_medium', name: 'متوسط', name_ar: 'متوسط', name_fr: 'Double', price: basePrice + 150, price_delta: 150 },
      { id: 'size_large', name: 'كبير', name_ar: 'كبير', name_fr: 'XXL Mega', price: basePrice + 250, price_delta: 250 }
    ];
  }

  if (name.includes('عصير') || name.includes('jus') || name.includes('مشروب') || name.includes('boisson')) {
    return [
      { id: 'size_small', name: 'صغير', name_ar: 'صغير (33cl)', name_fr: 'Normal', price: basePrice, price_delta: 0, is_default: true },
      { id: 'size_large', name: 'كبير', name_ar: 'كبير (50cl)', name_fr: 'Grand', price: basePrice + 50, price_delta: 50 }
    ];
  }

  // Standard sizes matching screenshot: صغير (500 د.ج), متوسط (550 د.ج), كبير (600 د.ج)
  const deltaMed = basePrice >= 500 ? 50 : 30;
  const deltaLg = basePrice >= 500 ? 100 : 60;
  return [
    { id: 'size_small', name: 'صغير', name_ar: 'صغير', name_fr: 'Petit', price: basePrice, price_delta: 0, is_default: true },
    { id: 'size_medium', name: 'متوسط', name_ar: 'متوسط', name_fr: 'Moyen', price: basePrice + deltaMed, price_delta: deltaMed },
    { id: 'size_large', name: 'كبير', name_ar: 'كبير', name_fr: 'Grand', price: basePrice + deltaLg, price_delta: deltaLg }
  ];
}

function getDefaultAddons(name: string, cat: string): ProductCustomizationAddon[] {
  if (name.includes('عصير') || name.includes('jus') || name.includes('مشروب') || cat.includes('مشروب')) {
    return [
      { id: 'add_lemon', name: 'شريحة ليمون', name_ar: '+ شريحة ليمون', name_fr: '+ Citron', price: 20, emoji: '🍋' },
      { id: 'add_mint', name: 'نعناع طازج', name_ar: '+ نعناع طازج', name_fr: '+ Menthe', price: 20, emoji: '🌿' },
      { id: 'add_honey', name: 'عسل طبيعي', name_ar: '+ عسل طبيعي', name_fr: '+ Miel', price: 50, emoji: '🍯' },
      { id: 'add_ice', name: 'مكعبات ثلج إضافية', name_ar: '+ ثلج إضافي', name_fr: '+ Glaçons', price: 0, emoji: '🧊' }
    ];
  }

  // General Food & Fast Food Addons matching the screenshot
  return [
    { id: 'add_cheese', name: 'جبن إضافي', name_ar: '+ جبن إضافي', name_fr: '+ Fromage extra', price: 50, emoji: '🧀' },
    { id: 'add_mayo', name: 'مايونيز', name_ar: '+ مايونيز', name_fr: '+ Mayonnaise', price: 30, emoji: '🧴' },
    { id: 'add_olives', name: 'زيتون', name_ar: '+ زيتون', name_fr: '+ Olives', price: 40, emoji: '🫒' },
    { id: 'add_algerienne', name: 'صوص جزائري', name_ar: '+ صوص جزائري', name_fr: '+ Sauce Algérienne', price: 30, emoji: '🌶️' },
    { id: 'add_fries', name: 'بطاطا مقلية', name_ar: '+ بطاطا مقلية', name_fr: '+ Frites', price: 100, emoji: '🍟' },
    { id: 'add_egg', name: 'بيض مقلي', name_ar: '+ بيض مقلي', name_fr: '+ Œuf', price: 40, emoji: '🍳' },
    { id: 'add_mushrooms', name: 'فطر مشوي', name_ar: '+ فطر', name_fr: '+ Champignons', price: 60, emoji: '🍄' }
  ];
}

function getDefaultSpecialOptions(name: string, cat: string): ProductCustomizationOption[] {
  if (name.includes('عصير') || name.includes('jus') || name.includes('مشروب') || cat.includes('مشروب')) {
    return [
      { id: 'opt_no_sugar', name: 'بدون سكر', name_ar: 'بدون سكر', emoji: '🚫' },
      { id: 'opt_low_sugar', name: 'سكر قليل', name_ar: 'سكر قليل', emoji: '🥄' },
      { id: 'opt_very_cold', name: 'بارد جداً', name_ar: 'بارد جداً', emoji: '❄️' },
      { id: 'opt_room_temp', name: 'بدون تبريد', name_ar: 'بدون تبريد', emoji: '🌡️' }
    ];
  }

  // Exact matching special options from screenshot: عجينة رقيقة، صوص حار، بدون بصل...
  return [
    { id: 'opt_thin_dough', name: 'عجينة رقيقة', name_ar: 'عجينة رقيقة', emoji: '🥖' },
    { id: 'opt_spicy_sauce', name: 'صوص حار', name_ar: 'صوص حار', emoji: '🌶️' },
    { id: 'opt_no_onion', name: 'بدون بصل', name_ar: 'بدون بصل', emoji: '🧅' },
    { id: 'opt_no_cheese', name: 'بدون جبن', name_ar: 'بدون جبن', emoji: '🧀' },
    { id: 'opt_low_salt', name: 'ملح قليل', name_ar: 'ملح قليل', emoji: '🧂' },
    { id: 'opt_extra_grill', name: 'شواء زيادة', name_ar: 'شواء زيادة', emoji: '🔥' },
    { id: 'opt_herbs', name: 'أعشاب عطرية', name_ar: 'أعشاب عطرية', emoji: '🌿' }
  ];
}

/**
 * Calculates item single unit price based on size and selected add-ons
 */
export function calculateCustomizedUnitPrice(
  baseProductPrice: number,
  selectedSize?: ProductCustomizationSize | null,
  selectedAddons?: ProductCustomizationAddon[]
): number {
  let price = baseProductPrice;
  if (selectedSize) {
    if (typeof selectedSize.price === 'number') {
      price = selectedSize.price;
    } else if (typeof selectedSize.price_delta === 'number') {
      price += selectedSize.price_delta;
    }
  }

  if (Array.isArray(selectedAddons)) {
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    price += addonsTotal;
  }

  return price;
}

/**
 * Formats a clean single-line or multi-line summary of customizations for kitchen tickets and display
 */
export function formatCustomizationSummary(
  selectedSize?: ProductCustomizationSize | null,
  selectedAddons?: ProductCustomizationAddon[],
  selectedOptions?: string[],
  notes?: string
): string {
  const parts: string[] = [];

  if (selectedSize && selectedSize.name_ar) {
    parts.push(`الحجم: ${selectedSize.name_ar}`);
  }

  if (selectedAddons && selectedAddons.length > 0) {
    const addonNames = selectedAddons.map(a => `${a.name_ar || a.name} (+${a.price} د.ج)`).join('، ');
    parts.push(`إضافات: ${addonNames}`);
  }

  if (selectedOptions && selectedOptions.length > 0) {
    parts.push(`خيارات: ${selectedOptions.join('، ')}`);
  }

  if (notes && notes.trim()) {
    parts.push(`ملاحظة: ${notes.trim()}`);
  }

  return parts.join(' | ');
}
