import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import {
  handleCreateOrder,
  handleGetOrderByToken,
  handleUpdateOrderByToken,
  handleCancelOrderByToken
} from './orders.js';
import {
  MenuPublishRequest,
  MenuPublishResponse,
  PublicMenuResponse,
  RestaurantMenu,
  MenuTable,
  PublishedMenuSnapshot
} from '../../src/types/dzpos.js';
import {
  matchDishToInternetImage,
  getServerRestaurantCoverImage,
  getServerRestaurantLogoImage
} from '../services/foodImages.js';

const router = express.Router();

/**
 * Helper to compute SHA-256 checksum of payload
 */
function computeChecksum(data: any): string {
  const normalized = JSON.stringify(data);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Helper to normalize image URLs to relative paths, guaranteed storage paths, or intelligent internet food fallbacks
 */
function normalizeMenuImageUrl(rawUrl?: string, productName?: string, productId?: string, categoryName?: string): string {
  if (!rawUrl || rawUrl.trim() === '' || rawUrl.includes('placeholder')) {
    return matchDishToInternetImage(productName, categoryName);
  }

  let cleaned = rawUrl.trim();
  // Strip origin if pointing to any dzpos domain or localhost
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const parsed = new URL(cleaned);
      if (parsed.pathname.startsWith('/storage/') || parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/images/')) {
        return parsed.pathname;
      }
    } catch {
      // ignore
    }
  }

  // If plain filename like "product_image_123.jpg"
  if (!cleaned.startsWith('/') && !cleaned.startsWith('data:') && !cleaned.startsWith('http')) {
    return `/storage/products/${encodeURIComponent(cleaned)}`;
  }

  return cleaned;
}

/**
 * Helper to normalize and sanitize slug
 */
function sanitizeSlug(raw: string, fallback: string): string {
  if (!raw) raw = fallback;
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^\w\u0600-\u06FF\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/\-+/g, '-')
    .replace(/^-+|-+$/g, '') || `resto-${Date.now().toString(36)}`;
}

// =========================================================================
// 1. POS SYNC & PUBLISHING ENDPOINTS (Used by DZPOS Desktop/Mobile App)
// =========================================================================

/**
 * POST /api/menu/publish
 * Idempotent, offline-first menu publishing endpoint.
 * Called by DZPOS application when the cashier/manager clicks "Publish Table Menu".
 */
