import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import {
  TableOrder,
  TableOrderItem,
  TableOrderStatus,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderScanResponse,
  OrderConfirmRequest,
  OrderConfirmResponse,
  OrderSyncResponse,
  RestaurantMenu,
  MenuTable
} from '../../src/types/dzpos.js';

const router = express.Router();

/**
 * Helper to normalize and enrich TableOrder for maximum POS compatibility
 */
export function formatOrderResponse(order: TableOrder, host: string = 'localhost:3000', protocol: string = 'https') {
  const cleanHost = host.replace(/\/+$/, '');
  const relVerificationUrl = `/api/orders/qr/${encodeURIComponent(order.secure_token)}`;
  const fullVerificationUrl = `${protocol}://${cleanHost}${relVerificationUrl}`;

  const rawStatus = order.status || 'WAITING_WAITER';
  const isWaiting = rawStatus === 'WAITING_WAITER' || rawStatus === 'DRAFT';
  const isConfirmed = rawStatus === 'CONFIRMED';
  const isKitchen = rawStatus === 'SENT_TO_KITCHEN';
  const isCompleted = rawStatus === 'COMPLETED';
  const isCancelled = rawStatus === 'CANCELLED';

  return {
    ...order,
    // ID Aliases
    id: order.id,
    order_id: order.id,
    orderId: order.id,
    _id: order.id,

    // Public Order Number Aliases
    public_order_number: order.public_order_number,
    order_number: order.public_order_number,
    orderNumber: order.public_order_number,
    number: order.public_order_number,

    // Store & Restaurant Aliases
    store_id: order.license_key || order.restaurant_id,
    storeId: order.license_key || order.restaurant_id,
    restaurant_id: order.restaurant_id,
    restaurantId: order.restaurant_id,
    restaurant_slug: order.restaurant_slug,
    license_id: order.license_key,
    license_key: order.license_key,
    licenseKey: order.license_key,

    // Token & QR Aliases
    secure_token: order.secure_token,
    token: order.secure_token,
    code: order.secure_token,
    order_token: order.secure_token,
    qr_code: fullVerificationUrl,
    qr_url: fullVerificationUrl,
    qrUrl: fullVerificationUrl,
    verification_url: fullVerificationUrl,
    qr_payload: fullVerificationUrl,
    qr_verification_url: fullVerificationUrl,
    relative_qr_url: relVerificationUrl,
    qr_code_data: order.secure_token,

    // Table information
    table_id: order.table_id || order.table_code,
    tableId: order.table_id || order.table_code,
    table_code: order.table_code,
    tableCode: order.table_code,
    table_number: order.table_number || order.table_code,
    tableNumber: order.table_number || order.table_code,
    table_name: order.table_name || `طاولة رقم ${order.table_code}`,
    tableName: order.table_name || `طاولة رقم ${order.table_code}`,

    // Status & Permissions (Exposing both WAITING_WAITER and PENDING for cross-platform compatibility)
    status: rawStatus,
    order_status: isWaiting ? 'PENDING' : rawStatus,
    orderStatus: isWaiting ? 'PENDING' : rawStatus,
    normalized_status: isWaiting ? 'PENDING' : rawStatus,
    state: isWaiting ? 'PENDING' : rawStatus,
    can_confirm: isWaiting,
    can_edit: isWaiting,
    is_pending: isWaiting,
    is_confirmed: isConfirmed,
    is_kitchen: isKitchen,
    is_completed: isCompleted,
    is_cancelled: isCancelled,

    // Items & counts
    items_count: order.items_count || order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0,
    itemsCount: order.items_count || order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0,
    items: (order.items || []).map(it => ({
      ...it,
      id: it.id,
      item_id: it.id,
      product_id: it.product_id,
      productId: it.product_id,
      name: it.product_name_ar || it.product_name,
      product_name: it.product_name,
      productName: it.product_name,
      product_name_ar: it.product_name_ar || it.product_name,
      product_name_fr: it.product_name_fr || it.product_name,
      quantity: it.quantity,
      qty: it.quantity,
      unit_price: (it as any).unit_price ?? it.price,
      price: (it as any).unit_price ?? it.price,
      total_price: (it as any).total_price ?? it.subtotal ?? (it.price * it.quantity),
      total: (it as any).total_price ?? it.subtotal ?? (it.price * it.quantity),
      notes: it.notes || '',
      selected_size: it.selected_size,
      selected_addons: it.selected_addons,
      selected_options: it.selected_options,
      customization_summary: it.customization_summary || it.notes
    })),

    // Financial
    total: order.total,
    subtotal: order.subtotal,
    tax: order.tax || 0,
    currency: order.currency || 'DZD',
    currency_symbol: order.currency_symbol || 'د.ج',

    // Timestamps
    created_at: order.created_at,
    createdAt: order.created_at,
    updated_at: order.updated_at,
    updatedAt: order.updated_at
  };
}

/**
 * Valid order state transition matrix
 */
