import {
  SubscriptionType,
  SubscriptionPricingConfig,
  PriceCalculationResult,
  SubscriptionTierPricing
} from '../../src/types/dzpos.js';
import { db } from '../db.js';

export const DEFAULT_PRICING_CONFIG: SubscriptionPricingConfig = {
  currency: 'DZD',
  currency_symbol: 'د.ج',
  yearly: {
    devices_1: 15000,
    devices_2: 25000,
    devices_3: 33000,
    devices_4: 40000,
    devices_5: 46000,
    per_extra_device: 6000
  },
  lifetime: {
    devices_1: 35000,
    devices_2: 55000,
    devices_3: 72000,
    devices_4: 86000,
    devices_5: 98000,
    per_extra_device: 14000
  },
  trial_duration_days: 30,
  updated_at: new Date('2026-01-01').toISOString()
};

/**
 * Calculates official price for a given subscription type and number of devices.
 * Server is the sole authoritative source of truth for pricing to prevent client tampering.
 */
export function calculateSubscriptionPrice(
  type: 'yearly' | 'lifetime',
  deviceCount: number,
  overridePricing?: SubscriptionPricingConfig
): PriceCalculationResult {
  const count = Math.max(1, Math.floor(Number(deviceCount) || 1));
  const settings = db.getSettings();
  const pricing = overridePricing || settings.pricing || DEFAULT_PRICING_CONFIG;

  const isLifetime = type === 'lifetime';
  const tier: SubscriptionTierPricing = isLifetime ? pricing.lifetime : pricing.yearly;

  let basePrice = 0;
  let baseTierDevices = count;
  let extraDevices = 0;
  let perExtraPrice = tier.per_extra_device || (isLifetime ? 14000 : 6000);
  let extraPriceTotal = 0;
  let totalPrice = 0;
  let ruleDescription = '';

  if (count === 1) {
    basePrice = tier.devices_1;
    totalPrice = basePrice;
    ruleDescription = `سعر ترخيص جهاز واحد (${isLifetime ? 'أبدي' : 'سنوي'}): ${basePrice.toLocaleString()} ${pricing.currency_symbol}`;
  } else if (count === 2) {
    basePrice = tier.devices_2;
    totalPrice = basePrice;
    ruleDescription = `سعر ترخيص جهازين (${isLifetime ? 'أبدي' : 'سنوي'}): ${basePrice.toLocaleString()} ${pricing.currency_symbol}`;
  } else if (count === 3) {
    basePrice = tier.devices_3;
    totalPrice = basePrice;
    ruleDescription = `سعر ترخيص 3 أجهزة (${isLifetime ? 'أبدي' : 'سنوي'}): ${basePrice.toLocaleString()} ${pricing.currency_symbol}`;
  } else if (count === 4) {
    basePrice = tier.devices_4;
    totalPrice = basePrice;
    ruleDescription = `سعر ترخيص 4 أجهزة (${isLifetime ? 'أبدي' : 'سنوي'}): ${basePrice.toLocaleString()} ${pricing.currency_symbol}`;
  } else if (count === 5) {
    basePrice = tier.devices_5;
    totalPrice = basePrice;
    ruleDescription = `سعر ترخيص 5 أجهزة (${isLifetime ? 'أبدي' : 'سنوي'}): ${basePrice.toLocaleString()} ${pricing.currency_symbol}`;
  } else {
    // Greater than 5 devices rule: Base 5 devices + per_extra_device for each device above 5
    baseTierDevices = 5;
    basePrice = tier.devices_5;
    extraDevices = count - 5;
    extraPriceTotal = extraDevices * perExtraPrice;
    totalPrice = basePrice + extraPriceTotal;
    ruleDescription = `باقة 5 أجهزة (${basePrice.toLocaleString()} ${pricing.currency_symbol}) + ${extraDevices} أجهزة إضافية بسعر (${perExtraPrice.toLocaleString()} ${pricing.currency_symbol} لكل جهاز إضافي)`;
  }

  return {
    subscription_type: type,
    device_count: count,
    price_dzd: totalPrice,
    currency: pricing.currency || 'DZD',
    currency_symbol: pricing.currency_symbol || 'د.ج',
    is_lifetime: isLifetime,
    duration_days: isLifetime ? null : 365,
    breakdown: {
      base_tier_devices: baseTierDevices,
      base_price: basePrice,
      extra_devices: extraDevices,
      per_extra_price: perExtraPrice,
      extra_price_total: extraPriceTotal,
      total_price: totalPrice
    },
    rule_description: ruleDescription
  };
}

/**
 * Returns structured catalog of available subscription plans, pricing tiers, and rules.
 */
