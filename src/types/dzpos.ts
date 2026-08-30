export type CustomerStatus = 'active' | 'suspended' | 'blocked';
export type SubscriptionType = 'yearly' | 'lifetime' | 'trial' | 'custom';
export type LicensePlan = 'yearly' | 'lifetime' | 'trial' | 'basic' | 'pro' | 'enterprise';
export type LicenseStatus = 'pending' | 'active' | 'expired' | 'suspended' | 'revoked';
export type LicenseRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
export type PackStatus = 'draft' | 'ready' | 'published' | 'archived';
export type AdminRole = 'MAIN_ADMIN' | 'ADMIN' | 'SUPPORT';

export interface SubscriptionTierPricing {
  devices_1: number;
  devices_2: number;
  devices_3: number;
  devices_4: number;
  devices_5: number;
  per_extra_device: number;
}

export interface SubscriptionPricingConfig {
  currency: string;
  currency_symbol: string;
  yearly: SubscriptionTierPricing;
  lifetime: SubscriptionTierPricing;
  trial_duration_days: number;
  updated_at?: string;
}

export interface PriceCalculationResult {
  subscription_type: 'yearly' | 'lifetime';
  device_count: number;
  price_dzd: number;
  currency: string;
  currency_symbol: string;
  is_lifetime: boolean;
  duration_days: number | null;
  breakdown: {
    base_tier_devices: number;
    base_price: number;
    extra_devices: number;
    per_extra_price: number;
    extra_price_total: number;
    total_price: number;
  };
  rule_description: string;
}

export type ErrorCode =
  | 'INVALID_LICENSE'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_SUSPENDED'
  | 'LICENSE_REVOKED'
  | 'DEVICE_NOT_AUTHORIZED'
  | 'DEVICE_LIMIT_REACHED'
  | 'DEVICE_ALREADY_BOUND'
  | 'DEVICE_NOT_FOUND'
  | 'INVALID_SUBSCRIPTION_TYPE'
  | 'INVALID_DEVICE_COUNT'
  | 'PRICE_TAMPERING_DETECTED'
  | 'ACTIVITY_NOT_FOUND'
  | 'PRODUCT_PACK_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'INVALID_FILE'
  | 'FILE_MISSING'
  | 'ZIP_PROCESSING_FAILED'
  | 'IMPORT_FAILED'
  | 'SYNC_REQUIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'CUSTOMER_NOT_FOUND'
  | 'DUPLICATE_KEY'
  | 'USER_NOT_FOUND'
  | 'EMAIL_EXISTS'
  | 'USERNAME_EXISTS'
  | 'PASSWORD_TOO_SHORT'
  | 'ENDPOINT_NOT_FOUND'
  | 'MENU_NOT_FOUND'
  | 'MENU_DISABLED'
  | 'TABLE_NOT_FOUND'
  | 'INVALID_MENU_PAYLOAD'
  | 'MENU_SLUG_TAKEN';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  business_name: string;
  activity_code: string;
  activity_name: string;
  wilaya_code: string;
  wilaya_name: string;
  city?: string;
  status: CustomerStatus;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  last_sync_at?: string;
  device_count?: number;
  active_license_key?: string;
}

export interface LicenseDevice {
  id: string;
  license_id: string;
  device_id: string;
  device_name: string;
  os: string;
  app_version: string;
  ip_address?: string;
  activated_at: string;
  last_seen_at: string;
  status: 'active' | 'revoked';
}

export interface License {
  license_id: string;
  license_key: string;
  customer_id: string;
  customer_name: string;
  business_name: string;
  activity_code: string;
  plan: LicensePlan;
  subscription_type?: SubscriptionType;
  is_lifetime?: boolean;
  price_dzd?: number;
  status: LicenseStatus;
  max_devices: number;
  devices: LicenseDevice[];
  created_at: string;
  starts_at?: string;
  activated_at?: string;
  expires_at?: string | null;
  last_sync_at?: string;
  features: string[];
  metadata?: Record<string, any>;
  notes?: string;
}