const ALLOWED_TRANSITIONS: Record<TableOrderStatus, TableOrderStatus[]> = {
  DRAFT: ['WAITING_WAITER', 'CANCELLED'],
  WAITING_WAITER: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SENT_TO_KITCHEN', 'CANCELLED'],
  SENT_TO_KITCHEN: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

/**
 * Extract auth license key or store slug / ID from request (Headers, Query, Body, Params)
 */
export function extractStoreIdentifier(req: Request): { licenseKey?: string; slug?: string; rawIdentifier?: string } {
  const authHeader = req.headers.authorization || '';
  const licenseHeader =
    (req.headers['x-license-key'] as string) ||
    (req.headers['x-dzpos-license'] as string) ||
    (req.headers['license-key'] as string);
  const slugHeader =
    (req.headers['x-store-slug'] as string) ||
    (req.headers['x-restaurant-slug'] as string) ||
    (req.headers['x-slug'] as string);

  const queryLicense = (req.query.license_key || req.query.license || req.query.key) as string;
  const querySlug = (req.query.slug || req.query.store_slug || req.query.restaurant_slug || req.query.restaurant_id || req.query.storeId || req.query.store_id || req.query.menu_id) as string;
  const paramSlug = req.params.slug;

  const bodyLicense = req.body?.license_key || req.body?.license || req.body?.key;
  const bodySlug = req.body?.slug || req.body?.store_slug || req.body?.restaurant_slug || req.body?.restaurant_id;

  let licenseKey = licenseHeader || queryLicense || bodyLicense;
  if (!licenseKey && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.substring(7).trim();
    if (bearer.startsWith('DZPOS-') || bearer.includes('-')) {
      licenseKey = bearer;
    }
  }

  // Check device_id if license is not directly provided
  const deviceId = (req.headers['x-device-id'] as string) || (req.query.device_id as string) || (req.body?.device_id as string);
  if (deviceId && !licenseKey) {
    const cleanDev = deviceId.trim();
    const matchedLic = db.getLicenses().find(l => 
      l.devices?.some((d: any) => (typeof d === 'string' ? d : d?.device_id) === cleanDev)
    );
    if (matchedLic) {
      licenseKey = matchedLic.license_key;
    }
  }

  const slug = paramSlug || slugHeader || querySlug || bodySlug;
  const rawIdentifier = licenseKey || slug;

  return {
    licenseKey: licenseKey ? licenseKey.trim().toUpperCase() : undefined,
    slug: slug ? slug.trim() : undefined,
    rawIdentifier: rawIdentifier ? rawIdentifier.trim() : undefined
  };
}

function extractLicenseKey(req: Request): string | undefined {
  const { licenseKey, rawIdentifier } = extractStoreIdentifier(req);
  return licenseKey || rawIdentifier;
}

/**
 * Helper to validate and calculate order items from published menu snapshot
 */
function processOrderItems(
  menu: RestaurantMenu,
  orderId: string,
  rawItems: {
    product_id: string;
    quantity: number;
    notes?: string;
    selected_size?: any;
    selected_addons?: any[];
    selected_options?: string[];
    customization_summary?: string;
  }[]
): { items: TableOrderItem[]; subtotal: number; error?: string } {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { items: [], subtotal: 0, error: 'يجب اختيار منتج واحد على الأقل لإتمام الطلب' };
  }

  const snapshotProducts = menu.snapshot?.products || [];
  const processedItems: TableOrderItem[] = [];
  let subtotal = 0;

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const productId = (raw.product_id || '').trim();
    const quantity = Math.floor(Number(raw.quantity) || 0);

    if (!productId) {
      return { items: [], subtotal: 0, error: `المنتج رقم ${i + 1} غير محدد` };
    }

    if (quantity <= 0) {
      return { items: [], subtotal: 0, error: `الكمية للمنتج رقم ${i + 1} يجب أن تكون 1 على الأقل` };
    }

    // Match product in backend published snapshot (Zero Trust on frontend base price)
    const product = snapshotProducts.find(p => p.id === productId || p.product_id === productId);
    if (!product) {
      return { items: [], subtotal: 0, error: `المنتج (${productId}) غير متوفر في قائمة المطعم المنشورة` };
    }

    if (product.is_available === false) {
      return { items: [], subtotal: 0, error: `عذراً، المنتج "${product.name_ar || product.name}" غير متوفر حالياً` };
    }

    // Base unit price
    let unitPrice = Number(product.price) || 0;

    // Apply size delta or absolute price if selected
    if (raw.selected_size) {
      if (typeof raw.selected_size.price === 'number') {
        unitPrice = raw.selected_size.price;
      } else if (typeof raw.selected_size.price_delta === 'number') {
        unitPrice += raw.selected_size.price_delta;
      }
    }

    // Add selected add-ons prices
    let addonsTotal = 0;
    if (Array.isArray(raw.selected_addons)) {
      for (const addon of raw.selected_addons) {
        addonsTotal += Number(addon.price) || 0;
      }
    }
    unitPrice += addonsTotal;

    const itemSubtotal = unitPrice * quantity;
    subtotal += itemSubtotal;

    // Build human readable customization summary for tickets and kitchen displays
    const summaryParts: string[] = [];
    if (raw.selected_size && (raw.selected_size.name_ar || raw.selected_size.name)) {
      summaryParts.push(`الحجم: ${raw.selected_size.name_ar || raw.selected_size.name}`);
    }
    if (Array.isArray(raw.selected_addons) && raw.selected_addons.length > 0) {
      const addonNames = raw.selected_addons.map(a => `${a.name_ar || a.name || 'إضافة'} (+${a.price} د.ج)`).join('، ');
      summaryParts.push(`إضافات: ${addonNames}`);
    }
    if (Array.isArray(raw.selected_options) && raw.selected_options.length > 0) {
      summaryParts.push(`خيارات: ${raw.selected_options.join('، ')}`);
    }
    if (raw.notes && raw.notes.trim()) {
      summaryParts.push(`ملاحظة: ${raw.notes.trim()}`);
    }

    const customizationSummary = raw.customization_summary || summaryParts.join(' | ') || undefined;

    processedItems.push({
      id: `item_${orderId}_${i + 1}_${Date.now().toString(36)}`,
      order_id: orderId,
      product_id: product.id || product.product_id,
      product_name: product.name,
      product_name_ar: product.name_ar || product.name,
      product_name_fr: product.name_fr || product.name,
      price: unitPrice,
      quantity,
      subtotal: itemSubtotal,
      unit: product.unit || 'Pièce',
      notes: customizationSummary || (raw.notes ? raw.notes.trim() : undefined),
      category_id: product.category_id,
      selected_size: raw.selected_size,
      selected_addons: raw.selected_addons,
      selected_options: raw.selected_options,
      customization_summary: customizationSummary
    });
  }

  return { items: processedItems, subtotal };
}