export function getSubscriptionCatalog() {
  const settings = db.getSettings();
  const pricing = settings.pricing || DEFAULT_PRICING_CONFIG;

  const deviceTiers = [1, 2, 3, 4, 5];

  const yearlyTiers = deviceTiers.map(devs => ({
    device_count: devs,
    price_dzd: (pricing.yearly as any)[`devices_${devs}`],
    formatted_price: `${((pricing.yearly as any)[`devices_${devs}`]).toLocaleString()} ${pricing.currency_symbol}`
  }));

  const lifetimeTiers = deviceTiers.map(devs => ({
    device_count: devs,
    price_dzd: (pricing.lifetime as any)[`devices_${devs}`],
    formatted_price: `${((pricing.lifetime as any)[`devices_${devs}`]).toLocaleString()} ${pricing.currency_symbol}`
  }));

  return {
    currency: pricing.currency,
    currency_symbol: pricing.currency_symbol,
    updated_at: pricing.updated_at || new Date().toISOString(),
    plans: [
      {
        id: 'yearly',
        type: 'annual',
        plan_type: 'annual',
        subscription_type: 'yearly' as SubscriptionType,
        name_ar: 'الاشتراك السنوي',
        name_fr: 'Abonnement Annuel',
        name_en: 'Annual Subscription',
        base_price: pricing.yearly.devices_1,
        extra_device_price: pricing.yearly.per_extra_device,
        devices_1: pricing.yearly.devices_1,
        devices_2: pricing.yearly.devices_2,
        devices_3: pricing.yearly.devices_3,
        devices_4: pricing.yearly.devices_4,
        devices_5: pricing.yearly.devices_5,
        per_extra_device: pricing.yearly.per_extra_device,
        duration_days: 365,
        duration_label_ar: 'سنة واحدة (365 يوم من تاريخ التفعيل)',
        is_lifetime: false,
        badge_ar: 'تجديد سنوي',
        description_ar: 'ترخيص كامل لمدة سنة كاملة مع دعم فني وتحديثات مستمرة وتخزين كاش سحابي.',
        tiers: yearlyTiers,
        custom_tier: {
          min_devices: 6,
          label_ar: '+ أكثر من 5 أجهزة',
          base_5_price: pricing.yearly.devices_5,
          per_extra_device_price: pricing.yearly.per_extra_device,
          formula_ar: `سعر 5 أجهزة (${pricing.yearly.devices_5.toLocaleString()} د.ج) + ${pricing.yearly.per_extra_device.toLocaleString()} د.ج لكل نقطة بيع إضافية`
        },
        features: [
          'صلاحية كاملة لجميع ميزات DZPOS نقطة البيع',
          'مزامنة الكتالوجات والباركودات بدون انترنت',
          'دعم فني وتحديثات دورية طوال فترة الاشتراك',
          'إمكانية إضافة أو تغيير الأجهزة في أي وقت ضمن الحد المسموح'
        ]
      },
      {
        id: 'lifetime',
        type: 'lifetime',
        plan_type: 'lifetime',
        subscription_type: 'lifetime' as SubscriptionType,
        name_ar: 'الاشتراك الأبدي (Lifetime)',
        name_fr: 'Licence à Vie (Lifetime)',
        name_en: 'Lifetime License',
        base_price: pricing.lifetime.devices_1,
        extra_device_price: pricing.lifetime.per_extra_device,
        devices_1: pricing.lifetime.devices_1,
        devices_2: pricing.lifetime.devices_2,
        devices_3: pricing.lifetime.devices_3,
        devices_4: pricing.lifetime.devices_4,
        devices_5: pricing.lifetime.devices_5,
        per_extra_device: pricing.lifetime.per_extra_device,
        duration_days: null,
        duration_label_ar: 'مدى الحياة (بدون تاريخ انتهاء)',
        is_lifetime: true,
        badge_ar: 'أفضل قيمة - ترخيص دائم',
        description_ar: 'ترخيص ملكية دائم بدون أي رسوم تجديد مستقبلية. يدوم مدى الحياة لجميع المحطات.',
        tiers: lifetimeTiers,
        custom_tier: {
          min_devices: 6,
          label_ar: '+ أكثر من 5 أجهزة',
          base_5_price: pricing.lifetime.devices_5,
          per_extra_device_price: pricing.lifetime.per_extra_device,
          formula_ar: `سعر 5 أجهزة (${pricing.lifetime.devices_5.toLocaleString()} د.ج) + ${pricing.lifetime.per_extra_device.toLocaleString()} د.ج لكل نقطة بيع إضافية`
        },
        features: [
          'ترخيص أبدي دائم بدون أي رسوم اشتراك أو تجديد سنوي',
          'صلاحية كاملة لجميع ميزات الكاسة ونقاط البيع مدى الحياة',
          'تحديثات مستمرة لقواعد بيانات الباركود الجزائرية',
          'إمكانية تحرير ونقل الأجهزة بسلاسة عند استبدال العتاد'
        ]
      }
    ]
  };
}