export interface LicenseRequest {
  request_id: string;
  customer_id?: string;
  customer_name: string;
  phone: string;
  email?: string;
  business_name: string;
  activity_code: string;
  wilaya_code: string;
  wilaya_name: string;
  requested_plan: LicensePlan;
  subscription_type?: SubscriptionType;
  is_lifetime?: boolean;
  requested_devices?: number;
  calculated_price_dzd?: number;
  requested_duration_days?: number;
  device_id?: string;
  device_name?: string;
  os?: string;
  app_version?: string;
  source?: 'website' | 'phone' | 'admin' | 'simulator' | string;
  source_label?: string;
  notes?: string;
  status: LicenseRequestStatus;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  generated_license_id?: string;
  generated_license_key?: string;
}

export interface RemoteDeviceCheckResponse {
  success: boolean;
  activated: boolean;
  registered?: boolean;
  status?: string;
  license_key?: string;
  device_id?: string;
  customer_name?: string;
  business_name?: string;
  activity_code?: string;
  plan?: string;
  expires_at?: string;
  days_remaining?: number;
  features?: string[];
  latest_pack_version?: number;
  pack_download_url?: string;
  message?: string;
}

export interface BusinessActivity {
  id: string;
  code: string;
  name_ar: string;
  name_fr: string;
  name_en: string;
  description?: string;
  is_active?: boolean;
  icon?: string;
  status: 'active' | 'disabled';
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
  latest_pack_version: number;
  total_products: number;
}

export type ProductRecord = Product;