// =========================================================================
// 1. ORDER CREATION & SUBMISSION (Customer QR Menu Flow)
// =========================================================================

/**
 * POST /api/orders & /api/menu/public/:slug/orders
 * Customer creates an order from the digital table menu.
 */
export const handleCreateOrder = (req: Request, res: Response) => {
  try {
    const slugParam = req.params.slug;
    const {
      restaurant_slug,
      restaurant_id,
      license_key,
      table_code,
      table_id,
      table_number,
      items: rawItems,
      notes,
      idempotency_key: rawIdemp,
      customer_name
    } = req.body as CreateOrderRequest & {
      restaurant_slug?: string;
      restaurant_id?: string;
      license_key?: string;
    };

    const idempotencyKey = (
      rawIdemp ||
      (req.headers['idempotency-key'] as string) ||
      (req.headers['x-idempotency-key'] as string) ||
      ''
    ).trim();

    // Check for existing order with same idempotency key
    if (idempotencyKey) {
      const existing = db.getTableOrderByIdempotencyKey(idempotencyKey, license_key);
      if (existing) {
        return res.json({
          success: true,
          order: existing,
          is_idempotent: true,
          message: 'تم استرجاع الطلب المسبق بنجاح (Idempotent response)'
        });
      }
    }

    // Resolve restaurant menu
    let menu: RestaurantMenu | undefined;
    const targetSlug = slugParam || restaurant_slug;
    if (targetSlug) {
      menu = db.getRestaurantMenuBySlug(targetSlug);
    }
    if (!menu && restaurant_id) {
      menu = db.getRestaurantMenuById(restaurant_id);
    }
    if (!menu && license_key) {
      menu = db.getRestaurantMenuByLicenseKey(license_key);
    }

    if (!menu) {
      return res.status(404).json({
        success: false,
        error_code: 'MENU_NOT_FOUND',
        message: 'قائمة المطعم غير موجودة أو غير منشورة.'
      });
    }

    if (menu.enabled === false) {
      return res.status(403).json({
        success: false,
        error_code: 'MENU_DISABLED',
        message: 'قائمة الطلبات غير مفعلة حالياً من قبل المطعم.'
      });
    }

    // Resolve table
    const targetCode = (table_code || table_number || req.query.table || '').toString().trim();
    if (!targetCode) {
      return res.status(400).json({
        success: false,
        error_code: 'TABLE_CODE_REQUIRED',
        message: 'يرجى مسح رمز QR الخاص بالطاولة لتحديد رقم الطاولة.'
      });
    }

    const matchedTable = db.getMenuTableByCode(menu.id, targetCode);
    const tableDisplayName = matchedTable
      ? (matchedTable.label_ar || `طاولة رقم ${matchedTable.table_number}`)
      : `طاولة رقم ${targetCode}`;

    const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const publicOrderNumber = db.getNextTableOrderNumber(menu.license_key);

    // Process & calculate items from backend snapshot
    const itemResult = processOrderItems(menu, orderId, rawItems);
    if (itemResult.error) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_ORDER_ITEMS',
        message: itemResult.error
      });
    }

    const subtotal = itemResult.subtotal;
    const tax = 0;
    const total = subtotal + tax;

    // Generate cryptographic secure token for waiter QR verification
    const secureToken = `ord_tok_${crypto.randomBytes(20).toString('base64url')}`;
    const secureTokenHash = crypto.createHash('sha256').update(secureToken).digest('hex');

    const now = new Date().toISOString();
    const verificationUrl = `/api/orders/qr/${encodeURIComponent(secureToken)}`;

    const newOrder: TableOrder = {
      id: orderId,
      public_order_number: publicOrderNumber,
      restaurant_id: menu.id,
      license_key: menu.license_key,
      restaurant_slug: menu.public_slug,
      restaurant_name: menu.restaurant_name,
      table_id: matchedTable?.id || table_id,
      table_code: matchedTable?.table_code || targetCode,
      table_number: matchedTable?.table_number || targetCode,
      table_name: tableDisplayName,
      status: 'WAITING_WAITER',
      source: 'qr_menu',
      subtotal,
      tax,
      total,
      currency: menu.currency || 'DZD',
      currency_symbol: menu.currency_symbol || 'د.ج',
      items: itemResult.items,
      items_count: itemResult.items.reduce((sum, it) => sum + it.quantity, 0),
      notes: notes ? notes.trim() : undefined,
      secure_token: secureToken,
      secure_token_hash: secureTokenHash,
      qr_verification_url: verificationUrl,
      version: 1,
      idempotency_key: idempotencyKey || undefined,
      created_at: now,
      updated_at: now
    };

    const savedOrder = db.saveTableOrder(newOrder, customer_name || 'Customer');

    // Diagnostic log requested for E2E traceability
    console.log(`[TABLE_ORDER_CREATED]
order_id=${savedOrder.id}
order_number=${savedOrder.public_order_number}
status=${savedOrder.status}
store_id=${savedOrder.license_key || savedOrder.restaurant_id}
restaurant_id=${savedOrder.restaurant_id}
license_id=${savedOrder.license_key}
table_id=${savedOrder.table_id || savedOrder.table_code}
table_name=${savedOrder.table_name}
qr_token=${savedOrder.secure_token}
created_at=${savedOrder.created_at}`);

    db.addAuditLog(
      'customer',
      'CUSTOMER',
      'ORDER_CREATED',
      'table_order',
      savedOrder.id,
      {
        order_number: savedOrder.public_order_number,
        table: savedOrder.table_code,
        total: savedOrder.total,
        items_count: savedOrder.items_count,
        license_key: savedOrder.license_key
      }
    );

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formatted = formatOrderResponse(savedOrder, host, protocol);

    return res.status(201).json({
      success: true,
      message: 'تم إرسال طلبك بنجاح. في انتظار تأكيد النادل.',
      order: formatted,
      data: formatted
    });
  } catch (error: any) {
    console.error('Error creating table order:', error);
    return res.status(500).json({
      success: false,
      error_code: 'ORDER_CREATION_FAILED',
      message: error.message || 'حدث خطأ أثناء إنشاء الطلب'
    });
  }
};

