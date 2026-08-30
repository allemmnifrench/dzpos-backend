import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db, computeSha256 } from '../db.js';
import { AuthenticatedRequest, authMiddleware, apiError } from '../middleware/auth.js';
import { Product, ProductPackVersion, PackStatus } from '../../src/types/dzpos.js';
import { processZipBackup } from '../services/zipImporter.js';
import { normalizeProductItem } from './sync.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

const router = Router();

// Helper to parse simple CSV text into product objects
function parseCsvProducts(csvText: string, activity_code: string, version: number): { products: Product[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { products: [], errors: ['CSV file is empty or missing headers'] };
  }

  const headerLine = lines[0];
  const headers = headerLine.split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('designation') || h.includes('nom') || h.includes('produit'));
  const barcodeIdx = headers.findIndex(h => h.includes('barcode') || h.includes('code_barre') || h.includes('ean') || h.includes('code'));
  const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('prix') || h.includes('tarif'));
  const catIdx = headers.findIndex(h => h.includes('category') || h.includes('categorie') || h.includes('famille'));
  const brandIdx = headers.findIndex(h => h.includes('brand') || h.includes('marque'));
  const unitIdx = headers.findIndex(h => h.includes('unit') || h.includes('unite'));
  const nameArIdx = headers.findIndex(h => h.includes('name_ar') || h.includes('arabe') || h.includes('ar'));
  const imgIdx = headers.findIndex(h => h.includes('image') || h.includes('photo') || h.includes('img') || h.includes('picture') || h.includes('thumbnail'));

  const products: Product[] = [];
  const errors: string[] = [];
  const seenBarcodes = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (rawCols.length === 0 || (rawCols.length === 1 && rawCols[0] === '')) continue;

    const name = nameIdx !== -1 && rawCols[nameIdx] ? rawCols[nameIdx] : `Product ${i}`;
    let barcode = barcodeIdx !== -1 && rawCols[barcodeIdx] ? rawCols[barcodeIdx] : `61300${String(i).padStart(6, '0')}`;
    barcode = barcode.replace(/\s+/g, '');
    const priceStr = priceIdx !== -1 && rawCols[priceIdx] ? rawCols[priceIdx].replace(/[^0-9.]/g, '') : '100';
    const price = parseFloat(priceStr) || 100;
    const category = catIdx !== -1 && rawCols[catIdx] ? rawCols[catIdx] : 'Général';
    const brand = brandIdx !== -1 && rawCols[brandIdx] ? rawCols[brandIdx] : 'Standard';
    const unit = unitIdx !== -1 && rawCols[unitIdx] ? rawCols[unitIdx] : 'Pièce';
    const name_ar = nameArIdx !== -1 && rawCols[nameArIdx] ? rawCols[nameArIdx] : name;
    const image_url = imgIdx !== -1 && rawCols[imgIdx] ? rawCols[imgIdx] : '';

    if (!name) {
      errors.push(`Row ${i + 1}: Missing product name`);
      continue;
    }

    if (seenBarcodes.has(barcode)) {
      errors.push(`Row ${i + 1}: Duplicate barcode ${barcode} in uploaded file`);
    }
    seenBarcodes.add(barcode);

    products.push({
      product_id: `prod_${activity_code}_${Date.now()}_${i}`,
      activity_code,
      name,
      name_ar,
      name_fr: name,
      barcode,
      category,
      brand,
      unit,
      default_price: price,
      image_url,
      status: 'active',
      version,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  return { products, errors };
}

// GET /api/product-packs/versions/all - List all versions across all packs
router.get('/versions/all', (req, res) => {
  const versions = db.getProductPackVersions().sort((a, b) => b.version - a.version);
  res.json({
    success: true,
    data: versions
  });
});

// GET /api/product-packs/versions - List all versions
router.get('/versions', (req, res) => {
  const { activity_code } = req.query;
  let versions = db.getProductPackVersions();
  if (activity_code && typeof activity_code === 'string') {
    versions = versions.filter(v => v.activity_code === activity_code);
  }
  versions = versions.sort((a, b) => b.version - a.version);
  res.json({
    success: true,
    data: versions
  });
});

// POST /api/product-packs/versions/:versionId/publish - Publish a version by its ID
router.post('/versions/:versionId/publish', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { versionId } = req.params;
  const targetVer = db.getProductPackVersions().find(v => v.version_id === versionId || (v as any).id === versionId);
  if (!targetVer) {
    return apiError(res, 404, 'VERSION_NOT_FOUND', `Version ${versionId} not found`);
  }
  const activityCode = targetVer.activity_code;
  const verNum = targetVer.version;

  // Archive previous published versions for this activity
  db.getProductPackVersions()
    .filter(v => v.activity_code === activityCode)
    .forEach(v => {
      if (v.status === 'published' && v.version !== verNum) {
        v.status = 'archived';
      }
    });

  targetVer.status = 'published';
  targetVer.published_at = new Date().toISOString();

  const pack = db.getProductPacks().find(p => p.activity_code === activityCode);
  if (pack) {
    pack.latest_published_version = verNum;
    pack.updated_at = new Date().toISOString();
  }

  const activity = db.getActivities().find(a => a.code === activityCode);
  if (activity) {
    activity.latest_pack_version = verNum;
    activity.total_products = targetVer.total_products;
    activity.updated_at = new Date().toISOString();
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'MAIN_ADMIN',
    'PACK_VERSION_PUBLISHED',
    'product_pack_versions',
    targetVer.version_id,
    { activity_code: activityCode, version: verNum, total_products: targetVer.total_products },
    req.ip
  );

  res.json({
    success: true,
    message: `Version v${verNum} is now PUBLISHED for ${activityCode}`,
    data: targetVer
  });
});