export interface ProductPack {
  id: string;
  activity_code: string;
  pack_name: string;
  description: string;
  latest_published_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPackVersion {
  version_id: string;
  activity_code: string;
  version: number;
  status: PackStatus;
  checksum_sha256: string;
  total_products: number;
  file_size_bytes: number;
  changes_summary: string;
  created_by: string;
  created_at: string;
  published_at?: string;
  rollback_from_version?: number;
}

export interface Product {
  id?: string;
  product_id: string;
  activity_code: string;
  name: string;
  name_ar: string;
  name_fr: string;
  barcode: string;
  sku?: string;
  category: string;
  category_name?: string;
  category_id?: string;
  brand: string;
  unit: string;
  price?: number;
  default_price: number;
  purchase_price?: number;
  wholesale_price?: number;
  stock_qty?: number;
  min_stock_alert?: number;
  image_url?: string;
  tax_rate?: number;
  is_tax_exempt?: boolean;
  status: 'active' | 'inactive';
  metadata?: Record<string, any>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: AdminRole;
  active: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string;
  timestamp: string;
  ip?: string;
  details?: Record<string, any>;
}

export interface ClientAiExportConfig {
  enabled: boolean;
  export_gemini_key_to_clients: boolean;
  custom_gemini_api_key?: string;
  model_name: string;
  fallback_model_name: string;
  temperature: number;
  daily_scan_limit_per_device: number;
  allow_offline_prompt_cache: boolean;
  system_instruction: string;
  response_json_schema?: Record<string, any>;
  supported_features: string[];
}

export interface ClientAiCredentialsResponse {
  provider: 'google_gemini';
  api_key: string;
  model: string;
  fallback_model: string;
  temperature: number;
  endpoint: string;
  system_instruction: string;
  response_schema: Record<string, any>;
  daily_limit: number;
  remaining_today: number;
  client_execution_mode: 'DIRECT_CLIENT_SDK';
  sync_endpoint: string;
  cached_until: string;
}

export interface SystemSettings {
  grace_period_days: number;
  allow_trial_auto_approve: boolean;
  max_devices_trial: number;
  max_devices_basic: number;
  max_devices_pro: number;
  max_devices_enterprise: number;
  require_device_binding: boolean;
  offline_cache_duration_hours: number;
  system_name: string;
  support_phone: string;
  support_email: string;
  pricing: SubscriptionPricingConfig;
  ai_config?: ClientAiExportConfig;
}

export interface SyncCheckRequest {
  activity_code: string;
  local_version: number;
  license_key?: string;
  device_id?: string;
  app_version?: string;
}

export interface SyncCheckResponse {
  update_available: boolean;
  activity_code: string;
  local_version: number;
  server_version: number;
  checksum_sha256: string;
  total_products: number;
  download_url: string;
  updated_at: string;
  changes_summary: string;
}

export interface LicenseVerifyRequest {
  license_key: string;
  device_id: string;
  device_name?: string;
  os?: string;
  app_version?: string;
  platform?: string;
}

export interface LicenseVerifyResponse {
  valid: boolean;
  status: LicenseStatus;
  subscription_type?: SubscriptionType;
  is_lifetime?: boolean;
  expires_at?: string | null;
  days_remaining?: number | null;
  is_grace_period: boolean;
  grace_period_days_left: number;
  customer: {
    name: string;
    business_name: string;
    activity_code: string;
    wilaya: string;
  };
  plan: LicensePlan;
  features: string[];
  max_devices: number;
  active_devices_count: number;
  remaining_devices_count: number;
  server_time: string;
  offline_cache_duration_hours: number;
  message?: string;
}

export interface SubscriptionDeviceUsageResponse {
  license_key: string;
  subscription_type: SubscriptionType;
  is_lifetime: boolean;
  status: LicenseStatus;
  max_devices: number;
  active_devices_count: number;
  remaining_slots: number;
  devices: LicenseDevice[];
  can_add_device: boolean;
  expires_at?: string | null;
  days_remaining?: number | null;
}

export interface MatchedCandidate {
  product_id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  barcode: string;
  category: string;
  unit?: string;
  price: number;
  purchase_price: number;
  score: number; // 0.0 to 1.0 (e.g. 0.98 = 98%)
  confidence?: number;
}

export interface PurchaseItem {
  id: string;
  product_id?: string;
  matched_product_name?: string;
  raw_name: string;
  barcode?: string;
  category?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  selling_price?: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total_ht: number;
  total_ttc: number;
  confidence?: {
    raw_name?: number;
    barcode?: number;
    quantity?: number;
    unit_price?: number;
    product_match?: number;
  };
  match_status: 'matched' | 'review_required' | 'new_product' | 'manual';
  matched_candidates?: MatchedCandidate[];
  is_new_product?: boolean;
}

export type PurchaseInvoiceStatus = 'draft' | 'confirmed' | 'cancelled';
export type PurchasePaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  order_ref?: string;
  supplier_id?: string;
  supplier_name: string;
  supplier_phone?: string;
  supplier_address?: string;
  supplier_tax_id?: string;
  status: PurchaseInvoiceStatus;
  payment_status: PurchasePaymentStatus;
  payment_method?: 'cash' | 'check' | 'bank_transfer' | 'credit' | string;
  subtotal_ht: number;
  total_tax: number;
  total_discount: number;
  total_ttc: number;
  items: PurchaseItem[];
  items_count: number;
  notes?: string;
  file_url?: string;
  file_name?: string;
  activity_code?: string;
  created_by?: string;
  created_at: string;
  confirmed_at?: string;
  ai_metadata?: {
    analyzed_at: string;
    model: string;
    raw_ocr_summary?: string;
    confidence_avg: number;
    tokens_used?: number;
    latency_ms?: number;
  };
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  wilaya_code?: string;
  wilaya_name?: string;
  nif?: string;
  nis?: string;
  rc?: string;
  total_purchases_dzd?: number;
  purchases_count?: number;
  created_at: string;
  updated_at: string;
}