router.post('/', handleCreateOrder);
router.post('/create', handleCreateOrder);

// =========================================================================
// 2. CUSTOMER ORDER LIVE STATUS & EDIT (Before Waiter Confirmation)
// =========================================================================

/**
 * GET /api/orders/qr/:token & /api/menu/public/orders/:token
 * Fetch order details using secure customer token.
 */
export const handleGetOrderByToken = (req: Request, res: Response) => {
  try {
    const rawToken = req.params.token || req.params[0] || (req.query.token as string);
    if (!rawToken) {
      return res.status(400).json({
        success: false,
        error_code: 'TOKEN_REQUIRED',
        message: 'رمز التحقق مطلوب.'
      });
    }

    const order = db.getTableOrderByToken(rawToken);
    if (!order) {
      return res.status(404).json({
        success: false,
        error_code: 'ORDER_NOT_FOUND',
        message: 'الطلب غير موجود أو انتهت صلاحيته.'
      });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formatted = formatOrderResponse(order, host, protocol);

    // Sanitized public view for customer live status
    return res.json({
      success: true,
      order: formatted,
      data: formatted,
      server_time: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/qr/:token', handleGetOrderByToken);
router.get('/qr/*', handleGetOrderByToken);
router.get('/token/:token', handleGetOrderByToken);
router.get('/token/*', handleGetOrderByToken);

/**
 * PATCH /api/orders/:token & /api/menu/public/orders/:token
 * Customer updates items or notes before waiter confirmation.
 */
export const handleUpdateOrderByToken = (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { items: rawItems, notes } = req.body as UpdateOrderRequest;

    const order = db.getTableOrderByToken(token);
    if (!order) {
      return res.status(404).json({
        success: false,
        error_code: 'ORDER_NOT_FOUND',
        message: 'الطلب غير موجود.'
      });
    }

    if (order.status !== 'WAITING_WAITER') {
      return res.status(409).json({
        success: false,
        error_code: 'ORDER_ALREADY_LOCKED',
        message: `لا يمكن تعديل الطلب لأنه في حالة (${order.status}). تم تأكيده بالفعل من قبل النادل.`,
        current_status: order.status
      });
    }

    const menu = db.getRestaurantMenuById(order.restaurant_id) || db.getRestaurantMenuByLicenseKey(order.license_key);
    if (!menu) {
      return res.status(404).json({
        success: false,
        error_code: 'MENU_NOT_FOUND',
        message: 'قائمة المطعم غير متوفرة.'
      });
    }

    let updatedItems = order.items;
    let subtotal = order.subtotal;

    if (rawItems && Array.isArray(rawItems)) {
      const processed = processOrderItems(menu, order.id, rawItems);
      if (processed.error) {
        return res.status(400).json({
          success: false,
          error_code: 'INVALID_ORDER_ITEMS',
          message: processed.error
        });
      }
      updatedItems = processed.items;
      subtotal = processed.subtotal;
    }

    order.items = updatedItems;
    order.items_count = updatedItems.reduce((s, it) => s + it.quantity, 0);
    order.subtotal = subtotal;
    order.total = subtotal + (order.tax || 0);
    if (notes !== undefined) {
      order.notes = notes ? notes.trim() : undefined;
    }
    order.version += 1;
    order.updated_at = new Date().toISOString();

    const saved = db.saveTableOrder(order, 'Customer');

    db.addAuditLog('customer', 'CUSTOMER', 'ORDER_UPDATED', 'table_order', order.id, {
      order_number: order.public_order_number,
      version: order.version,
      total: order.total
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formatted = formatOrderResponse(saved, host, protocol);

    return res.json({
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      order: formatted,
      data: formatted
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

router.patch('/token/:token', handleUpdateOrderByToken);

/**
 * POST /api/orders/:token/cancel & /api/menu/public/orders/:token/cancel
 * Customer cancels order before waiter confirmation.
 */
export const handleCancelOrderByToken = (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    const order = db.getTableOrderByToken(token);
    if (!order) {
      return res.status(404).json({
        success: false,
        error_code: 'ORDER_NOT_FOUND',
        message: 'الطلب غير موجود.'
      });
    }

    if (order.status !== 'WAITING_WAITER') {
      return res.status(409).json({
        success: false,
        error_code: 'CANNOT_CANCEL_ORDER',
        message: `لا يمكن إلغاء الطلب من هاتفك لأنه في حالة (${order.status}). يرجى إبلاغ النادل مباشرة.`
      });
    }

    order.status = 'CANCELLED';
    order.cancelled_at = new Date().toISOString();
    order.cancellation_reason = reason || 'إلغاء من قبل الزبون قبل التأكيد';
    order.updated_at = new Date().toISOString();

    const saved = db.saveTableOrder(order, 'Customer');

    db.addAuditLog('customer', 'CUSTOMER', 'ORDER_CANCELLED', 'table_order', order.id, {
      order_number: order.public_order_number,
      reason: order.cancellation_reason
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formatted = formatOrderResponse(saved, host, protocol);

    return res.json({
      success: true,
      message: 'تم إلغاء الطلب بنجاح',
      order: formatted,
      data: formatted
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

router.post('/token/:token/cancel', handleCancelOrderByToken);

// =========================================================================
// 3. WAITER QR SCAN & CONFIRMATION (DZPOS Integration Flow)
// =========================================================================

/**
 * POST /api/orders/scan, /api/orders/verify, /api/orders/qr/scan
 * DZPOS Waiter App scans the QR displayed on customer's phone or table.
 * Returns full order snapshot for waiter review and validation.
 */
router.post(['/scan', '/verify', '/qr/scan', '/qr'], (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    const rawInput =
      body.token ||
      body.code ||
      body.qr ||
      body.url ||
      body.data ||
      body.text ||
      body.scanned ||
      body.payload ||
      body.qr_code ||
      body.order_id ||
      body.order_number ||
      body.id ||
      body.barcode ||
      query.token ||
      query.code ||
      query.qr ||
      query.url ||
      '';

    let order = db.getTableOrderByToken(String(rawInput));

    if (!order && (body.order_number || query.order_number)) {
      order = db.getTableOrderByNumber(String(body.order_number || query.order_number));
    }
    if (!order && (body.order_id || query.order_id || body.id)) {
      order = db.getTableOrderById(String(body.order_id || query.order_id || body.id));
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error_code: 'ORDER_NOT_FOUND',
        message: 'لم يتم العثور على طلب معلق لهذا الرمز. يرجى التأكد من مسح رمز QR الصحيح.'
      });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formatted = formatOrderResponse(order, host, protocol);

    db.addAuditLog('waiter', 'WAITER', 'ORDER_QR_SCANNED', 'table_order', order.id, {
      order_number: order.public_order_number,
      table_code: order.table_code,
      status: order.status,
      version: order.version
    });

    return res.json({
      success: true,
      order: formatted,
      data: formatted,
      can_confirm: order.status === 'WAITING_WAITER',
      message: order.status === 'WAITING_WAITER'
        ? 'الطلب جاهز للتأكيد والإرسال للمطبخ'
        : `الطلب في حالة (${order.status})`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/orders/:id/confirm & /api/orders/confirm
 * Waiter confirms customer order on POS.
 * Atomic state transition: WAITING_WAITER -> CONFIRMED.
 */
export const handleConfirmOrder = (req: Request, res: Response) => {
  try {
    const paramId = req.params.id;
    const body = req.body || {};
    const {
      order_id,
      token,
      code,
      qr,
      waiter_name,
      device_id,
      notes
    } = body as OrderConfirmRequest & { code?: string; qr?: string };

    const targetId = paramId || order_id || body.id;
    let order: TableOrder | undefined;

    if (targetId) {
      order = db.getTableOrderById(targetId) || db.getTableOrderByToken(targetId);
    }
    if (!order && (token || code || qr)) {
      order = db.getTableOrderByToken(token || code || qr || '');
    }
    if (!order && body.order_number) {
      order = db.getTableOrderByNumber(body.order_number);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error_code: 'ORDER_NOT_FOUND',
        message: 'الطلب غير موجود.'
      });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';

    // Idempotent check: if already confirmed or advanced, return success safely
    if (order.status === 'CONFIRMED' || order.status === 'SENT_TO_KITCHEN' || order.status === 'COMPLETED') {
      const formatted = formatOrderResponse(order, host, protocol);
      return res.json({
        success: true,
        order: formatted,
        data: formatted,
        already_confirmed: true,
        message: `تم تأكيد هذا الطلب مسبقاً وهو الآن في حالة (${order.status})`
      });
    }

    if (order.status === 'CANCELLED') {
      return res.status(409).json({
        success: false,
        error_code: 'ORDER_CANCELLED',
        message: 'لا يمكن تأكيد طلب تم إلغاؤه.'
      });
    }

    const now = new Date().toISOString();
    order.status = 'CONFIRMED';
    order.confirmed_at = now;
    order.confirmed_by = waiter_name || 'DZPOS Waiter';
    if (device_id) order.device_id = device_id;
    if (notes) order.notes = (order.notes ? `${order.notes} | ` : '') + notes.trim();
    order.updated_at = now;

    const saved = db.saveTableOrder(order, waiter_name || 'DZPOS Waiter');

    db.addAuditLog(waiter_name || 'waiter', 'WAITER', 'ORDER_CONFIRMED', 'table_order', order.id, {
      order_number: order.public_order_number,
      table_code: order.table_code,
      confirmed_by: order.confirmed_by,
      total: order.total
    });

    const formatted = formatOrderResponse(saved, host, protocol);

    return res.json({
      success: true,
      order: formatted,
      data: formatted,
      message: 'تم تأكيد الطلب بنجاح وجاهز للإرسال إلى المطبخ والطباعة'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

router.post('/:id/confirm', handleConfirmOrder);
router.post('/confirm', handleConfirmOrder);

/**
 * POST /api/orders/:id/kitchen & /api/orders/:id/dispatch
 * Transition order from CONFIRMED -> SENT_TO_KITCHEN.
 */
router.post(['/:id/kitchen', '/:id/dispatch'], (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dispatched_by, printer_name } = req.body;

    const order = db.getTableOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    if (order.status === 'SENT_TO_KITCHEN' || order.status === 'COMPLETED') {
      return res.json({
        success: true,
        order,
        message: `الطلب تم إرساله للمطبخ مسبقاً (${order.status})`
      });
    }

    if (order.status !== 'CONFIRMED' && order.status !== 'WAITING_WAITER') {
      return res.status(409).json({
        success: false,
        error_code: 'INVALID_STATE_TRANSITION',
        message: `لا يمكن إرسال الطلب للمطبخ من حالة (${order.status})`
      });
    }

    const now = new Date().toISOString();
    order.status = 'SENT_TO_KITCHEN';
    order.sent_to_kitchen_at = now;
    order.updated_at = now;

    const saved = db.saveTableOrder(order, dispatched_by || 'Kitchen Dispatcher');

    db.addAuditLog(dispatched_by || 'pos', 'POS', 'ORDER_SENT_TO_KITCHEN', 'table_order', order.id, {
      order_number: order.public_order_number,
      printer: printer_name
    });

    return res.json({
      success: true,
      message: 'تم إرسال الطلب إلى المطبخ بنجاح',
      order: saved
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/orders/:id/complete
 * Mark order as completed / paid.
 */
router.post('/:id/complete', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { completed_by } = req.body;

    const order = db.getTableOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    if (order.status === 'COMPLETED') {
      return res.json({ success: true, order, message: 'الطلب مكتمل مسبقاً' });
    }

    const now = new Date().toISOString();
    order.status = 'COMPLETED';
    order.completed_at = now;
    order.updated_at = now;

    const saved = db.saveTableOrder(order, completed_by || 'Cashier');

    db.addAuditLog(completed_by || 'pos', 'POS', 'ORDER_COMPLETED', 'table_order', order.id, {
      order_number: order.public_order_number,
      total: order.total
    });

    return res.json({
      success: true,
      message: 'تم إكمال الطلب بنجاح',
      order: saved
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/orders/:id/cancel
 * Cancel order with reason.
 */
router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, cancelled_by } = req.body;

    const order = db.getTableOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    if (order.status === 'COMPLETED') {
      return res.status(409).json({
        success: false,
        error_code: 'CANNOT_CANCEL_COMPLETED',
        message: 'لا يمكن إلغاء طلب مكتمل.'
      });
    }

    const now = new Date().toISOString();
    order.status = 'CANCELLED';
    order.cancelled_at = now;
    order.cancellation_reason = reason || 'إلغاء من قبل إدارة المطعم';
    order.updated_at = now;

    const saved = db.saveTableOrder(order, cancelled_by || 'POS');

    db.addAuditLog(cancelled_by || 'pos', 'POS', 'ORDER_CANCELLED', 'table_order', order.id, {
      order_number: order.public_order_number,
      reason: order.cancellation_reason
    });

    return res.json({
      success: true,
      message: 'تم إلغاء الطلب بنجاح',
      order: saved
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 4. DZPOS SYNC & LIVE PENDING POLLING ENDPOINTS
// =========================================================================

/**
 * GET /api/orders/pending & /api/orders/pending/:slug
 * Retrieve all active orders awaiting waiter or kitchen processing.
 * Fast polling endpoint for DZPOS terminal alerts.
 */
export const handlePendingOrders = (req: Request, res: Response) => {
  try {
    const { rawIdentifier } = extractStoreIdentifier(req);
    const tableCode = (req.query.table || req.query.table_code || req.query.table_number) as string;
    const reqStatus = (req.query.status as string) || '';

    // If identifier is given (license or slug), find orders matching license_key, restaurant_slug, or restaurant_id
    let orders: TableOrder[] = [];
    if (rawIdentifier) {
      orders = db.getTableOrders(rawIdentifier);
      // If none found by raw identifier, check if it's a slug for a menu with a license
      if (orders.length === 0) {
        const menu = db.getRestaurantMenuBySlug(rawIdentifier) || db.getRestaurantMenuByLicenseKey(rawIdentifier);
        if (menu) {
          orders = db.getTableOrders(menu.license_key || menu.public_slug || menu.id);
        }
      }
    } else {
      orders = db.getTableOrders();
    }

    // Filter active statuses using universal status matcher
    if (reqStatus && reqStatus.toUpperCase() !== 'ALL') {
      orders = orders.filter(o => db.matchOrderStatus(o.status, reqStatus));
    } else {
      orders = orders.filter(
        o => o.status === 'WAITING_WAITER' || o.status === 'CONFIRMED' || o.status === 'SENT_TO_KITCHEN' || o.status === 'DRAFT'
      );
    }

    if (tableCode) {
      const cleanTable = tableCode.trim().toUpperCase();
      orders = orders.filter(
        o => (o.table_code || '').toUpperCase() === cleanTable || (o.table_number || '').toUpperCase() === cleanTable
      );
    }

    // Sort by latest first
    orders.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formattedOrders = orders.map(o => formatOrderResponse(o, host, protocol));

    const waitingWaiterCount = formattedOrders.filter(o => o.status === 'WAITING_WAITER').length;
    const confirmedCount = formattedOrders.filter(o => o.status === 'CONFIRMED').length;
    const kitchenCount = formattedOrders.filter(o => o.status === 'SENT_TO_KITCHEN').length;

    const responsePayload = {
      success: true,
      orders: formattedOrders,
      data: formattedOrders,
      items: formattedOrders,
      table_orders: formattedOrders,
      total_pending: formattedOrders.length,
      total: formattedOrders.length,
      count: formattedOrders.length,
      waiting_waiter_count: waitingWaiterCount,
      confirmed_count: confirmedCount,
      kitchen_count: kitchenCount,
      server_time: new Date().toISOString()
    };

    // Diagnostic log for pending orders
    console.log(`[PENDING_ORDERS_RAW_RESPONSE]
HTTP_STATUS=200
BODY=${JSON.stringify({
  success: true,
  count: formattedOrders.length,
  orders_summary: formattedOrders.map(o => ({
    id: o.id,
    order_number: o.public_order_number,
    status: o.status,
    order_status: o.order_status,
    table_name: o.table_name,
    license_key: o.license_key,
    created_at: o.created_at
  }))
})}`);

    return res.json(responsePayload);
  } catch (error: any) {
    console.error('[Orders API] Error fetching pending orders:', error);
    return res.status(500).json({ success: false, message: error.message, orders: [], data: [] });
  }
};

/**
 * GET /api/orders/debug/pending
 * Diagnostic Endpoint to inspect pending table orders status and synchronization state
 */
export const handleDebugPendingOrders = (req: Request, res: Response) => {
  try {
    const { licenseKey, slug, rawIdentifier } = extractStoreIdentifier(req);
    const allDbOrders = db.getTableOrders();
    const matchedOrders = db.getTableOrders(rawIdentifier);
    const pendingOrders = matchedOrders.filter(o => db.matchOrderStatus(o.status, 'PENDING'));

    const latestOrders = allDbOrders.slice(0, 20).map(o => ({
      order_id: o.id,
      order_number: o.public_order_number,
      status: o.status,
      store_id: o.license_key || o.restaurant_id,
      restaurant_id: o.restaurant_id,
      license_id: o.license_key,
      table_id: o.table_id || o.table_code,
      table_name: o.table_name,
      created_at: o.created_at
    }));

    return res.json({
      databaseOrders: allDbOrders.length,
      pendingOrders: pendingOrders.length,
      matchedOrders: matchedOrders.length,
      storeId: licenseKey || slug || 'all',
      restaurantId: slug || 'all',
      licenseId: licenseKey || 'all',
      rawIdentifier: rawIdentifier || 'none',
      latestOrders
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/orders/sync
 * Incremental sync endpoint for DZPOS Desktop & POS Clients.
 * Fetches all orders created or modified since `since` timestamp.
 */
export const handleSyncOrders = (req: Request, res: Response) => {
  try {
    const { rawIdentifier } = extractStoreIdentifier(req);
    const since = (req.query.since || req.query.from || req.query.last_sync) as string;
    const status = req.query.status as string;

    let orders = db.getTableOrders(rawIdentifier, status);
    if (orders.length === 0 && rawIdentifier) {
      const menu = db.getRestaurantMenuBySlug(rawIdentifier) || db.getRestaurantMenuByLicenseKey(rawIdentifier);
      if (menu) {
        orders = db.getTableOrders(menu.license_key || menu.public_slug || menu.id, status);
      }
    }

    if (since) {
      const sinceDate = new Date(since).getTime();
      if (!isNaN(sinceDate)) {
        orders = orders.filter(o => {
          const updatedTime = new Date(o.updated_at || o.created_at).getTime();
          return updatedTime >= sinceDate;
        });
      }
    }

    orders.sort((a, b) => new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime());

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formattedOrders = orders.map(o => formatOrderResponse(o, host, protocol));

    const response: OrderSyncResponse = {
      success: true,
      orders: formattedOrders,
      total: formattedOrders.length,
      server_time: new Date().toISOString(),
      cursor: formattedOrders.length > 0 ? (formattedOrders[0].updated_at || formattedOrders[0].created_at) : undefined
    };

    return res.json({
      ...response,
      data: formattedOrders,
      items: formattedOrders,
      table_orders: formattedOrders,
      count: formattedOrders.length
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message, orders: [], data: [] });
  }
};

/**
 * GET /api/orders
 * List orders with optional filters (admin, cashier, or POS).
 */
export const handleListOrders = (req: Request, res: Response) => {
  try {
    const { rawIdentifier } = extractStoreIdentifier(req);
    const status = req.query.status as TableOrderStatus;
    const tableCode = (req.query.table || req.query.table_code || req.query.table_number) as string;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    let orders = db.getTableOrders(rawIdentifier, status);
    if (orders.length === 0 && rawIdentifier) {
      const menu = db.getRestaurantMenuBySlug(rawIdentifier) || db.getRestaurantMenuByLicenseKey(rawIdentifier);
      if (menu) {
        orders = db.getTableOrders(menu.license_key || menu.public_slug || menu.id, status);
      }
    }

    if (tableCode) {
      const cleanTable = tableCode.trim().toUpperCase();
      orders = orders.filter(o => (o.table_code || '').toUpperCase() === cleanTable || (o.table_number || '').toUpperCase() === cleanTable);
    }

    orders.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formattedOrders = orders.map(o => formatOrderResponse(o, host, protocol));

    const total = formattedOrders.length;
    const paginated = formattedOrders.slice(0, limit);

    return res.json({
      success: true,
      orders: paginated,
      data: paginated,
      items: paginated,
      table_orders: paginated,
      total,
      count: paginated.length,
      limit,
      server_time: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message, orders: [], data: [] });
  }
};

/**
 * GET /api/orders/:id
 * Single order lookup by ID.
 */
export const handleGetOrderById = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = db.getTableOrderById(id) || db.getTableOrderByToken(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error_code: 'ORDER_NOT_FOUND',
        message: 'الطلب غير موجود.'
      });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const formatted = formatOrderResponse(order, host, protocol);

    return res.json({
      success: true,
      order: formatted,
      data: formatted,
      server_time: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/stream & /api/orders/live/stream
 * Server-Sent Events (SSE) for 0ms latency real-time table order synchronization.
 */
export const handleStreamOrders = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const { rawIdentifier } = extractStoreIdentifier(req);
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';

  // Send initial connected event + current pending orders
  const initialPending = db.getTableOrders(rawIdentifier, 'PENDING');
  const formattedInitial = initialPending.map(o => formatOrderResponse(o, host, protocol));

  res.write(`event: connected\ndata: ${JSON.stringify({
    status: 'connected',
    time: new Date().toISOString(),
    store: rawIdentifier || 'all',
    pending_count: formattedInitial.length
  })}\n\n`);

  res.write(`event: initial_sync\ndata: ${JSON.stringify({
    orders: formattedInitial,
    total: formattedInitial.length
  })}\n\n`);

  // Listener for table order mutations
  const onOrderChanged = (evt: { order: TableOrder; action: string; actor: string }) => {
    try {
      const order = evt.order;
      if (rawIdentifier) {
        const cleanIdent = rawIdentifier.trim().toUpperCase();
        const matches =
          (order.license_key || '').toUpperCase() === cleanIdent ||
          (order.restaurant_id || '').toUpperCase() === cleanIdent ||
          (order.restaurant_slug || '').toUpperCase() === cleanIdent;
        if (!matches) return;
      }

      const formatted = formatOrderResponse(order, host, protocol);
      res.write(`event: order_update\ndata: ${JSON.stringify({
        action: evt.action,
        order: formatted,
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (err) {
      console.error('SSE order change push error:', err);
    }
  };

  const onOrderDeleted = (evt: { orderId: string; order?: TableOrder; actor: string }) => {
    try {
      res.write(`event: order_deleted\ndata: ${JSON.stringify({
        order_id: evt.orderId,
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (err) {
      console.error('SSE order delete push error:', err);
    }
  };

  db.emitter.on('table_order_changed', onOrderChanged);
  db.emitter.on('table_order_deleted', onOrderDeleted);

  // Heartbeat every 20 seconds to keep connection open through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    db.emitter.off('table_order_changed', onOrderChanged);
    db.emitter.off('table_order_deleted', onOrderDeleted);
  });
};

// Route Registrations
router.get('/stream', handleStreamOrders);
router.get('/live/stream', handleStreamOrders);
router.get('/events', handleStreamOrders);
router.get('/debug/pending', handleDebugPendingOrders);
router.get('/pending', handlePendingOrders);
router.get('/pending/:slug', handlePendingOrders);
router.get('/live', handlePendingOrders);
router.get('/table-orders', handleListOrders);
router.get('/table_orders', handleListOrders);
router.get('/table-orders/pending', handlePendingOrders);
router.get('/table_orders/pending', handlePendingOrders);
router.get('/table-orders/sync', handleSyncOrders);
router.get('/table_orders/sync', handleSyncOrders);
router.get('/sync', handleSyncOrders);
router.get('/', handleListOrders);
router.get('/:id', handleGetOrderById);
router.post('/create', handleCreateOrder);
router.post('/', handleCreateOrder);

export default router;