// GET /api/product-packs - List all packs with versions
router.get('/', (req, res) => {
  const { activity_code } = req.query;
  let packs = db.getProductPacks();
  if (activity_code && typeof activity_code === 'string') {
    packs = packs.filter(p => p.activity_code === activity_code);
  }

  const versions = db.getProductPackVersions();
  const enriched = packs.map(pack => {
    const packVersions = versions
      .filter(v => v.activity_code === pack.activity_code)
      .sort((a, b) => b.version - a.version);

    const latestPublished = packVersions.find(v => v.status === 'published');

    return {
      ...pack,
      versions: packVersions,
      latest_published_version: latestPublished ? latestPublished.version : 0,
      total_versions_count: packVersions.length
    };
  });

  res.json({
    success: true,
    data: enriched
  });
});

// GET /api/product-packs/:activityCode/versions - List versions of specific activity pack
router.get('/:activityCode/versions', (req, res) => {
  const { activityCode } = req.params;
  const versions = db.getProductPackVersions()
    .filter(v => v.activity_code === activityCode)
    .sort((a, b) => b.version - a.version);

  res.json({
    success: true,
    data: versions
  });
});

// GET /api/product-packs/:activityCode/versions/:version/products - Get product items for version
router.get('/:activityCode/versions/:version/products', (req, res) => {
  const { activityCode, version } = req.params;
  const verNum = parseInt(version, 10);
  const products = db.getPackVersionProducts(activityCode, verNum);

  if (!products) {
    return apiError(res, 404, 'VERSION_NOT_FOUND', `Version v${version} for pack '${activityCode}' not found`);
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const normalized = products.map((p, idx) => normalizeProductItem(p, idx, activityCode, verNum, host, protocol));

  res.json({
    success: true,
    data: {
      activity_code: activityCode,
      version: verNum,
      count: normalized.length,
      products: normalized
    }
  });
});

// POST /api/product-packs/validate-file - Validate raw payload (JSON or CSV)
router.post('/validate-file', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { activity_code, file_type, raw_content, json_products } = req.body;

  if (!activity_code) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'activity_code is required');
  }

  const activity = db.getActivities().find(a => a.code === activity_code);
  if (!activity) {
    return apiError(res, 404, 'ACTIVITY_NOT_FOUND', `Activity ${activity_code} does not exist`);
  }

  let parsedProducts: Partial<Product>[] = [];
  const validationErrors: string[] = [];
  const warnings: string[] = [];

  if (file_type === 'csv' && raw_content) {
    const res = parseCsvProducts(raw_content, activity_code, 1);
    parsedProducts = res.products;
    validationErrors.push(...res.errors);
  } else if (Array.isArray(json_products)) {
    parsedProducts = json_products;
  } else if (raw_content) {
    try {
      const parsed = JSON.parse(raw_content);
      if (Array.isArray(parsed)) {
        parsedProducts = parsed;
      } else if (parsed.products && Array.isArray(parsed.products)) {
        parsedProducts = parsed.products;
      } else {
        return apiError(res, 400, 'INVALID_FILE', 'JSON file must contain an array of products');
      }
    } catch (err: any) {
      return apiError(res, 400, 'INVALID_FILE', `Failed to parse JSON file: ${err.message}`);
    }
  } else {
    return apiError(res, 400, 'INVALID_FILE', 'No file content or products array provided');
  }

  // Deep validation
  const barcodes = new Set<string>();
  const validRows: any[] = [];

  parsedProducts.forEach((p, idx) => {
    const rowNum = idx + 1;
    if (!p.name && !p.name_fr && !p.name_ar) {
      validationErrors.push(`Item #${rowNum}: Missing product name`);
      return;
    }
    if (!p.barcode) {
      warnings.push(`Item #${rowNum} (${p.name || 'Unnamed'}): Missing barcode, auto-generating dummy EAN-13`);
    } else {
      if (barcodes.has(p.barcode)) {
        warnings.push(`Item #${rowNum}: Duplicate barcode ${p.barcode} in batch`);
      }
      barcodes.add(p.barcode);
    }

    const rawProd = p as any;
    const image_url = rawProd.image_url || rawProd.image || rawProd.imageUrl || rawProd.photo_url || '';

    validRows.push({
      name: p.name || p.name_fr || p.name_ar,
      name_ar: p.name_ar || p.name || '',
      name_fr: p.name_fr || p.name || '',
      barcode: p.barcode || `613000${String(Date.now() + idx).slice(-7)}`,
      category: p.category || 'General',
      brand: p.brand || 'Local',
      unit: p.unit || 'Pièce',
      default_price: Number(p.default_price) || 0,
      image_url,
      metadata: p.metadata || {}
    });
  });

  res.json({
    success: true,
    data: {
      activity_code,
      total_rows: parsedProducts.length,
      valid_rows_count: validRows.length,
      errors_count: validationErrors.length,
      warnings_count: warnings.length,
      errors: validationErrors,
      warnings,
      preview: validRows.slice(0, 10),
      is_valid: validationErrors.length === 0 && validRows.length > 0
    }
  });
});