export interface AiUsageEvent {
  id: string;
  operation: 'analyze_invoice' | 'match_products' | 'auto_categorize' | string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_estimate_usd?: number;
  latency_ms: number;
  status: 'success' | 'failed' | 'fallback';
  error_message?: string;
  user_id?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface AiInvoiceAnalysisResult {
  success: boolean;
  is_fallback?: boolean;
  ocr_warning?: string;
  supplier_name: string;
  supplier_phone?: string;
  supplier_address?: string;
  supplier_tax_id?: string;
  invoice_number: string;
  invoice_date: string;
  order_ref?: string;
  payment_method?: string;
  subtotal_ht: number;
  total_tax: number;
  total_discount: number;
  total_ttc: number;
  items: PurchaseItem[];
  confidence_overall: number;
  notes?: string;
  duplicate_warning?: {
    is_duplicate: boolean;
    existing_invoice_id?: string;
    message?: string;
  };
  file_url?: string;
  file_name?: string;
  meta: {
    model: string;
    latency_ms: number;
    tokens?: number;
    matched_count: number;
    review_count: number;
    new_count: number;
  };
}

// ==========================================
// 🍽️ Table Menu & QR System Types
// ==========================================

export interface PublishedMenuCategory {
  category_id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  icon?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
}

export interface PublishedMenuProduct {
  id?: string;
  product_id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  image_url?: string;
  price: number;
  original_price?: number;
  category_id: string;
  category_name?: string;
  unit?: string;
  is_available: boolean;
  is_featured?: boolean;
  is_spicy?: boolean;
  is_vegetarian?: boolean;
  allergens?: string[];
  calories?: number;
  preparation_time_minutes?: number;
  sort_order?: number;
  badges?: string[];
  sizes?: ProductCustomizationSize[];
  addons?: ProductCustomizationAddon[];
  special_options?: ProductCustomizationOption[];
  options?: {
    name: string;
    price_delta: number;
  }[];
}

export interface ProductCustomizationSize {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  price?: number;
  price_delta?: number;
  is_default?: boolean;
}

export interface ProductCustomizationAddon {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  price: number;
  icon?: string;
  emoji?: string;
}

export interface ProductCustomizationOption {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  icon?: string;
  emoji?: string;
}

export interface PublishedMenuSnapshot {
  categories: PublishedMenuCategory[];
  products: PublishedMenuProduct[];
  published_at: string;
  total_categories: number;
  total_products: number;
  device_id?: string;
  app_version?: string;
}

export interface RestaurantMenu {
  id: string;
  customer_id: string;
  license_key: string;
  restaurant_name: string;
  restaurant_name_ar?: string;
  restaurant_name_fr?: string;
  public_slug: string;
  public_token: string;
  enabled: boolean;
  tagline?: string;
  description?: string;
  currency: string;
  currency_symbol: string;
  phone?: string;
  phone_alt?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  wilaya_code?: string;
  logo_url?: string;
  cover_url?: string;
  wifi_ssid?: string;
  wifi_password?: string;
  instagram?: string;
  facebook?: string;
  google_maps_url?: string;
  opening_hours?: string;
  theme_color?: string;
  revision: number;
  checksum_sha256: string;
  last_published_at?: string;
  created_at: string;
  updated_at: string;
  snapshot: PublishedMenuSnapshot;
  tables_count?: number;
}

export interface MenuTable {
  id: string;
  menu_id: string;
  license_key: string;
  table_number: string;
  table_code: string;
  label_ar?: string;
  label_fr?: string;
  capacity?: number;
  zone?: string; // e.g. "صالة رئيسية", "عائلات", "Terrasse", "VIP"
  enabled: boolean;
  qr_url: string;
  created_at: string;
  updated_at: string;
}

export interface MenuPublishRequest {
  license_key?: string;
  device_id?: string;
  app_version?: string;
  revision?: number;
  idempotency_key?: string;
  restaurant_name?: string;
  restaurant_name_ar?: string;
  restaurant_name_fr?: string;
  public_slug?: string;
  enabled?: boolean;
  tagline?: string;
  description?: string;
  currency?: string;
  currency_symbol?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  wilaya_code?: string;
  logo_url?: string;
  cover_url?: string;
  wifi_ssid?: string;
  wifi_password?: string;
  theme_color?: string;
  opening_hours?: string;
  restaurant_info?: {
    restaurant_name?: string;
    restaurant_name_ar?: string;
    restaurant_name_fr?: string;
    tagline?: string;
    description?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    city?: string;
    wilaya_code?: string;
    logo_url?: string;
    cover_url?: string;
    wifi_ssid?: string;
    wifi_password?: string;
    theme_color?: string;
    opening_hours?: string;
  };
  categories?: PublishedMenuCategory[];
  products?: PublishedMenuProduct[];
  snapshot?: PublishedMenuSnapshot;
  tables?: {
    id?: string;
    table_number: string;
    table_code?: string;
    label_ar?: string;
    label_fr?: string;
    capacity?: number;
    zone?: string;
    enabled?: boolean;
  }[];
}

export interface MenuPublishResponse {
  success: boolean;
  menu_id: string;
  public_slug: string;
  revision: number;
  checksum_sha256: string;
  total_categories?: number;
  total_products?: number;
  total_tables?: number;
  tables_count?: number;
  public_url?: string;
  public_menu_url?: string;
  published_at?: string;
  last_published_at?: string;
  tables?: {
    id: string;
    table_number: string;
    table_code: string;
    zone?: string;
    qr_url: string;
  }[];
  message: string;
}

export interface PublicMenuResponse {
  success: boolean;
  restaurant: {
    id?: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
    tagline?: string;
    description?: string;
    currency?: string;
    currency_symbol?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    city?: string;
    wilaya_code?: string;
    logo_url?: string;
    cover_url?: string;
    wifi_ssid?: string;
    wifi_password?: string;
    theme_color?: string;
    opening_hours?: string;
  };
  table?: {
    table_number: string;
    table_code: string;
    label_ar?: string;
    label_fr?: string;
    zone?: string;
    capacity?: number;
  };
  menu?: {
    categories: PublishedMenuCategory[];
    products: PublishedMenuProduct[];
    total_categories: number;
    total_products: number;
    last_updated: string;
    revision: number;
  };
  snapshot?: PublishedMenuSnapshot;
  metadata?: {
    revision: number;
    last_updated: string;
    server_time: string;
  };
}

export type TableOrderStatus =
  | 'DRAFT'
  | 'WAITING_WAITER'
  | 'CONFIRMED'
  | 'SENT_TO_KITCHEN'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TableOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_name_ar?: string;
  product_name_fr?: string;
  price: number;
  quantity: number;
  subtotal: number;
  unit?: string;
  notes?: string;
  category_id?: string;
  selected_size?: ProductCustomizationSize;
  selected_addons?: ProductCustomizationAddon[];
  selected_options?: string[];
  customization_summary?: string;
}

