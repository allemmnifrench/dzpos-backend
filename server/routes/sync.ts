import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db, computeSha256 } from '../db.js';
import { apiError } from '../middleware/auth.js';
import { SyncCheckRequest, SyncCheckResponse, Product } from '../../src/types/dzpos.js';
import { processZipBackup } from '../services/zipImporter.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const router = Router();

/**
 * Universal Activity Code Resolver & Normalizer
 * Maps all synonyms, Arabic titles, and category codes to standard activity identifiers
 */
export function normalizeActivityCode(inputCode?: any): string {
  if (!inputCode) return 'grocery';
  const str = String(inputCode).trim();
  if (!str) return 'grocery';

  // 1. Check Arabic designations
  if (str.includes('بيتزا') || str.includes('طاكوس') || str.includes('مطعم') || str.includes('مطاعم') || str.includes('أكلات سريعة') || str.includes('مقهى') || str.includes('برغر') || str.includes('ساندويتش') || str.includes('كافيتيريا')) {
    return 'restaurant';
  }
  if (str.includes('بقالة') || str.includes('تغذية') || str.includes('مواد غذائية') || str.includes('سوبرات') || str.includes('سوبرماركت')) {
    return 'grocery';
  }
  if (str.includes('خردوات') || str.includes('عقاقير') || str.includes('بناء') || str.includes('دروغري') || str.includes('دهانات')) {
    return 'hardware';
  }
  if (str.includes('ملابس') || str.includes('أحذية') || str.includes('أزياء') || str.includes('ألبسة') || str.includes('بوتيك')) {
    return 'clothing';
  }
  if (str.includes('عطور') || str.includes('تجميل') || str.includes('عناية') || str.includes('كوسميتيك')) {
    return 'cosmetics';
  }
  if (str.includes('صيدلية') || str.includes('شبه صيدلاني') || str.includes('أدوية') || str.includes('فارماسي')) {
    return 'pharmacy';
  }
  if (str.includes('مخبزة') || str.includes('حلويات') || str.includes('باتيسري') || str.includes('مرطبات')) {
    return 'bakery';
  }
  if (str.includes('جملة') || str.includes('توزيع') || str.includes('موزع') || str.includes('مستودع')) {
    return 'wholesale';
  }
  if (str.includes('كهرومنزلية') || str.includes('هواتف') || str.includes('أجهزة') || str.includes('إلكترونيك')) {
    return 'appliances';
  }
  if (str.includes('مكتبة') || str.includes('قرطاسية') || str.includes('أدوات مدرسية') || str.includes('كتب')) {
    return 'bookstore';
  }
  if (str.includes('تجزئة') || str.includes('محلات') || str.includes('متجر') || str.includes('بزار')) {
    return 'retail';
  }

  // 2. Clean Latin string & synonyms
  const clean = str.toLowerCase().replace(/^act_/, '').replace(/[^a-z0-9_]/g, '');

  if (['restaurant', 'resto', 'restau', 'fastfood', 'fast_food', 'food', 'pizza', 'pizzeria', 'tacos', 'burger', 'burgers', 'sandwich', 'creperie', 'cafe', 'cafeteria', 'coffee'].includes(clean)) {
    return 'restaurant';
  }
  if (['grocery', 'epicerie', 'superette', 'alimentation', 'alimentation_generale', 'food_store', 'supermarket'].includes(clean)) {
    return 'grocery';
  }
  if (['hardware', 'quincaillerie', 'droguerie', 'outillage', 'bricolage', 'batiment', 'materiaux'].includes(clean)) {
    return 'hardware';
  }
  if (['retail', 'commerce', 'detail', 'magasin', 'store', 'bazar', 'general', 'market'].includes(clean)) {
    return 'retail';
  }
  if (['clothing', 'vetement', 'vetements', 'habits', 'mode', 'fashion', 'chaussures', 'shoes', 'boutique'].includes(clean)) {
    return 'clothing';
  }
  if (['cosmetics', 'cosmetique', 'parfumerie', 'beaute', 'parfum', 'beauty'].includes(clean)) {
    return 'cosmetics';
  }
  if (['pharmacy', 'pharmacie', 'parapharmacie', 'medicaments', 'sante', 'medical'].includes(clean)) {
    return 'pharmacy';
  }
  if (['bakery', 'boulangerie', 'patisserie', 'gateaux', 'pain'].includes(clean)) {
    return 'bakery';
  }
  if (['wholesale', 'gros', 'commerce_gros', 'distributeur', 'depot'].includes(clean)) {
    return 'wholesale';
  }
  if (['appliances', 'electromenager', 'telephonie', 'electronique', 'phones', 'tech', 'informatique'].includes(clean)) {
    return 'appliances';
  }
  if (['bookstore', 'librairie', 'papeterie', 'bureautique', 'fournitures', 'livres'].includes(clean)) {
    return 'bookstore';
  }

  // Check against known activities in DB
  const act = db.getActivities().find(a => a.code === clean || a.id === `act_${clean}`);
  if (act) return act.code;

  return clean || 'grocery';
}