router.post('/publish', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const licenseKeyHeader = req.headers['x-license-key'] as string;
    const deviceIdHeader = (req.headers['x-device-id'] as string) || req.body?.snapshot?.device_id;

    // Extract license key
    let licenseKey = licenseKeyHeader;
    if (!licenseKey && authHeader.startsWith('Bearer ')) {
      licenseKey = authHeader.substring(7).trim();
    }
    if (!licenseKey && req.body.license_key) {
      licenseKey = req.body.license_key;
    }

    if (!licenseKey) {
      return res.status(401).json({
        success: false,
        error_code: 'UNAUTHORIZED',
        message: 'License key is required in Authorization header or x-license-key header.'
      });
    }

    const cleanLicenseKey = licenseKey.trim().toUpperCase();
    const license = db.getLicenseByKey(cleanLicenseKey);

    if (!license) {
      return res.status(403).json({
        success: false,
        error_code: 'LICENSE_NOT_FOUND',
        message: 'Invalid license key. Menu publishing requires an active DZPOS license.'
      });
    }

    if (license.status === 'revoked' || license.status === 'expired') {
      return res.status(403).json({
        success: false,
        error_code: 'LICENSE_EXPIRED',
        message: `License is ${license.status}. Please renew your DZPOS subscription to publish the table menu.`
      });
    }

    const payload: MenuPublishRequest = req.body;
    const incomingCategories = payload.categories || payload.snapshot?.categories || [];
    const incomingProducts = payload.products || payload.snapshot?.products || [];

    if (!Array.isArray(incomingCategories) || !Array.isArray(incomingProducts)) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_MENU_PAYLOAD',
        message: 'Missing or invalid menu payload (categories and products arrays are required).'
      });
    }

    const existingMenu = db.getRestaurantMenuByLicenseKey(cleanLicenseKey);
    const now = new Date().toISOString();

    const rawSnapshot = {
      categories: incomingCategories,
      products: incomingProducts
    };

    // Compute checksum
    const snapshotChecksum = computeChecksum(rawSnapshot);

    // If checksum matches existing active menu and no table updates requested, return idempotent success
    if (existingMenu && existingMenu.checksum_sha256 === snapshotChecksum && !payload.tables) {
      const currentTables = db.getMenuTables(existingMenu.id);
      return res.json({
        success: true,
        menu_id: existingMenu.id,
        public_slug: existingMenu.public_slug,
        revision: existingMenu.revision,
        checksum_sha256: existingMenu.checksum_sha256,
        total_categories: existingMenu.snapshot.total_categories,
        total_products: existingMenu.snapshot.total_products,
        total_tables: currentTables.length,
        tables_count: currentTables.length,
        public_url: `/menu/${existingMenu.public_slug}`,
        public_menu_url: `/menu/${existingMenu.public_slug}`,
        published_at: existingMenu.last_published_at,
        last_published_at: existingMenu.last_published_at,
        tables: currentTables.map(t => ({
          id: t.id,
          table_number: t.table_number,
          table_code: t.table_code,
          zone: t.zone,
          qr_url: t.qr_url
        })),
        message: 'Menu snapshot is already up to date (idempotent match).'
      } as MenuPublishResponse);
    }

    // Determine restaurant info
    const info = payload.restaurant_info || {};
    const restaurantName = payload.restaurant_name || info.restaurant_name || existingMenu?.restaurant_name || license.customer_name || 'DZPOS Restaurant';
    const restaurantNameAr = payload.restaurant_name_ar || info.restaurant_name_ar || existingMenu?.restaurant_name_ar;
    const restaurantNameFr = payload.restaurant_name_fr || info.restaurant_name_fr || existingMenu?.restaurant_name_fr;
    const tagline = payload.tagline ?? info.tagline ?? existingMenu?.tagline ?? 'مرحباً بكم في مطعمنا';
    const description = payload.description ?? info.description ?? existingMenu?.description ?? '';
    const phone = payload.phone ?? info.phone ?? existingMenu?.phone ?? '';
    const whatsapp = payload.whatsapp ?? info.whatsapp ?? existingMenu?.whatsapp ?? '';
    const address = payload.address ?? info.address ?? existingMenu?.address ?? '';
    const city = payload.city ?? info.city ?? existingMenu?.city;
    const wilayaCode = payload.wilaya_code ?? info.wilaya_code ?? existingMenu?.wilaya_code;
    const logoUrl = payload.logo_url ?? info.logo_url ?? existingMenu?.logo_url;
    const coverUrl = payload.cover_url ?? info.cover_url ?? existingMenu?.cover_url;
    const wifiSsid = payload.wifi_ssid ?? info.wifi_ssid ?? existingMenu?.wifi_ssid;
    const wifiPassword = payload.wifi_password ?? info.wifi_password ?? existingMenu?.wifi_password;
    const themeColor = payload.theme_color ?? info.theme_color ?? existingMenu?.theme_color ?? '#E11D48';
    const openingHours = payload.opening_hours ?? info.opening_hours ?? existingMenu?.opening_hours;

    // Determine slug
    let requestedSlug = (payload.public_slug || existingMenu?.public_slug || restaurantName || license.customer_name || 'menu').trim();
    let finalSlug = sanitizeSlug(requestedSlug, `resto-${license.customer_id || cleanLicenseKey.toLowerCase()}`);

    // Check slug collision with other licenses
    const existingSlugOwner = db.getRestaurantMenuBySlug(finalSlug);
    if (existingSlugOwner && existingSlugOwner.license_key !== cleanLicenseKey) {
      finalSlug = `${finalSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const menuId = existingMenu ? existingMenu.id : `menu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const publicToken = existingMenu?.public_token || `tok_${crypto.randomBytes(8).toString('hex')}`;
    const nextRevision = (existingMenu?.revision || 0) + 1;

    const updatedSnapshot: PublishedMenuSnapshot = {
      published_at: now,
      total_categories: incomingCategories.length,
      total_products: incomingProducts.length,
      device_id: deviceIdHeader || payload.device_id || payload.snapshot?.device_id || 'POS-PRIMARY',
      app_version: payload.app_version || payload.snapshot?.app_version || 'v2.4.0',
      categories: incomingCategories.map((c, i) => ({
        ...c,
        sort_order: c.sort_order ?? i + 1,
        is_active: c.is_active !== false
      })),
      products: incomingProducts.map((p, i) => ({
        ...p,
        image_url: normalizeMenuImageUrl(p.image_url, p.name_ar || p.name, p.product_id || p.id, p.category_id || (p as any).category),
        sort_order: p.sort_order ?? i + 1,
        is_available: p.is_available !== false,
        price: Number(p.price) || 0
      }))
    };

    const restaurantMenu: RestaurantMenu = {
      id: menuId,
      customer_id: license.customer_id,
      license_key: cleanLicenseKey,
      restaurant_name: restaurantName,
      restaurant_name_ar: restaurantNameAr,
      restaurant_name_fr: restaurantNameFr,
      public_slug: finalSlug,
      public_token: publicToken,
      enabled: payload.enabled !== false,
      tagline,
      description,
      currency: payload.currency || existingMenu?.currency || 'DZD',
      currency_symbol: payload.currency_symbol || existingMenu?.currency_symbol || 'د.ج',
      phone,
      whatsapp,
      address,
      city,
      wilaya_code: wilayaCode,
      logo_url: logoUrl,
      cover_url: coverUrl,
      wifi_ssid: wifiSsid,
      wifi_password: wifiPassword,
      theme_color: themeColor,
      opening_hours: openingHours,
      revision: nextRevision,
      checksum_sha256: snapshotChecksum,
      last_published_at: now,
      created_at: existingMenu?.created_at || now,
      updated_at: now,
      tables_count: existingMenu?.tables_count || 0,
      snapshot: updatedSnapshot
    };

    // Save menu
    db.saveRestaurantMenu(restaurantMenu, `pos:${license.customer_name}`);

    // If tables provided in publish payload, save/update them
    if (Array.isArray(payload.tables) && payload.tables.length > 0) {
      payload.tables.forEach((t, idx) => {
        const tableCode = (t.table_code || t.table_number || `T${idx + 1}`).trim();
        const table: MenuTable = {
          id: t.id || `tbl_${menuId}_${tableCode}`,
          menu_id: menuId,
          license_key: cleanLicenseKey,
          table_number: t.table_number || tableCode,
          table_code: tableCode,
          label_ar: t.label_ar || `طاولة رقم ${t.table_number || tableCode}`,
          label_fr: t.label_fr || `Table ${t.table_number || tableCode}`,
          capacity: Number(t.capacity) || 4,
          zone: t.zone || 'الصالة الرئيسية',
          enabled: t.enabled !== false,
          qr_url: `/menu/${finalSlug}/table/${encodeURIComponent(tableCode)}`,
          created_at: now,
          updated_at: now
        };
        db.saveMenuTable(table, `pos:${license.customer_name}`);
      });
    }

    const currentTables = db.getMenuTables(menuId);
    restaurantMenu.tables_count = currentTables.length;

    return res.json({
      success: true,
      menu_id: menuId,
      public_slug: finalSlug,
      revision: nextRevision,
      checksum_sha256: snapshotChecksum,
      total_categories: updatedSnapshot.total_categories,
      total_products: updatedSnapshot.total_products,
      total_tables: currentTables.length,
      tables_count: currentTables.length,
      public_url: `/menu/${finalSlug}`,
      public_menu_url: `/menu/${finalSlug}`,
      published_at: now,
      last_published_at: now,
      tables: currentTables.map(t => ({
        id: t.id,
        table_number: t.table_number,
        table_code: t.table_code,
        zone: t.zone,
        qr_url: t.qr_url
      })),
      message: 'Menu published successfully to DZPOS Cloud Table Menu service.'
    } as MenuPublishResponse);
  } catch (error: any) {
    console.error('Error publishing menu:', error);
    return res.status(500).json({
      success: false,
      error_code: 'SERVER_ERROR',
      message: error.message || 'Failed to publish restaurant menu.'
    });
  }
});