// POST /api/product-packs/create-version - Confirm Import and Create Version
router.post('/create-version', authMiddleware(['MAIN_ADMIN', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const {
    activity_code,
    products,
    changes_summary = 'Updated product catalog batch',
    auto_publish = false
  } = req.body;

  if (!activity_code || !Array.isArray(products) || products.length === 0) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'activity_code and non-empty products array are required');
  }

  const activity = db.getActivities().find(a => a.code === activity_code);
  if (!activity) {
    return apiError(res, 404, 'ACTIVITY_NOT_FOUND', `Activity ${activity_code} does not exist`);
  }

  // Determine next version number
  const existingVersions = db.getProductPackVersions().filter(v => v.activity_code === activity_code);
  const nextVersionNum = existingVersions.length > 0
    ? Math.max(...existingVersions.map(v => v.version)) + 1
    : 1;

  // Format and assign IDs & versions to products
  const formattedProducts: Product[] = products.map((p, idx) => {
    const rawProd = p as any;
    const image_url = rawProd.image_url || rawProd.image || rawProd.imageUrl || rawProd.photo_url || '';
    return {
      product_id: p.product_id || `prod_${activity_code}_v${nextVersionNum}_${idx + 1}`,
      activity_code,
      name: p.name || p.name_fr || p.name_ar,
      name_ar: p.name_ar || p.name || '',
      name_fr: p.name_fr || p.name || '',
      barcode: String(p.barcode || `613000${String(Date.now() + idx).slice(-7)}`),
      category: p.category || 'General',
      brand: p.brand || 'Local',
      unit: p.unit || 'Pièce',
      default_price: Number(p.default_price) || 0,
      image_url,
      status: 'active',
      metadata: p.metadata || {},
      version: nextVersionNum,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  // Save version file to disk
  const { checksum, size } = db.savePackVersionFile(activity_code, nextVersionNum, formattedProducts);

  // If auto-publishing, archive previously published versions
  if (auto_publish) {
    existingVersions.forEach(v => {
      if (v.status === 'published') {
        v.status = 'archived';
      }
    });
  }

  const newVersion: ProductPackVersion = {
    version_id: `ver_${activity_code}_v${nextVersionNum}`,
    activity_code,
    version: nextVersionNum,
    status: auto_publish ? 'published' : 'ready',
    checksum_sha256: checksum,
    total_products: formattedProducts.length,
    file_size_bytes: size,
    changes_summary,
    created_by: req.user?.username || 'admin',
    created_at: new Date().toISOString(),
    published_at: auto_publish ? new Date().toISOString() : undefined
  };

  db.getProductPackVersions().unshift(newVersion);

  // Ensure pack record exists
  let pack = db.getProductPacks().find(p => p.activity_code === activity_code);
  if (!pack) {
    pack = {
      id: `pack_${activity_code}`,
      activity_code,
      pack_name: `Pack ${activity.name_fr}`,
      description: `Official catalog pack for ${activity.name_fr}`,
      latest_published_version: auto_publish ? nextVersionNum : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.getProductPacks().push(pack);
  } else if (auto_publish) {
    pack.latest_published_version = nextVersionNum;
    pack.updated_at = new Date().toISOString();
  }

  if (auto_publish) {
    activity.latest_pack_version = nextVersionNum;
    activity.total_products = formattedProducts.length;
    activity.updated_at = new Date().toISOString();
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'ADMIN',
    auto_publish ? 'PACK_VERSION_PUBLISHED' : 'PACK_VERSION_CREATED',
    'product_pack_versions',
    newVersion.version_id,
    { activity_code, version: nextVersionNum, count: formattedProducts.length, checksum },
    req.ip
  );

  res.status(201).json({
    success: true,
    message: `Version v${nextVersionNum} created successfully (${newVersion.status})`,
    data: newVersion
  });
});

// POST /api/product-packs/:activityCode/publish/:version - Publish a draft/ready version
router.post('/:activityCode/publish/:version', authMiddleware(['MAIN_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { activityCode, version } = req.params;
  const verNum = parseInt(version, 10);

  const versions = db.getProductPackVersions().filter(v => v.activity_code === activityCode);
  const targetVer = versions.find(v => v.version === verNum);

  if (!targetVer) {
    return apiError(res, 404, 'VERSION_NOT_FOUND', `Version v${version} for pack '${activityCode}' not found`);
  }

  // Archive previous published versions
  versions.forEach(v => {
    if (v.status === 'published' && v.version !== verNum) {
      v.status = 'archived';
    }
  });

  targetVer.status = 'published';
  targetVer.published_at = new Date().toISOString();

  // Update pack and activity pointers
  const pack = db.getProductPacks().find(p => p.activity_code === activityCode);
  if (pack) {
    pack.latest_published_version = verNum;
    pack.updated_at = new Date().toISOString();
  }

  const activity = db.getActivities().find(a => a.code === activityCode);
  if (activity) {
    activity.latest_pack_version = verNum;
    activity.total_products = targetVer.total_products;
    activity.updated_at = new Date().toISOString();
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'MAIN_ADMIN',
    'PACK_VERSION_PUBLISHED',
    'product_pack_versions',
    targetVer.version_id,
    { activity_code: activityCode, version: verNum, total_products: targetVer.total_products },
    req.ip
  );

  res.json({
    success: true,
    message: `Version v${verNum} is now PUBLISHED and set as LATEST for ${activityCode}`,
    data: targetVer
  });
});

// POST /api/product-packs/:activityCode/rollback - Rollback to a specific previous version
router.post('/:activityCode/rollback', authMiddleware(['MAIN_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { activityCode } = req.params;
  const { target_version, reason } = req.body;

  if (!target_version) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'target_version is required for rollback');
  }

  const targetVerNum = parseInt(target_version, 10);
  const versions = db.getProductPackVersions().filter(v => v.activity_code === activityCode);
  const targetVer = versions.find(v => v.version === targetVerNum);

  if (!targetVer) {
    return apiError(res, 404, 'VERSION_NOT_FOUND', `Target rollback version v${target_version} does not exist`);
  }

  const currentPublished = versions.find(v => v.status === 'published');
  const currentVerNum = currentPublished ? currentPublished.version : 0;

  // Archive current published version
  if (currentPublished) {
    currentPublished.status = 'archived';
  }

  // Set target version as published
  targetVer.status = 'published';
  targetVer.published_at = new Date().toISOString();
  targetVer.rollback_from_version = currentVerNum;

  // Update pack and activity
  const pack = db.getProductPacks().find(p => p.activity_code === activityCode);
  if (pack) {
    pack.latest_published_version = targetVerNum;
    pack.updated_at = new Date().toISOString();
  }

  const activity = db.getActivities().find(a => a.code === activityCode);
  if (activity) {
    activity.latest_pack_version = targetVerNum;
    activity.total_products = targetVer.total_products;
    activity.updated_at = new Date().toISOString();
  }

  db.save();

  db.addAuditLog(
    req.user?.username || 'admin',
    req.user?.role || 'MAIN_ADMIN',
    'PACK_VERSION_ROLLBACK',
    'product_pack_versions',
    targetVer.version_id,
    { activity_code: activityCode, from_version: currentVerNum, to_version: targetVerNum, reason },
    req.ip
  );

  res.json({
    success: true,
    message: `Successfully rolled back pack '${activityCode}' from v${currentVerNum} to v${targetVerNum}`,
    data: {
      activity_code: activityCode,
      current_active_version: targetVerNum,
      rolled_back_from: currentVerNum,
      active_version_details: targetVer
    }
  });
});

// Upload ZIP Backup from POS App directly
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
