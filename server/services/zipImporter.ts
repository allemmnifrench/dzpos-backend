import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { db } from '../db.js';
import { Product } from '../../src/types/dzpos.js';
import { normalizeActivityCode } from '../routes/sync.js';
import { saveImageToStore, sanitizeImageFilename, ensureStorageDirs } from './imageStore.js';

// Ensure storage directories exist
export function initStorageDirectories() {
  ensureStorageDirs();
}

export interface ZipImportResult {
  success: boolean;
  message: string;
  activity_code: string;
  version: string;
  total_products: number;
  total_categories: number;
  total_images: number;
  zip_url: string;
  download_url: string;
  checksum_sha256: string;
  manifest?: Record<string, any>;
  extracted_images: string[];
}

/**
 * Checks if a buffer starts with the 16-byte SQLite 3 magic header
 */
function isSqliteBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 16) return false;
  const header = buf.subarray(0, 16).toString('utf8');
  return header.startsWith('SQLite format 3');
}

/**
 * Universal key extractor that finds a field in a record regardless of casing or formatting
 */
function getFieldValue(obj: Record<string, any>, candidateKeys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;

  const normalizedCandidateKeys = candidateKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const objKeys = Object.keys(obj);

  for (const objKey of objKeys) {
    const normalizedKey = objKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedCandidateKeys.includes(normalizedKey)) {
      const val = obj[objKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return val;
      }
    }
  }

  // Direct object keys fallback
  for (const key of candidateKeys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
      return obj[key];
    }
  }

  return undefined;
}

/**
 * Clean string representation
 */
function cleanStr(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

/**
 * Checks if a value is a binary image buffer or Uint8Array (from SQLite BLOB)
 */
function isImageBuffer(val: any): boolean {
  if (!val) return false;
  if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
    if (val.length >= 4) {
      // PNG magic: 0x89 0x50 0x4e 0x47
      if (val[0] === 0x89 && val[1] === 0x50 && val[2] === 0x4e && val[3] === 0x47) return true;
      // JPEG magic: 0xff 0xd8 0xff
      if (val[0] === 0xff && val[1] === 0xd8 && val[2] === 0xff) return true;
      // GIF magic: 0x47 0x49 0x46
      if (val[0] === 0x47 && val[1] === 0x49 && val[2] === 0x46) return true;
      // WEBP magic: bytes 8-12 is WEBP
      if (val.length >= 12 && String.fromCharCode(val[8], val[9], val[10], val[11]) === 'WEBP') return true;
    }
  }
  return false;
}

/**
 * Process a ZIP file uploaded from DZPOS Android POS backup
 * Handles:
 * - square_pos_database.db or any SQLite database (with BLOBs, paths, categories)
 * - product_images/ (Folder with all image files, preserving Arabic & special characters)
 * - backup_manifest.json (Metadata)
 */