/**
 * GET /api/menu/status
 * Check published menu status and sync info for a given license.
 */
router.get('/status', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const licenseKeyHeader = req.headers['x-license-key'] as string;
    let licenseKey = licenseKeyHeader || (authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : (req.query.license_key as string));

    if (!licenseKey) {
      return res.status(401).json({
        success: false,
        error_code: 'UNAUTHORIZED',
        message: 'License key required.'
      });
    }

    const cleanLicenseKey = licenseKey.trim().toUpperCase();
    const menu = db.getRestaurantMenuByLicenseKey(cleanLicenseKey);

    if (!menu) {
      return res.json({
        success: true,
        is_published: false,
        message: 'No published menu found for this license.'
      });
    }

    const tables = db.getMenuTables(menu.id);

    return res.json({
      success: true,
      is_published: true,
      menu: {
        id: menu.id,
        restaurant_name: menu.restaurant_name,
        public_slug: menu.public_slug,
        public_url: `/menu/${menu.public_slug}`,
        enabled: menu.enabled,
        revision: menu.revision,
        last_published_at: menu.last_published_at,
        total_categories: menu.snapshot.total_categories,
        total_products: menu.snapshot.total_products,
        tables_count: tables.length,
        tables: tables.map(t => ({
          id: t.id,
          table_number: t.table_number,
          table_code: t.table_code,
          label_ar: t.label_ar,
          zone: t.zone,
          capacity: t.capacity,
          enabled: t.enabled,
          qr_url: `/menu/${menu.public_slug}/table/${t.table_code}`
        }))
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 2. TABLE MANAGEMENT ENDPOINTS (DZPOS App + Admin UI)
// =========================================================================

/**
 * GET /api/menu/tables
 * List all tables for a specific menu/license.
 */
router.get('/tables', (req, res) => {
  try {
    const menuId = req.query.menu_id as string;
    const licenseKey = req.query.license_key as string;
    const tables = db.getMenuTables(menuId, licenseKey);
    return res.json({
      success: true,
      tables
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/menu/tables
 * Create or update a table in a restaurant menu.
 */
router.post('/tables', (req, res) => {
  try {
    const { menu_id, license_key, table_number, table_code, label_ar, label_fr, capacity, zone, enabled } = req.body;

    if (!menu_id && !license_key) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_PARAMETERS',
        message: 'menu_id or license_key is required.'
      });
    }

    let menu: RestaurantMenu | undefined;
    if (menu_id) {
      menu = db.getRestaurantMenuById(menu_id);
    } else if (license_key) {
      menu = db.getRestaurantMenuByLicenseKey(license_key);
    }

    if (!menu) {
      return res.status(404).json({
        success: false,
        error_code: 'MENU_NOT_FOUND',
        message: 'Associated restaurant menu not found.'
      });
    }

    const code = (table_code || table_number || `T${Date.now().toString(36)}`).trim();
    const now = new Date().toISOString();

    const table: MenuTable = {
      id: req.body.id || `tbl_${menu.id}_${code}`,
      menu_id: menu.id,
      license_key: menu.license_key,
      table_number: table_number || code,
      table_code: code,
      label_ar: label_ar || `طاولة رقم ${table_number || code}`,
      label_fr: label_fr || `Table ${table_number || code}`,
      capacity: Number(capacity) || 4,
      zone: zone || 'الصالة الرئيسية',
      enabled: enabled !== false,
      qr_url: `/menu/${menu.public_slug}/table/${encodeURIComponent(code)}`,
      created_at: req.body.created_at || now,
      updated_at: now
    };

    const saved = db.saveMenuTable(table, 'admin');

    return res.json({
      success: true,
      table: saved,
      message: 'Table saved successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/menu/tables/:tableId
 */
router.delete('/tables/:tableId', (req, res) => {
  try {
    const { tableId } = req.params;
    const deleted = db.deleteMenuTable(tableId, 'admin');
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error_code: 'TABLE_NOT_FOUND',
        message: 'Table not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Table deleted successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 3. PUBLIC MENU ENDPOINTS (Zero Auth - For Customers Scanning QR Codes)
// =========================================================================

/**
 * GET /api/public/menu/:slug
 * Open public menu endpoint consumed by customer smartphones.
 */
router.get('/public/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const tableParam = req.query.table as string;

    const menu = db.getRestaurantMenuBySlug(slug);

    if (!menu) {
      return res.status(404).json({
        success: false,
        error_code: 'MENU_NOT_FOUND',
        message: 'المينو غير موجود أو تم تغيير الرابط.'
      });
    }

    if (!menu.enabled) {
      return res.status(403).json({
        success: false,
        error_code: 'MENU_DISABLED',
        message: 'هذا المينو غير مفعل حالياً من قبل إدارة المطعم.'
      });
    }

    // Resolve table if requested
    let matchedTable: MenuTable | undefined;
    if (tableParam) {
      matchedTable = db.getMenuTableByCode(menu.id, tableParam);
    }

    // Prepare response structure
    const response: PublicMenuResponse = {
      success: true,
      restaurant: {
        id: menu.id,
        name: menu.restaurant_name,
        name_ar: menu.restaurant_name_ar,
        name_fr: menu.restaurant_name_fr,
        tagline: menu.tagline,
        description: menu.description,
        logo_url: getServerRestaurantLogoImage(menu.logo_url, menu.restaurant_name || menu.id),
        cover_url: getServerRestaurantCoverImage(menu.cover_url, menu.restaurant_name || menu.id),
        phone: menu.phone,
        whatsapp: menu.whatsapp,
        address: menu.address,
        city: menu.city,
        wilaya_code: menu.wilaya_code,
        currency: menu.currency,
        currency_symbol: menu.currency_symbol,
        wifi_ssid: menu.wifi_ssid,
        wifi_password: menu.wifi_password,
        theme_color: menu.theme_color,
        opening_hours: menu.opening_hours
      },
      table: matchedTable ? {
        table_number: matchedTable.table_number,
        table_code: matchedTable.table_code,
        label_ar: matchedTable.label_ar,
        zone: matchedTable.zone,
        capacity: matchedTable.capacity
      } : undefined,
      snapshot: {
        published_at: menu.snapshot.published_at,
        total_categories: menu.snapshot.total_categories,
        total_products: menu.snapshot.total_products,
        categories: (menu.snapshot.categories || [])
          .filter(c => c.is_active !== false)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        products: (menu.snapshot.products || [])
          .filter(p => p.is_available !== false)
          .map(p => ({
            ...p,
            image_url: normalizeMenuImageUrl(p.image_url, p.name_ar || p.name, p.product_id || p.id, p.category_id || (p as any).category)
          }))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      },
      metadata: {
        revision: menu.revision,
        last_updated: menu.updated_at,
        server_time: new Date().toISOString()
      }
    };

    // Cache control for fast loading on cellular networks
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    return res.json(response);
  } catch (error: any) {
    console.error('Error fetching public menu:', error);
    return res.status(500).json({
      success: false,
      error_code: 'SERVER_ERROR',
      message: 'تعذر تحميل المينو في الوقت الحالي.'
    });
  }
});

/**
 * GET /api/public/menu/:slug/table/:tableCode
 * Public direct route for a specific table QR scan.
 */
router.get('/public/:slug/table/:tableCode', (req, res) => {
  const { slug, tableCode } = req.params;
  req.query.table = tableCode;
  // Forward to standard handler
  return (router as any).handle(
    Object.assign(req, { url: `/public/${slug}?table=${encodeURIComponent(tableCode)}` }),
    res
  );
});

/**
 * POST /api/menu/public/:slug/orders & /api/menu/public/:slug/order
 * Customer creates an order from the digital table menu.
 */
router.post('/public/:slug/orders', handleCreateOrder);
router.post('/public/:slug/order', handleCreateOrder);

/**
 * GET /api/menu/public/orders/:token
 * Live customer status polling.
 */
router.get('/public/orders/:token', handleGetOrderByToken);

/**
 * PATCH /api/menu/public/orders/:token
 * Customer edits order before waiter confirmation.
 */
router.patch('/public/orders/:token', handleUpdateOrderByToken);

/**
 * POST /api/menu/public/orders/:token/cancel
 * Customer cancels order before waiter confirmation.
 */
router.post('/public/orders/:token/cancel', handleCancelOrderByToken);

// =========================================================================
// 4. CENTRAL ADMIN ENDPOINTS
// =========================================================================

/**
 * GET /api/menu/admin/orders
 * Admin list of table orders.
 */
router.get('/admin/orders', (req, res) => {
  try {
    const licenseKey = req.query.license_key as string;
    const status = req.query.status as any;
    const orders = db.getTableOrders(licenseKey, status);
    return res.json({
      success: true,
      orders,
      total: orders.length
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/menu/admin/list
 * Admin overview of all published menus.
 */
router.get('/admin/list', (req, res) => {
  try {
    const menus = db.getRestaurantMenus();
    const tables = db.getMenuTables();

    const formatted = menus.map(m => {
      const menuTables = tables.filter(t => t.menu_id === m.id);
      return {
        id: m.id,
        customer_id: m.customer_id,
        license_key: m.license_key,
        restaurant_name: m.restaurant_name,
        public_slug: m.public_slug,
        enabled: m.enabled,
        revision: m.revision,
        tables_count: menuTables.length,
        categories_count: m.snapshot?.categories?.length || 0,
        products_count: m.snapshot?.products?.length || 0,
        last_published_at: m.last_published_at,
        created_at: m.created_at,
        public_url: `/menu/${m.public_slug}`
      };
    });

    return res.json({
      success: true,
      menus: formatted,
      total: formatted.length
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/menu/admin/:id/toggle
 * Toggle enabled state of a menu.
 */
router.patch('/admin/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const menu = db.getRestaurantMenuById(id);
    if (!menu) {
      return res.status(404).json({ success: false, message: 'Menu not found' });
    }

    menu.enabled = !menu.enabled;
    db.saveRestaurantMenu(menu, 'admin_toggle');

    return res.json({
      success: true,
      enabled: menu.enabled,
      message: `Menu is now ${menu.enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/menu/admin/:id
 */
router.delete('/admin/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteRestaurantMenu(id, 'admin');
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Menu not found' });
    }
    return res.json({ success: true, message: 'Menu deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