// Helper to resolve full absolute image URLs
export function formatImageUrl(rawImg: any, host: string = 'localhost:3000', protocol: string = 'https'): string {
  if (!rawImg || typeof rawImg !== 'string') return '';
  const trimmed = rawImg.trim();
  if (!trimmed) return '';

  // If Data URI Base64
  if (trimmed.startsWith('data:image/')) {
    // Remove line breaks or spaces that break Android Coil / Glide decoding
    return trimmed.replace(/\r?\n|\r|\s+/g, '');
  }

  // If raw Base64 string without data prefix
  if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0K') || trimmed.startsWith('R0lGOD')) {
    let mime = 'image/jpeg';
    if (trimmed.startsWith('iVBORw0K')) mime = 'image/png';
    else if (trimmed.startsWith('R0lGOD')) mime = 'image/gif';
    return `data:${mime};base64,${trimmed.replace(/\r?\n|\r|\s+/g, '')}`;
  }

  // Check if it matches a local storage / upload folder path even if preceded by http/https with localhost or previous domains
  const storageMatch = trimmed.match(/(?:https?:\/\/[^\/]+)?\/(storage|uploads|images|media|product_images)\/(.+)/i);
  if (storageMatch) {
    const section = storageMatch[1];
    const subpath = storageMatch[2].replace(/\\/g, '/');
    return `${protocol}://${host}/${section}/${subpath}`;
  }

  // If external absolute URL (e.g. cloudinary, imgur, cdn, external http)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      try {
        const urlObj = new URL(trimmed);
        return `${protocol}://${host}${urlObj.pathname}${urlObj.search}`;
      } catch {
        // fallback
      }
    }
    return trimmed;
  }

  // Handle relative paths
  let cleanPath = trimmed.replace(/\\/g, '/');
  if (cleanPath.startsWith('/')) {
    return `${protocol}://${host}${cleanPath}`;
  } else if (
    cleanPath.startsWith('storage/') ||
    cleanPath.startsWith('uploads/') ||
    cleanPath.startsWith('images/') ||
    cleanPath.startsWith('media/') ||
    cleanPath.startsWith('product_images/')
  ) {
    return `${protocol}://${host}/${cleanPath}`;
  } else {
    // Just a filename e.g. item1.jpg or 613000123.png
    return `${protocol}://${host}/storage/products/${cleanPath}`;
  }
}