export interface TableOrder {
  id: string;
  public_order_number: string;
  restaurant_id: string;
  license_key: string;
  restaurant_slug: string;
  restaurant_name: string;
  table_id?: string;
  table_code: string;
  table_number: string;
  table_name: string;
  status: TableOrderStatus;
  source: 'qr_menu';
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  currency_symbol: string;
  items: TableOrderItem[];
  items_count: number;
  notes?: string;
  secure_token: string;
  secure_token_hash?: string;
  qr_verification_url: string;
  version: number;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  confirmed_by?: string;
  sent_to_kitchen_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  device_id?: string;
}

export interface CreateOrderRequest {
  table_code: string;
  table_id?: string;
  table_number?: string;
  items: {
    product_id: string;
    quantity: number;
    notes?: string;
    selected_size?: ProductCustomizationSize;
    selected_addons?: ProductCustomizationAddon[];
    selected_options?: string[];
    customization_summary?: string;
  }[];
  notes?: string;
  idempotency_key?: string;
  customer_name?: string;
}

export interface UpdateOrderRequest {
  items?: {
    product_id: string;
    quantity: number;
    notes?: string;
    selected_size?: ProductCustomizationSize;
    selected_addons?: ProductCustomizationAddon[];
    selected_options?: string[];
    customization_summary?: string;
  }[];
  notes?: string;
}

export interface OrderScanResponse {
  success: boolean;
  order: TableOrder;
  can_confirm: boolean;
  message?: string;
}

export interface OrderConfirmRequest {
  order_id?: string;
  token?: string;
  waiter_name?: string;
  device_id?: string;
  idempotency_key?: string;
  notes?: string;
}

export interface OrderConfirmResponse {
  success: boolean;
  order: TableOrder;
  message: string;
  already_confirmed?: boolean;
}

export interface OrderSyncResponse {
  success: boolean;
  orders: TableOrder[];
  total: number;
  server_time: string;
  cursor?: string;
}