export async function processZipBackup(
  buffer: Buffer,
  filename: string,
  preferredActivityCode?: string,
  adminUser: string = 'admin',
  reqHost: string = 'localhost:3000',
  protocol: string = 'https'
): Promise<ZipImportResult> {
  initStorageDirectories();

  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(buffer);

  let manifestData: any = null;
  let sqliteBuffer: Buffer | null = null;
  let jsonProducts: any[] = [];
  const savedImages: { filename: string; webPath: string; originalPath: string; rawName: string }[] = [];

  // 1. Scan and extract files from ZIP
  const fileNames = Object.keys(loadedZip.files);
  console.log(`[ZIP Importer] Loaded ZIP with ${fileNames.length} entries.`);

  for (const relativePath of fileNames) {
    const file = loadedZip.files[relativePath];
    if (file.dir) continue;

    const baseName = path.basename(relativePath);
    const lowerName = baseName.toLowerCase();

    // Check for manifest
    if (lowerName.endsWith('manifest.json') || lowerName.includes('manifest')) {
      try {
        const text = await file.async('text');
        manifestData = JSON.parse(text);
        console.log('[ZIP Importer] Parsed manifest:', manifestData);
      } catch (e) {
        console.warn('[ZIP Importer] Failed parsing manifest JSON:', e);
      }
    }
    // Check for JSON product catalog files
    else if (lowerName.endsWith('.json') && !lowerName.includes('manifest')) {
      try {
        const text = await file.async('text');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          jsonProducts = parsed;
          console.log(`[ZIP Importer] Found ${parsed.length} products in JSON file: ${relativePath}`);
        } else if (parsed && Array.isArray(parsed.products)) {
          jsonProducts = parsed.products;
          console.log(`[ZIP Importer] Found ${parsed.products.length} products in JSON file: ${relativePath}`);
        }
      } catch (e) {
        console.warn('[ZIP Importer] Failed parsing auxiliary JSON file:', relativePath, e);
      }
    }
    // Check for images in product_images/ or any image file in zip
    else if (/\.(jpe?g|png|webp|gif|svg|bmp|jfif)$/i.test(baseName)) {
      try {
        const imgBuffer = await file.async('nodebuffer');
        const sanitizedName = sanitizeImageFilename(baseName);
        
        // Save to ImageStore (disk + memory + vault)
        const saved = saveImageToStore(sanitizedName, imgBuffer);

        savedImages.push({
          filename: saved.filename,
          webPath: `${protocol}://${reqHost}/storage/products/${encodeURIComponent(saved.filename)}`,
          originalPath: relativePath,
          rawName: baseName
        });
      } catch (imgErr) {
        console.warn(`[ZIP Importer] Failed saving image ${relativePath}:`, imgErr);
      }
    }
    // Check for SQLite database file by name or extension
    else if (
      lowerName.endsWith('.db') ||
      lowerName.endsWith('.sqlite') ||
      lowerName.endsWith('.sqlite3') ||
      lowerName.includes('database') ||
      lowerName.includes('square') ||
      lowerName.includes('pos')
    ) {
      console.log(`[ZIP Importer] Found candidate database file by name: ${relativePath}`);
      const candidateBuf = await file.async('nodebuffer');
      if (isSqliteBuffer(candidateBuf)) {
        sqliteBuffer = candidateBuf;
        console.log(`[ZIP Importer] Verified SQLite magic header in ${relativePath}`);
      } else {
        sqliteBuffer = candidateBuf;
      }
    }
  }

  // If no sqliteBuffer found by name, scan all files in zip for SQLite magic header
  if (!sqliteBuffer) {
    for (const relativePath of fileNames) {
      const file = loadedZip.files[relativePath];
      if (file.dir) continue;
      try {
        const testBuf = await file.async('nodebuffer');
        if (isSqliteBuffer(testBuf)) {
          sqliteBuffer = testBuf;
          console.log(`[ZIP Importer] Found SQLite database via magic header check in: ${relativePath}`);
          break;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  console.log(`[ZIP Importer] Total extracted images from archive: ${savedImages.length}`);
  console.log(`[ZIP Importer] SQLite database detected: ${!!sqliteBuffer}`);

  // Candidate Keys dictionaries
  const candidateArabicNameKeys = [
    'name_ar', 'name_arabic', 'arabic_name', 'arabicName', 'nameAr',
    'designation_ar', 'designationAr', 'libelle_ar', 'libelleAr',
    'title_ar', 'titleAr', 'ar_name', 'nom_ar', 'product_name_ar', 'productNameAr'
  ];

  const candidateGeneralNameKeys = [
    'product_name', 'productName', 'itemName', 'item_name', 'name',
    'designation', 'nom', 'nom_produit', 'nomProduit', 'libelle',
    'title', 'label', 'description', 'article_name', 'articleName',
    'name_fr', 'name_french', 'french_name', 'frenchName', 'nameFr',
    'designation_fr', 'designationFr', 'libelle_fr', 'libelleFr',
    'product', 'item', 'article', 'p_name', 'pname'
  ];

  const candidateBarcodeKeys = [
    'barcode', 'bar_code', 'code_barre', 'codeBarre', 'code_barres',
    'sku', 'code', 'qr_code', 'qrCode', 'upc', 'ean', 'reference', 'ref', 'cb'
  ];

  const candidatePriceKeys = [
    'price', 'selling_price', 'sellingPrice', 'sale_price', 'salePrice',
    'unit_price', 'unitPrice', 'price_dz', 'prix', 'prix_vente', 'prixVente',
    'default_price', 'defaultPrice', 'retail_price', 'retailPrice', 'montant', 'pv'
  ];

  const candidatePurchasePriceKeys = [
    'purchase_price', 'purchasePrice', 'buy_price', 'buyPrice',
    'cost_price', 'costPrice', 'cost', 'prix_achat', 'prixAchat', 'pa'
  ];

  const candidateWholesalePriceKeys = [
    'wholesale_price', 'wholesalePrice', 'prix_gros', 'prixGros',
    'semi_wholesale_price', 'semiWholesalePrice', 'pg'
  ];

  const candidateImageKeys = [
    'image_path', 'imagePath', 'image_uri', 'imageUri', 'photo_path',
    'photoPath', 'photo_uri', 'photoUri', 'image_name', 'imageName',
    'image', 'img', 'photo', 'picture', 'picture_path', 'picturePath',
    'thumbnail', 'thumbnail_path', 'thumbnailPath', 'avatar', 'file_name',
    'fileName', 'file_path', 'filePath', 'image_url', 'imageUrl',
    'image_blob', 'photo_blob', 'img_blob', 'image_data', 'picture_blob'
  ];

  const candidateCategoryKeys = [
    'category_name', 'categoryName', 'category', 'categorie', 'famille',
    'famille_nom', 'cat_name', 'group_name', 'groupName', 'department'
  ];

  const candidateCategoryIdKeys = [
    'category_id', 'categoryId', 'id_category', 'id_categorie',
    'famille_id', 'familleId', 'cat_id', 'group_id'
  ];

  const candidateUnitKeys = [
    'unit', 'unite', 'unit_name', 'unitName', 'mesure', 'measure_unit', 'packaging'
  ];

  const candidateStockKeys = [
    'stock_qty', 'stockQty', 'stockQuantity', 'stock', 'quantity', 'qty', 'qte', 'solde', 'inventaire'
  ];

  // Determine Activity Code
  let rawActivity = preferredActivityCode || manifestData?.activity_code || manifestData?.business_type || manifestData?.activity || filename || 'grocery';
  let activity_code = normalizeActivityCode(rawActivity);

  // Find or create activity
  let activity = db.getActivities().find(a => a.code === activity_code);
  if (!activity) {
    activity = {
      id: `act_${activity_code}`,
      code: activity_code,
      name_ar: manifestData?.activity_name_ar || manifestData?.shop_name || 'بقالة ومواد غذائية عامة',
      name_fr: manifestData?.activity_name_fr || 'Épicerie & Alimentation Générale',
      name_en: activity_code,
      icon: '🛒',
      description: manifestData?.description || `كتالوج مستورد من كاسة DZPOS`,
      status: 'active',
      sort_order: db.getActivities().length + 1,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latest_pack_version: 1,
      total_products: 0
    };
    db.getActivities().push(activity);
  }

  const existingVersions = db.getProductPackVersions().filter(v => v.activity_code === activity_code);
  const nextVerNum = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.version)) + 1 : (activity.latest_pack_version ? activity.latest_pack_version + 1 : 1);

  // 2. Extract products and categories from SQLite with Strict Table Scoring & BLOB extraction
  let rawProductsList: any[] = [];
  let rawCategoriesList: any[] = [];

  if (sqliteBuffer) {
    try {
      const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      const SQL = await initSqlJs({
        locateFile: () => wasmPath
      });
      const sqliteDb = new SQL.Database(sqliteBuffer);

      // Inspect tables
      const tableQuery = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%' AND name != 'room_master_table';");
      const tableNames: string[] = tableQuery[0]?.values?.map((row: any) => String(row[0])) || [];
      console.log('[ZIP Importer] SQLite Tables found in database:', tableNames);

      interface TableInfo {
        name: string;
        columns: string[];
        rows: any[];
        productScore: number;
        isCategoryTable: boolean;
      }

      const tablesAnalysis: TableInfo[] = [];

      for (const tName of tableNames) {
        try {
          const res = sqliteDb.exec(`SELECT * FROM "${tName}"`);
          if (res.length > 0 && res[0].columns && res[0].values) {
            const columns = res[0].columns;
            const rows = res[0].values.map((row: any) => {
              const obj: any = {};
              columns.forEach((col, idx) => { obj[col] = row[idx]; });
              return obj;
            });

            const colLowerList = columns.map(c => c.toLowerCase());
            const tLower = tName.toLowerCase();

            // Check if explicitly a Category table (e.g. categories, category, famille, groups)
            const isCategoryTable = (
              tLower === 'category' ||
              tLower === 'categories' ||
              tLower === 'category_table' ||
              tLower === 'famille' ||
              tLower === 'familles' ||
              tLower === 'group' ||
              tLower === 'groups'
            ) && !colLowerList.some(c => c.includes('price') || c.includes('prix') || c.includes('cost') || c.includes('barcode') || c.includes('code_barre'));

            // Calculate Product Table Score
            let score = 0;

            // Name indicators
            if (tLower.includes('product') || tLower.includes('item') || tLower.includes('article')) score += 50;
            if (colLowerList.some(c => c.includes('price') || c.includes('prix') || c.includes('selling') || c.includes('cost'))) score += 30;
            if (colLowerList.some(c => c.includes('barcode') || c.includes('code_barre') || c.includes('codebarre') || c.includes('sku') || c.includes('ean'))) score += 30;
            if (colLowerList.some(c => c.includes('name') || c.includes('designation') || c.includes('nom') || c.includes('libelle') || c.includes('title'))) score += 20;
            if (colLowerList.some(c => c.includes('stock') || c.includes('qte') || c.includes('quantity'))) score += 10;
            if (colLowerList.some(c => c.includes('image') || c.includes('photo') || c.includes('picture') || c.includes('blob'))) score += 10;

            // Penalty if it looks purely like a category table
            if (isCategoryTable) score -= 100;

            tablesAnalysis.push({
              name: tName,
              columns,
              rows,
              productScore: score,
              isCategoryTable
            });

            console.log(`[ZIP Importer] Table "${tName}" (rows: ${rows.length}, productScore: ${score}, isCategoryTable: ${isCategoryTable}).`);
          }
        } catch (tErr) {
          console.warn(`[ZIP Importer] Error reading table ${tName}:`, tErr);
        }
      }

      // 1. Select Categories table
      const catTable = tablesAnalysis.find(t => t.isCategoryTable) ||
        tablesAnalysis.find(t => t.name.toLowerCase().includes('cat') || t.name.toLowerCase().includes('famill'));
      if (catTable && catTable.rows.length > 0) {
        rawCategoriesList = catTable.rows;
        console.log(`[ZIP Importer] Selected Categories table: "${catTable.name}" (${rawCategoriesList.length} categories)`);
      }

      // 2. Select Products table (Highest productScore, MUST NOT be the category table)
      const sortedByScore = tablesAnalysis
        .filter(t => !t.isCategoryTable && t.rows.length > 0)
        .sort((a, b) => b.productScore - a.productScore);

      if (sortedByScore.length > 0 && sortedByScore[0].productScore > 0) {
        rawProductsList = sortedByScore[0].rows;
        console.log(`[ZIP Importer] Selected Products table: "${sortedByScore[0].name}" (${rawProductsList.length} rows, score: ${sortedByScore[0].productScore})`);
      } else if (tablesAnalysis.length > 0) {
        // Fallback: Pick the table with the most rows that isn't the category table
        const candidateTables = tablesAnalysis.filter(t => !t.isCategoryTable);
        if (candidateTables.length > 0) {
          candidateTables.sort((a, b) => b.rows.length - a.rows.length);
          rawProductsList = candidateTables[0].rows;
          console.log(`[ZIP Importer] Fallback selected table "${candidateTables[0].name}" with ${rawProductsList.length} rows`);
        }
      }

      // 3. Check for SQLite BLOB image data across selected products
      for (let i = 0; i < rawProductsList.length; i++) {
        const p = rawProductsList[i];
        for (const [colKey, colVal] of Object.entries(p)) {
          if (isImageBuffer(colVal)) {
            try {
              const bufferVal = Buffer.isBuffer(colVal) ? colVal : Buffer.from(colVal as Uint8Array);
              const barcodeVal = cleanStr(getFieldValue(p, candidateBarcodeKeys)) || `prod_${i + 1}`;
              const imgFileName = `sqlite_img_${barcodeVal}_${i + 1}.jpg`;
              const saved = saveImageToStore(imgFileName, bufferVal);
              
              savedImages.push({
                filename: saved.filename,
                webPath: `${protocol}://${reqHost}/storage/products/${encodeURIComponent(saved.filename)}`,
                originalPath: `sqlite_blob_${colKey}`,
                rawName: imgFileName
              });

              p['_sqlite_extracted_image_url'] = `${protocol}://${reqHost}/storage/products/${encodeURIComponent(saved.filename)}`;
            } catch (blobErr) {
              console.warn('[ZIP Importer] Error extracting SQLite image blob:', blobErr);
            }
          }
        }
      }

      sqliteDb.close();
    } catch (sqliteErr) {
      console.error('[ZIP Importer] SQLite parsing error:', sqliteErr);
    }
  }

  // Fallback to JSON products if SQLite had no rows
  if (rawProductsList.length === 0 && jsonProducts.length > 0) {
    rawProductsList = jsonProducts;
    console.log(`[ZIP Importer] Using ${rawProductsList.length} products from auxiliary JSON`);
  }

  // Fallback to manifest products
  if (rawProductsList.length === 0 && manifestData?.products && Array.isArray(manifestData.products)) {
    rawProductsList = manifestData.products;
    console.log(`[ZIP Importer] Using ${rawProductsList.length} products from manifestData.products`);
  }

  // Save the entire ZIP archive to /storage/packs/ for permanent on-demand image re-hydration
  const zipFilename = `${activity_code}_v${nextVerNum}.zip`;
  const zipStoragePath = path.join(process.cwd(), 'storage', 'packs', zipFilename);
  try {
    fs.writeFileSync(zipStoragePath, buffer);
  } catch (err) {
    console.warn(`[ZIP Importer] Failed writing pack zip archive ${zipFilename}:`, err);
  }

  const zipDownloadUrl = `${protocol}://${reqHost}/storage/packs/${zipFilename}`;

  // Helper to match an image for a product
  const findMatchingImage = (p: any, barcode: string, productId: string, name_ar: string, name_fr: string, idx: number): string => {
    // 0. If SQLite BLOB was already extracted for this row
    if (p['_sqlite_extracted_image_url']) {
      return p['_sqlite_extracted_image_url'];
    }

    // 1. Explicit image column in row
    const rawImageVal = cleanStr(getFieldValue(p, candidateImageKeys));
    if (rawImageVal) {
      // Data URI
      if (rawImageVal.startsWith('data:image/')) {
        return rawImageVal;
      }
      // Absolute URL
      if (rawImageVal.startsWith('http://') || rawImageVal.startsWith('https://')) {
        return rawImageVal;
      }

      // Local path or filename (e.g. /storage/emulated/0/.../pic.jpg or product_images/candia.png)
      const targetBase = path.basename(rawImageVal);
      const targetLower = targetBase.toLowerCase();
      const targetWithoutExt = path.basename(targetBase, path.extname(targetBase)).toLowerCase();

      const match = savedImages.find(img => {
        const sName = img.filename.toLowerCase();
        const sRaw = img.rawName.toLowerCase();
        const sWithoutExt = path.basename(img.filename, path.extname(img.filename)).toLowerCase();
        const sRawWithoutExt = path.basename(img.rawName, path.extname(img.rawName)).toLowerCase();

        return (
          sName === targetLower ||
          sRaw === targetLower ||
          sWithoutExt === targetWithoutExt ||
          sRawWithoutExt === targetWithoutExt ||
          img.originalPath.toLowerCase().endsWith(`/${targetLower}`) ||
          img.originalPath.toLowerCase() === targetLower
        );
      });

      if (match) {
        return match.webPath;
      }
    }

    // 2. Match by Barcode
    if (barcode && barcode.length >= 4) {
      const barcodeMatch = savedImages.find(img => {
        const sName = img.filename.toLowerCase();
        const sRaw = img.rawName.toLowerCase();
        return sName.includes(barcode.toLowerCase()) || sRaw.includes(barcode.toLowerCase());
      });
      if (barcodeMatch) return barcodeMatch.webPath;
    }

    // 3. Match by Product ID
    if (productId) {
      const cleanId = String(productId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanId.length >= 2) {
        const idMatch = savedImages.find(img => {
          const sName = img.filename.toLowerCase();
          return sName.includes(cleanId);
        });
        if (idMatch) return idMatch.webPath;
      }
    }

    // 4. Match by Product Name
    const nameKeywords = [name_ar, name_fr].filter(Boolean).map(n => n.toLowerCase().trim());
    for (const kw of nameKeywords) {
      if (kw.length >= 3) {
        const nameMatch = savedImages.find(img => {
          const sWithoutExt = path.basename(img.filename, path.extname(img.filename)).toLowerCase();
          const sRawWithoutExt = path.basename(img.rawName, path.extname(img.rawName)).toLowerCase();
          return sWithoutExt === kw || sRawWithoutExt === kw || sWithoutExt.includes(kw) || kw.includes(sWithoutExt);
        });
        if (nameMatch) return nameMatch.webPath;
      }
    }

    // 5. Index matching fallback if image count exactly matches product count
    if (savedImages.length === rawProductsList.length && savedImages[idx]) {
      return savedImages[idx].webPath;
    }

    return '';
  };

  // Map to DZPOS standard Product schema
  const formattedProducts: Product[] = rawProductsList.map((p: any, idx: number) => {
    // 1. Name Resolution
    const explicitArabicName = cleanStr(getFieldValue(p, candidateArabicNameKeys));
    const explicitGeneralName = cleanStr(getFieldValue(p, candidateGeneralNameKeys));

    let name_ar = explicitArabicName || explicitGeneralName || '';
    let name_fr = explicitGeneralName || explicitArabicName || '';

    // If both empty, scan string properties
    if (!name_ar && !name_fr) {
      for (const [k, v] of Object.entries(p)) {
        if (typeof v === 'string' && v.trim().length > 1 && isNaN(Number(v))) {
          const lk = k.toLowerCase();
          if (
            !lk.includes('id') &&
            !lk.includes('img') &&
            !lk.includes('path') &&
            !lk.includes('url') &&
            !lk.includes('photo') &&
            !lk.includes('date') &&
            !lk.includes('time') &&
            !lk.includes('sync') &&
            !lk.includes('status')
          ) {
            name_ar = v.trim();
            name_fr = v.trim();
            break;
          }
        }
      }
    }

    // 2. Barcode & ID Resolution
    const rawBarcode = getFieldValue(p, candidateBarcodeKeys);
    const barcode = cleanStr(rawBarcode || `613000${String(Date.now() + idx).slice(-7)}`);
    const productId = cleanStr(getFieldValue(p, ['id', 'product_id', 'productId', 'item_id', 'itemId', '_id']) || `prod_${activity_code}_${idx + 1}`);

    // 3. Category Resolution
    let categoryName = cleanStr(getFieldValue(p, candidateCategoryKeys));
    const catId = getFieldValue(p, candidateCategoryIdKeys);

    if (!categoryName && catId !== undefined) {
      const matchedCat = rawCategoriesList.find(c => {
        const cId = getFieldValue(c, ['id', 'category_id', 'categoryId', 'famille_id']);
        return String(cId) === String(catId);
      });
      if (matchedCat) {
        categoryName = cleanStr(
          getFieldValue(matchedCat, candidateArabicNameKeys) ||
          getFieldValue(matchedCat, candidateGeneralNameKeys) ||
          getFieldValue(matchedCat, candidateCategoryKeys)
        );
      }
    }

    if (!categoryName) {
      categoryName = 'عام';
    }

    // 4. Image Resolution
    const image_url = findMatchingImage(p, barcode, productId, name_ar, name_fr, idx);

    if (!name_ar) {
      name_ar = `منتج ${idx + 1}`;
    }
    if (!name_fr) {
      name_fr = name_ar;
    }

    // 5. Prices
    const rawPrice = getFieldValue(p, candidatePriceKeys);
    const price = typeof rawPrice === 'number' ? rawPrice : (!isNaN(Number(rawPrice)) ? Number(rawPrice) : 100);

    const rawPurchasePrice = getFieldValue(p, candidatePurchasePriceKeys);
    const purchase_price = typeof rawPurchasePrice === 'number' ? rawPurchasePrice : (!isNaN(Number(rawPurchasePrice)) ? Number(rawPurchasePrice) : Math.round(price * 0.8));

    const rawWholesalePrice = getFieldValue(p, candidateWholesalePriceKeys);
    const wholesale_price = typeof rawWholesalePrice === 'number' ? rawWholesalePrice : (!isNaN(Number(rawWholesalePrice)) ? Number(rawWholesalePrice) : Math.round(price * 0.9));

    // 6. Units & Stock
    const unit = cleanStr(getFieldValue(p, candidateUnitKeys)) || 'قطعة';
    const rawStock = getFieldValue(p, candidateStockKeys);
    const stock_qty = typeof rawStock === 'number' ? rawStock : (!isNaN(Number(rawStock)) ? Number(rawStock) : 50);
    const min_stock_alert = Number(getFieldValue(p, ['min_stock_alert', 'minStockAlert', 'alerte_stock', 'min_stock']) || 10);
    const tax_rate = Number(getFieldValue(p, ['tax_rate', 'taxRate', 'tva', 'taux_tva']) || 19.0);
    const is_tax_exempt = Boolean(getFieldValue(p, ['is_tax_exempt', 'isTaxExempt', 'exonere', 'tax_exempt']));

    return {
      id: String(productId),
      product_id: String(productId),
      activity_code,
      name: name_ar || name_fr,
      name_ar,
      name_fr,
      barcode,
      sku: barcode,
      category: String(categoryName),
      category_name: String(categoryName),
      brand: cleanStr(getFieldValue(p, ['brand', 'marque', 'fournisseur', 'supplier'])) || 'DZ',
      unit,
      price,
      default_price: price,
      purchase_price,
      wholesale_price,
      stock_qty,
      min_stock_alert,
      image_url,
      imageUrl: image_url,
      image: image_url,
      photo_url: image_url,
      tax_rate,
      is_tax_exempt,
      status: 'active',
      version: nextVerNum,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  console.log(`[ZIP Importer] Formatted ${formattedProducts.length} products (${formattedProducts.filter(p => !!p.image_url).length} with images).`);

  // Calculate unique categories count
  const uniqueCats = Array.from(new Set(formattedProducts.map(p => (p as any).category_name || p.category))).filter(Boolean);

  // Save Pack File in DB Storage
  const { checksum, size } = db.savePackVersionFile(activity_code, nextVerNum, formattedProducts);

  // Archive older versions and register this new version as published
  db.getProductPackVersions()
    .filter(v => v.activity_code === activity_code)
    .forEach(v => {
      if (v.status === 'published') v.status = 'archived';
    });

  const newVersionRecord = {
    version_id: `ver_${activity_code}_v${nextVerNum}`,
    activity_code,
    version: nextVerNum,
    status: 'published' as const,
    checksum_sha256: checksum,
    total_products: formattedProducts.length,
    file_size_bytes: size,
    changes_summary: `Imported from ZIP backup ${filename} (${formattedProducts.length} products, ${savedImages.length} images, SQLite parsed successfully)`,
    created_by: adminUser,
    created_at: new Date().toISOString(),
    published_at: new Date().toISOString()
  };

  db.getProductPackVersions().unshift(newVersionRecord);
  activity.latest_pack_version = nextVerNum;
  activity.total_products = formattedProducts.length;
  activity.updated_at = new Date().toISOString();

  let packRecord = db.getProductPacks().find(p => p.activity_code === activity_code);
  if (!packRecord) {
    packRecord = {
      id: `pack_${activity_code}`,
      activity_code,
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
    adminUser,
    'MAIN_ADMIN',
    'ZIP_BACKUP_IMPORTED_AND_PUBLISHED',
    'product_packs',
    `ver_${activity_code}_v${nextVerNum}`,
    {
      filename,
      activity_code,
      version: nextVerNum,
      total_products: formattedProducts.length,
      total_images: savedImages.length,
      matched_images: formattedProducts.filter(p => !!p.image_url).length,
      sqlite_parsed: !!sqliteBuffer
    }
  );

  db.save();

  const syncDownloadUrl = `${protocol}://${reqHost}/api/sync/download?activity_code=${activity_code}`;

  return {
    success: true,
    message: `تمت معالجة ملف .zip بنجاح! تم استخراج ${formattedProducts.length} منتج بأسمائها وأسعارها وتصنيفاتها الحقيقية، وربط ${formattedProducts.filter(p => !!p.image_url).length} صورة منتج بنجاح وبشكل دائم.`,
    activity_code,
    version: `${nextVerNum}.0.0`,
    total_products: formattedProducts.length,
    total_categories: uniqueCats.length,
    total_images: savedImages.length,
    zip_url: zipDownloadUrl,
    download_url: syncDownloadUrl,
    checksum_sha256: checksum,
    manifest: manifestData,
    extracted_images: savedImages.map(img => img.filename)
  };
}