// Helper to sanitize & format products with full image compatibility
export function normalizeProductItem(
  p: any,
  idx: number,
  activity_code: string,
  versionNum: number,
  host: string = 'localhost:3000',
  protocol: string = 'https'
): any {
  const name_ar = p.name_ar || p.name || `منتج ${idx + 1}`;
  const name_fr = p.name_fr || p.name || `Produit ${idx + 1}`;
  const barcode = String(p.barcode || p.sku || `613000${String(Date.now() + idx).slice(-7)}`).trim();
  const price = typeof p.price === 'number' ? p.price : (typeof p.default_price === 'number' ? p.default_price : 100);
  const purchase_price = typeof p.purchase_price === 'number' ? p.purchase_price : Math.round(price * 0.8);
  const wholesale_price = typeof p.wholesale_price === 'number' ? p.wholesale_price : Math.round(price * 0.9);
  const category_name = p.category_name || p.category || 'عام';
  const unit = p.unit || 'قطعة';
  const stock_qty = typeof p.stock_qty === 'number' ? p.stock_qty : 50;
  const min_stock_alert = typeof p.min_stock_alert === 'number' ? p.min_stock_alert : 10;
  
  // Find image from multiple common field names
  const rawImage =
    p.image_url ||
    p.imageUrl ||
    p.image ||
    p.photo_url ||
    p.photoUrl ||
    p.image_uri ||
    p.imageUri ||
    p.thumbnail ||
    p.thumbnail_url ||
    p.thumbnailUrl ||
    p.photo_path ||
    p.image_path ||
    '';

  const fullImageUrl = formatImageUrl(rawImage, host, protocol);
  const tax_rate = typeof p.tax_rate === 'number' ? p.tax_rate : 19.0;
  const is_tax_exempt = typeof p.is_tax_exempt === 'boolean' ? p.is_tax_exempt : false;

  return {
    id: p.id || p.product_id || `prod_${activity_code}_${idx + 1}`,
    product_id: p.id || p.product_id || `prod_${activity_code}_${idx + 1}`,
    activity_code,
    name_ar,
    name_fr,
    name: name_ar || name_fr,
    barcode,
    sku: p.sku || barcode,
    category_name,
    category: category_name,
    price,
    default_price: price,
    purchase_price,
    wholesale_price,
    unit,
    stock_qty,
    min_stock_alert,
    // Universal Android POS / Coil / Glide field mapping
    image_url: fullImageUrl,
    imageUrl: fullImageUrl,
    image: fullImageUrl,
    photo_url: fullImageUrl,
    image_uri: fullImageUrl,
    thumbnail: fullImageUrl,
    tax_rate,
    is_tax_exempt
  };
}

// 1. GET /api/sync/activities - Onboarding & Commercial Activities List
router.get('/activities', (req: Request, res: Response) => {
  const activities = db.getActivities()
    .filter(a => a.status === 'active')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(act => {
      const versions = db.getProductPackVersions().filter(v => v.activity_code === act.code && v.status === 'published');
      const latestVer = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : (act.latest_pack_version || 1);
      const latestVerObj = versions.find(v => v.version === latestVer);
      const prods = db.getPackVersionProducts(act.code, latestVer) || [];
      const catCount = new Set(prods.map(p => (p as any).category_name || p.category)).size || 8;
      const productCount = latestVerObj?.total_products || prods.length || act.total_products || 50;

      return {
        code: act.code,
        name_ar: act.name_ar,
        name_fr: act.name_fr,
        name_en: act.name_en,
        icon: act.icon || '📦',
        description: act.description || `كتالوج النشاط التجاري ${act.name_ar}`,
        category_count: catCount,
        product_count: productCount,
        latest_version: `${latestVer}.0.0`,
        checksum_sha256: latestVerObj?.checksum_sha256 || computeSha256(JSON.stringify(prods))
      };
    });

  res.json({
    success: true,
    activities: activities,
    data: activities,
    server_time: new Date().toISOString()
  });
});

// 2. GET & POST /api/sync/check - Check for updates of a specific activity catalog
const handleCheckUpdate = (req: Request, res: Response) => {
  const rawActivityCode =
    req.query.activity_code ||
    req.query.code ||
    req.query.activity ||
    req.query.activity_id ||
    req.query.activityCode ||
    req.query.category ||
    req.query.type ||
    req.query.business_type ||
    req.query.name ||
    req.body?.activity_code ||
    req.body?.code ||
    req.body?.activity ||
    req.body?.activity_id ||
    req.body?.activityCode ||
    req.body?.category ||
    req.body?.type ||
    req.body?.business_type ||
    req.body?.name ||
    req.params?.activityCode ||
    req.headers['x-activity-code'] ||
    req.headers['x-activity'] ||
    '';

  const activity_code = normalizeActivityCode(rawActivityCode);
  const current_version = req.query.current_version || req.query.local_version || req.query.version || req.body?.current_version || req.body?.local_version || 0;
  const clientChecksum = ((req.query.checksum || req.body?.checksum || req.headers['x-dzpos-pack-checksum']) as string) || '';
  const license_key = (req.query.license_key || req.body?.license_key || req.headers['authorization']?.replace('Bearer ', '')) as string;
  const device_id = (req.query.device_id || req.body?.device_id || req.headers['x-device-id']) as string;

  const activity = db.getActivities().find(a => a.code === activity_code);
  if (!activity) {
    return apiError(res, 404, 'ACTIVITY_NOT_FOUND', `Activity code '${activity_code}' not found`);
  }

  // Record heartbeat if license provided
  if (license_key) {
    const license = db.getLicenses().find(l => l.license_key === license_key);
    if (license) {
      license.last_sync_at = new Date().toISOString();
      if (device_id) {
        const dev = license.devices.find(d => d.device_id === device_id);
        if (dev) {
          dev.last_seen_at = new Date().toISOString();
        }
      }
      db.save();
    }
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';

  const publishedVersions = db.getProductPackVersions()
    .filter(v => v.activity_code === activity_code && v.status === 'published')
    .sort((a, b) => b.version - a.version);

  const baseVerNum = publishedVersions.length > 0 ? publishedVersions[0].version : (activity.latest_pack_version || 1);

  // Products strictly for this activity (Strict Activity Isolation)
  let prods = db.getPackVersionProducts(activity_code, baseVerNum) || [];
  if (!prods || prods.length === 0) {
    prods = db.getProducts().filter(p => p.activity_code === activity_code);
  }
  prods = prods.filter(p => p && (p.activity_code === activity_code || !p.activity_code));

  const formattedProducts = prods.map((p, idx) => normalizeProductItem(p, idx, activity_code, baseVerNum, host, protocol));
  const checksum = computeSha256(JSON.stringify(formattedProducts));
  const catCount = new Set(prods.map(p => (p as any).category_name || p.category)).size || 8;
  const productCount = prods.length;

  const parsedCurrent = typeof current_version === 'string'
    ? (parseInt(current_version.split('.')[0], 10) || 0)
    : Number(current_version);

  // An update is available if version is newer OR if the client's catalog checksum differs from the live catalog
  const versionHasUpdate = baseVerNum > parsedCurrent;
  const checksumHasUpdate = Boolean(clientChecksum && clientChecksum !== checksum);
  const hasUpdate = parsedCurrent === 0 || versionHasUpdate || checksumHasUpdate;

  const downloadUrl = `${protocol}://${host}/api/sync/download?activity_code=${activity_code}`;

  res.json({
    success: true,
    has_update: hasUpdate,
    update_available: hasUpdate,
    activity_code,
    latest_version: `${baseVerNum}.0.0`,
    checksum_sha256: checksum,
    total_products: productCount,
    total_categories: catCount,
    download_url: downloadUrl,
    data: {
      activity_code,
      update_available: hasUpdate,
      has_update: hasUpdate,
      server_version: baseVerNum,
      latest_version: `${baseVerNum}.0.0`,
      checksum_sha256: checksum,
      total_products: productCount,
      total_categories: catCount,
      download_url: downloadUrl
    }
  });
};

router.get('/check', handleCheckUpdate);
router.get('/check-update', handleCheckUpdate);
router.post('/check', handleCheckUpdate);

// 3. GET & POST /api/sync/download - Download Product Pack (Categories + Products + Images)
const handleDownload = (req: Request, res: Response) => {
  const rawActivityCode =
    req.query.activity_code ||
    req.query.code ||
    req.query.activity ||
    req.query.activity_id ||
    req.query.activityCode ||
    req.query.category ||
    req.query.type ||
    req.query.business_type ||
    req.query.name ||
    req.body?.activity_code ||
    req.body?.code ||
    req.body?.activity ||
    req.body?.activity_id ||
    req.body?.activityCode ||
    req.body?.category ||
    req.body?.type ||
    req.body?.business_type ||
    req.body?.name ||
    req.params?.activityCode ||
    req.headers['x-activity-code'] ||
    req.headers['x-activity'] ||
    req.headers['x-business-type'] ||
    '';

  const activity_code = normalizeActivityCode(rawActivityCode);
  const versionParam = (req.query.version || req.body?.version || req.query.v) as string;

  const activity = db.getActivities().find(a => a.code === activity_code);
  if (!activity) {
    return apiError(res, 404, 'ACTIVITY_NOT_FOUND', `Activity code '${activity_code}' not found`);
  }

  const published = db.getProductPackVersions()
    .filter(v => v.activity_code === activity_code && v.status === 'published')
    .sort((a, b) => b.version - a.version);
  const latestVerNum = published.length > 0 ? published[0].version : (activity.latest_pack_version || 1);

  let versionNum: number = latestVerNum;
  let isRequestingSpecificHistoricalVersion = false;

  if (versionParam && versionParam !== 'latest') {
    const requestedVer = parseInt(String(versionParam).split('.')[0], 10);
    if (!isNaN(requestedVer) && requestedVer > 0) {
      versionNum = requestedVer;
      if (requestedVer !== latestVerNum) {
        isRequestingSpecificHistoricalVersion = true;
      }
    }
  }

  // 1. Fetch strictly from the version pack file or latest.json for this activity
  let products = db.getPackVersionProducts(activity_code, versionNum) || [];

  // 2. Fallback to in-memory store strictly filtered by activity_code
  if (!products || products.length === 0) {
    products = db.getProducts().filter(p => p.activity_code === activity_code);
  }

  // 3. Strict Activity Isolation: NEVER allow products from other activities to leak
  products = products.filter(p => p && (p.activity_code === activity_code || !p.activity_code));

  const uniqueCats = Array.from(new Set(products.map(p => (p as any).category_name || p.category))).filter(Boolean);
  const colorPalette = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6'];

  const categories = uniqueCats.map((catName, idx) => ({
    id: `cat_${idx + 1}`,
    name_ar: catName,
    name_fr: catName,
    color_hex: colorPalette[idx % colorPalette.length]
  }));

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';

  const formattedProducts = products.map((p, idx) => normalizeProductItem(p, idx, activity_code, versionNum, host, protocol));
  const checksum = computeSha256(JSON.stringify(formattedProducts));

  const packPayload = {
    activity_code,
    version: `${versionNum}.0.0`,
    categories,
    products: formattedProducts
  };

  // Set HTTP headers for high-performance offline caching and CORS
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('ETag', `"${checksum}"`);
  res.setHeader('X-DZPOS-Pack-Version', `${versionNum}.0.0`);
  res.setHeader('X-DZPOS-Pack-Checksum', checksum);
  res.setHeader('X-DZPOS-Pack-Total', String(formattedProducts.length));

  if (req.headers['if-none-match'] === `"${checksum}"`) {
    return res.status(304).end();
  }

  res.json({
    success: true,
    pack: packPayload,
    categories,
    products: formattedProducts,
    data: formattedProducts,
    meta: {
      version: versionNum,
      checksum_sha256: checksum,
      total_products: formattedProducts.length,
      total_categories: categories.length
    },
    activity_code,
    version: `${versionNum}.0.0`,
    checksum_sha256: checksum,
    total_products: formattedProducts.length,
    total_categories: categories.length
  });
};

router.get('/download', handleDownload);
router.post('/download', handleDownload);
router.get('/download/:activityCode', (req, res) => {
  req.query.activity_code = req.params.activityCode;
  handleDownload(req, res);
});

// 4. POST /api/sync/upload-pack & /api/sync/import - Upload & Publish Exported Catalog from POS App
const handleUploadPack = (req: Request, res: Response) => {
  let { activity_code, code, pack, products, categories, version, changes_summary, auto_publish = true } = req.body;

  const targetCode = activity_code || code || pack?.activity_code;
  if (!targetCode) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'activity_code is required');
  }

  const rawProducts = Array.isArray(products) ? products : (Array.isArray(pack?.products) ? pack.products : []);
  if (rawProducts.length === 0) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'Pack must contain a non-empty products array');
  }

  // Check or register activity
  let activity = db.getActivities().find(a => a.code === targetCode);
  if (!activity) {
    activity = {
      id: `act_${targetCode}`,
      code: targetCode,
      name_ar: pack?.activity_name_ar || targetCode,
      name_fr: pack?.activity_name_fr || targetCode,
      name_en: targetCode,
      icon: '🏪',
      description: `كتالوج ${targetCode}`,
      status: 'active',
      sort_order: db.getActivities().length + 1,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latest_pack_version: 1,
      total_products: rawProducts.length
    };
    db.getActivities().push(activity);
  }

  // Calculate next version
  const existingVersions = db.getProductPackVersions().filter(v => v.activity_code === targetCode);
  const nextVerNum = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.version)) + 1 : 1;

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';

  const formattedProducts: Product[] = rawProducts.map((p: any, idx: number) => {
    const item = normalizeProductItem(p, idx, targetCode, nextVerNum, host, protocol);
    return {
      product_id: item.id,
      activity_code: targetCode,
      name: item.name,
      name_ar: item.name_ar,
      name_fr: item.name_fr,
      barcode: item.barcode,
      sku: item.sku,
      category: item.category,
      category_name: item.category_name,
      brand: p.brand || 'Local',
      unit: item.unit,
      default_price: item.price,
      price: item.price,
      purchase_price: item.purchase_price,
      wholesale_price: item.wholesale_price,
      stock_qty: item.stock_qty,
      min_stock_alert: item.min_stock_alert,
      image_url: item.image_url,
      tax_rate: item.tax_rate,
      is_tax_exempt: item.is_tax_exempt,
      status: 'active',
      version: nextVerNum,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  const { checksum, size } = db.savePackVersionFile(targetCode, nextVerNum, formattedProducts);

  if (auto_publish) {
    existingVersions.forEach(v => {
      if (v.status === 'published') v.status = 'archived';
    });
  }

  const newVersionRecord = {
    version_id: `ver_${targetCode}_v${nextVerNum}`,
    activity_code: targetCode,
    version: nextVerNum,
    status: (auto_publish ? 'published' : 'ready') as any,
    checksum_sha256: checksum,
    total_products: formattedProducts.length,
    file_size_bytes: size,
    changes_summary: changes_summary || `Exported backup imported from DZPOS POS App (${formattedProducts.length} items)`,
    created_by: req.headers['x-admin-user'] as string || 'pos_app',
    created_at: new Date().toISOString(),
    published_at: auto_publish ? new Date().toISOString() : undefined
  };

  db.getProductPackVersions().unshift(newVersionRecord);
  activity.latest_pack_version = nextVerNum;
  activity.total_products = formattedProducts.length;
  activity.updated_at = new Date().toISOString();

  let packRecord = db.getProductPacks().find(p => p.activity_code === targetCode);
  if (!packRecord) {
    packRecord = {
      id: `pack_${targetCode}`,
      activity_code: targetCode,
      pack_name: `Pack ${activity.name_ar}`,
      description: activity.description || `كتالوج ${activity.name_ar}`,
      latest_published_version: nextVerNum,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.getProductPacks().push(packRecord);
  } else {
    packRecord.latest_published_version = nextVerNum;
    packRecord.updated_at = new Date().toISOString();
  }

  db.addAuditLog(
    req.headers['x-admin-user'] as string || 'pos_app',
    'MAIN_ADMIN',
    'PACK_UPLOADED_AND_PUBLISHED',
    'product_packs',
    `ver_${targetCode}_v${nextVerNum}`,
    { activity_code: targetCode, version: nextVerNum, total_products: formattedProducts.length }
  );

  db.save();

  res.json({
    success: true,
    message: `تم رفع الحزمة بنجاح وتفعيلها كمرجع للنشاط '${activity.name_ar}' (الإصدار v${nextVerNum}.0.0)`,
    activity_code: targetCode,
    version: `${nextVerNum}.0.0`,
    total_products: formattedProducts.length,
    checksum_sha256: checksum,
    download_url: `/api/sync/download?activity_code=${targetCode}`
  });
};

router.post('/upload-pack', handleUploadPack);
router.post('/import', handleUploadPack);

// Order sync proxies for POS and Android Clients
import { handleSyncOrders, handlePendingOrders } from './orders.js';
router.get('/orders', handleSyncOrders);
router.get('/table-orders', handleSyncOrders);
router.get('/table_orders', handleSyncOrders);
router.get('/pending-orders', handlePendingOrders);
router.get('/pending_orders', handlePendingOrders);

// 5. POST /api/sync/upload-zip - Upload Android App Backup ZIP (contains square_pos_database.db, product_images/, backup_manifest.json)
router.post('/upload-zip', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return apiError(res, 400, 'FILE_MISSING', 'Please upload a .zip file (field name: file or backup)');
    }

    const preferredActivity = (req.body?.activity_code || req.body?.code || req.query.activity_code) as string | undefined;
    const adminUser = (req.headers['x-admin-user'] as string) || 'admin';
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';

    const result = await processZipBackup(
      req.file.buffer,
      req.file.originalname || 'dzpos_backup.zip',
      preferredActivity,
      adminUser,
      host,
      protocol
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error processing ZIP upload:', error);
    return apiError(res, 500, 'ZIP_PROCESSING_FAILED', `فشل معالجة ملف الـ ZIP: ${error.message}`);
  }
});

export default router;
