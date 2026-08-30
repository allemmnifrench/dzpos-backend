import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { db } from '../db.js';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const PRODUCTS_DIR = path.join(STORAGE_DIR, 'products');
const PACKS_DIR = path.join(STORAGE_DIR, 'packs');
const VAULT_DIR = path.join(STORAGE_DIR, 'vault');

// In-memory memory image cache to guarantee instant availability across container sessions
const memoryImageCache = new Map<string, { buffer: Buffer; mimeType: string }>();

/**
 * Initializes all storage and image vault directories
 */
export function ensureStorageDirs() {
  const dirs = [STORAGE_DIR, PRODUCTS_DIR, PACKS_DIR, VAULT_DIR];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }
}

/**
 * Determines MIME type from file extension or buffer magic bytes
 */
export function getMimeType(filenameOrExt: string, buffer?: Buffer): string {
  const ext = path.extname(filenameOrExt).toLowerCase().replace('.', '');
  
  if (buffer && buffer.length >= 4) {
    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    // GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'image/gif';
    }
    // WEBP
    if (buffer.length >= 12 && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }
  }

  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg':
    case 'jfif': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    default: return 'image/jpeg';
  }
}

/**
 * Helper to generate a sleek, appetizing culinary SVG card for any dish/product
 */
export function generateDishSvg(dishName: string, categoryName?: string, price?: number): Buffer {
  const cleanName = (dishName || 'وجبة طازجة').trim();
  const lower = cleanName.toLowerCase();
  const catLower = (categoryName || '').toLowerCase();

  let emoji = '🍽️';
  let gradStart = '#18181b';
  let gradEnd = '#09090b';
  let accentColor = '#f43f5e';
  let glowColor = 'rgba(244, 63, 94, 0.25)';

  if (lower.includes('أجنحة') || lower.includes('دجاج') || lower.includes('poulet') || lower.includes('chicken') || lower.includes('طاووق')) {
    emoji = '🍗';
    gradStart = '#451a03';
    gradEnd = '#1c0a00';
    accentColor = '#f97316';
    glowColor = 'rgba(249, 115, 22, 0.3)';
  } else if (lower.includes('بانيني') || lower.includes('panini') || lower.includes('ساندويتش') || lower.includes('sandwich')) {
    emoji = '🥪';
    gradStart = '#291b00';
    gradEnd = '#140c00';
    accentColor = '#eab308';
    glowColor = 'rgba(234, 179, 8, 0.3)';
  } else if (lower.includes('برغر') || lower.includes('burger')) {
    emoji = '🍔';
    gradStart = '#3b0712';
    gradEnd = '#1a0307';
    accentColor = '#f43f5e';
    glowColor = 'rgba(244, 63, 94, 0.35)';
  } else if (lower.includes('تونة') || lower.includes('سمك') || lower.includes('thon') || lower.includes('fish') || lower.includes('poisson')) {
    emoji = '🐟';
    gradStart = '#082f49';
    gradEnd = '#02131f';
    accentColor = '#06b6d4';
    glowColor = 'rgba(6, 182, 212, 0.3)';
  } else if (lower.includes('جبن') || lower.includes('fromage') || lower.includes('cheese') || lower.includes('ألبان')) {
    emoji = '🧀';
    gradStart = '#3a2305';
    gradEnd = '#1c1000';
    accentColor = '#fbbf24';
    glowColor = 'rgba(251, 191, 36, 0.3)';
  } else if (lower.includes('بطاطا') || lower.includes('frites') || lower.includes('fries') || lower.includes('chips')) {
    emoji = '🍟';
    gradStart = '#382003';
    gradEnd = '#1a0d00';
    accentColor = '#f59e0b';
    glowColor = 'rgba(245, 158, 11, 0.3)';
  } else if (lower.includes('بيتزا') || lower.includes('pizza')) {
    emoji = '🍕';
    gradStart = '#450a0a';
    gradEnd = '#1a0202';
    accentColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.35)';
  } else if (lower.includes('مشاوي') || lower.includes('شواء') || lower.includes('grill') || lower.includes('لحم') || lower.includes('كفتة') || lower.includes('مرقاز') || lower.includes('viande')) {
    emoji = '🥩';
    gradStart = '#2e0b0e';
    gradEnd = '#120204';
    accentColor = '#e11d48';
    glowColor = 'rgba(225, 29, 72, 0.35)';
  } else if (lower.includes('عصير') || lower.includes('jus') || lower.includes('juice') || lower.includes('مشروب') || lower.includes('boisson') || lower.includes('كوكا') || lower.includes('soda')) {
    emoji = '🍹';
    gradStart = '#143126';
    gradEnd = '#05140e';
    accentColor = '#10b981';
    glowColor = 'rgba(16, 185, 129, 0.3)';
  } else if (lower.includes('قهوة') || lower.includes('شاي') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('tea')) {
    emoji = '☕';
    gradStart = '#271810';
    gradEnd = '#100804';
    accentColor = '#d97706';
    glowColor = 'rgba(217, 119, 6, 0.3)';
  } else if (lower.includes('حلوى') || lower.includes('كيك') || lower.includes('dessert') || lower.includes('gateau') || lower.includes('cake')) {
    emoji = '🍰';
    gradStart = '#3b0d2d';
    gradEnd = '#170311';
    accentColor = '#ec4899';
    glowColor = 'rgba(236, 72, 153, 0.3)';
  } else if (lower.includes('سلطة') || lower.includes('salade') || lower.includes('salad')) {
    emoji = '🥗';
    gradStart = '#0e2e1b';
    gradEnd = '#031209';
    accentColor = '#22c55e';
    glowColor = 'rgba(34, 197, 94, 0.3)';
  }

  // Safe escape for XML
  const safeName = cleanName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeCat = (categoryName || 'DZPOS Menu').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradStart}"/>
      <stop offset="100%" stop-color="${gradEnd}"/>
    </linearGradient>
    <radialGradient id="glowGrad" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${glowColor}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="400" height="400" rx="32" fill="url(#bgGrad)"/>
  <rect width="400" height="400" rx="32" fill="url(#glowGrad)"/>
  <rect width="396" height="396" x="2" y="2" rx="30" fill="none" stroke="${accentColor}" stroke-opacity="0.25" stroke-width="2"/>

  <!-- Subtle Ambient Circles -->
  <circle cx="200" cy="170" r="100" fill="${accentColor}" fill-opacity="0.06"/>
  <circle cx="200" cy="170" r="75" fill="${accentColor}" fill-opacity="0.1" stroke="${accentColor}" stroke-opacity="0.2" stroke-width="1.5" stroke-dasharray="6 4"/>

  <!-- Central Emoji Icon -->
  <text x="200" y="205" font-size="92" text-anchor="middle" filter="url(#shadow)" font-family="system-ui, -apple-system, Segoe UI, sans-serif">
    ${emoji}
  </text>

  <!-- Dish Name Label -->
  <g transform="translate(200, 315)">
    <rect x="-160" y="-22" width="320" height="44" rx="22" fill="#09090b" fill-opacity="0.85" stroke="${accentColor}" stroke-opacity="0.4" stroke-width="1"/>
    <text x="0" y="6" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="'Alexandria', -apple-system, 'Segoe UI', sans-serif">
      ${safeName}
    </text>
  </g>

  <!-- Category Tag -->
  <text x="200" y="365" font-size="11" font-weight="600" fill="${accentColor}" text-anchor="middle" font-family="'Alexandria', -apple-system, 'Segoe UI', sans-serif" letter-spacing="1">
    ${safeCat.toUpperCase()}
  </text>
</svg>`;

  return Buffer.from(svg, 'utf-8');
}

/**
 * Safely sanitizes filenames preserving Arabic, French, alphanumeric, dashes, dots, and underscores
 */
export function sanitizeImageFilename(rawName: string): string {
  if (!rawName) return `img_${Date.now()}.jpg`;
  
  // Clean path traversal & dangerous characters but preserve Unicode (Arabic, French, etc.)
  const base = path.basename(rawName.trim());
  let ext = path.extname(base);
  let nameWithoutExt = path.basename(base, ext);
  
  // Default to .jpg if no extension or unknown extension
  if (!ext || !/\.(jpe?g|png|webp|gif|svg|bmp|jfif)$/i.test(ext)) {
    ext = '.jpg';
  }
  
  // Remove dangerous characters: / \ : * ? " < > | and control chars
  nameWithoutExt = nameWithoutExt.replace(/[/\\:*?"<>|\x00-\x1F\x7F]/g, '_').trim();
  if (!nameWithoutExt) {
    nameWithoutExt = `img_${Date.now()}`;
  }

  return `${nameWithoutExt}${ext.toLowerCase()}`;
}

/**
 * Stores an image in both memory cache and disk, ensuring persistence
 */
export function saveImageToStore(filename: string, buffer: Buffer): { filename: string; webPath: string } {
  ensureStorageDirs();
  const sanitized = sanitizeImageFilename(filename);
  const mimeType = getMimeType(sanitized, buffer);

  // 1. Keep in memory cache for immediate serving
  memoryImageCache.set(sanitized.toLowerCase(), { buffer, mimeType });
  memoryImageCache.set(sanitized, { buffer, mimeType });

  // 2. Save to /storage/products/
  try {
    const targetPath = path.join(PRODUCTS_DIR, sanitized);
    fs.writeFileSync(targetPath, buffer);
  } catch (err) {
    console.warn(`[ImageStore] Failed saving image ${sanitized} to disk:`, err);
  }

  // 3. Save to /storage/vault/ (backup vault)
  try {
    const vaultPath = path.join(VAULT_DIR, sanitized);
    fs.writeFileSync(vaultPath, buffer);
  } catch (err) {
    // ignore
  }

  return {
    filename: sanitized,
    webPath: `/storage/products/${encodeURIComponent(sanitized)}`
  };
}

/**
 * Retrieves an image buffer. If missing from disk (e.g. after container restart / 1 hour),
 * searches the memory cache, vault, stored ZIP backup archives in /storage/packs/,
 * and if still not found, looks up the product in the DB to generate an instant high-quality dish image!
 */
export async function retrieveImage(filename: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  ensureStorageDirs();
  
  const cleanName = path.basename(decodeURIComponent(filename)).trim();
  const lowerName = cleanName.toLowerCase();
  const baseWithoutExt = path.basename(cleanName, path.extname(cleanName)).toLowerCase();

  // 1. Check memory cache first
  if (memoryImageCache.has(lowerName)) {
    return memoryImageCache.get(lowerName)!;
  }
  if (memoryImageCache.has(cleanName)) {
    return memoryImageCache.get(cleanName)!;
  }

  // 2. Check disk /storage/products/
  const diskPath = path.join(PRODUCTS_DIR, cleanName);
  if (fs.existsSync(diskPath)) {
    try {
      const buf = fs.readFileSync(diskPath);
      const mime = getMimeType(cleanName, buf);
      memoryImageCache.set(lowerName, { buffer: buf, mimeType: mime });
      return { buffer: buf, mimeType: mime };
    } catch (err) {
      console.warn(`[ImageStore] Error reading disk image ${diskPath}:`, err);
    }
  }

  // 3. Check /storage/vault/
  const vaultPath = path.join(VAULT_DIR, cleanName);
  if (fs.existsSync(vaultPath)) {
    try {
      const buf = fs.readFileSync(vaultPath);
      const mime = getMimeType(cleanName, buf);
      // Restore to /storage/products/
      fs.writeFileSync(diskPath, buf);
      memoryImageCache.set(lowerName, { buffer: buf, mimeType: mime });
      return { buffer: buf, mimeType: mime };
    } catch (err) {
      // ignore
    }
  }

  // 4. On-demand Re-hydration from Stored ZIP Packs in /storage/packs/
  if (fs.existsSync(PACKS_DIR)) {
    try {
      const packFiles = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.zip'));
      for (const pFile of packFiles) {
        const packPath = path.join(PACKS_DIR, pFile);
        try {
          const zipData = fs.readFileSync(packPath);
          const zip = new JSZip();
          const loaded = await zip.loadAsync(zipData);
          
          for (const relativePath of Object.keys(loaded.files)) {
            const entry = loaded.files[relativePath];
            if (entry.dir) continue;
            
            const entryBase = path.basename(relativePath);
            const entryLower = entryBase.toLowerCase();
            const entryWithoutExt = path.basename(entryBase, path.extname(entryBase)).toLowerCase();

            if (
              entryLower === lowerName ||
              entryBase === cleanName ||
              entryWithoutExt === baseWithoutExt ||
              relativePath.toLowerCase().includes(lowerName)
            ) {
              const buf = await entry.async('nodebuffer');
              const mime = getMimeType(entryBase, buf);
              
              // Restore to disk and memory cache
              try {
                fs.writeFileSync(diskPath, buf);
              } catch (e) {}
              
              memoryImageCache.set(lowerName, { buffer: buf, mimeType: mime });
              console.log(`[ImageStore] On-the-fly recovered image '${cleanName}' from pack archive '${pFile}'`);
              return { buffer: buf, mimeType: mime };
            }
          }
        } catch (packErr) {
          console.warn(`[ImageStore] Error scanning pack ${pFile}:`, packErr);
        }
      }
    } catch (err) {
      console.warn('[ImageStore] Error searching packs for image:', err);
    }
  }

  // 5. Intelligent Database Lookup & Semantic Dish Image Generator Fallback
  // If the file is still missing (container restart, external URL, or deleted file),
  // search DB for corresponding menu product or product catalog item to generate a stunning visual
  try {
    let matchedDishName = '';
    let matchedCategory = '';

    // Search restaurant menus
    const menus = db.getRestaurantMenus() || [];
    for (const m of menus) {
      const products = m.snapshot?.products || [];
      for (const p of products) {
        if (
          (p.image_url && p.image_url.toLowerCase().includes(lowerName)) ||
          (p.product_id && lowerName.includes(p.product_id.toLowerCase())) ||
          (p.name && lowerName.includes(p.name.toLowerCase()))
        ) {
          matchedDishName = p.name_ar || p.name || '';
          matchedCategory = p.category_name || p.category_id || '';
          break;
        }
      }
      if (matchedDishName) break;
    }

    // Search catalog products
    if (!matchedDishName) {
      const prods = db.getProducts() || [];
      for (const p of prods) {
        if (
          (p.image_url && p.image_url.toLowerCase().includes(lowerName)) ||
          (p.id && lowerName.includes(p.id.toLowerCase())) ||
          (p.barcode && lowerName.includes(p.barcode.toLowerCase())) ||
          (p.name && lowerName.includes(p.name.toLowerCase()))
        ) {
          matchedDishName = p.name_ar || p.name || '';
          matchedCategory = p.category || '';
          break;
        }
      }
    }

    // If filename has readable text without numbers (e.g. "أجنحة_دجاج.jpg" or "panini.jpg")
    if (!matchedDishName) {
      const decodedBase = decodeURIComponent(baseWithoutExt).replace(/[_+\\-]+/g, ' ').trim();
      if (decodedBase.length > 2 && !/^\d+$/.test(decodedBase) && !decodedBase.startsWith('img_') && !decodedBase.startsWith('product_image_')) {
        matchedDishName = decodedBase;
      }
    }

    // Generate responsive dish SVG visual
    const svgBuffer = generateDishSvg(matchedDishName || 'طبق شهي', matchedCategory || 'قائمة الطعام');
    const mimeType = 'image/svg+xml';

    // Cache so subsequent calls are instantaneous
    memoryImageCache.set(lowerName, { buffer: svgBuffer, mimeType });
    memoryImageCache.set(cleanName, { buffer: svgBuffer, mimeType });

    try {
      fs.writeFileSync(diskPath, svgBuffer);
    } catch (e) {}

    return { buffer: svgBuffer, mimeType };
  } catch (err) {
    console.warn('[ImageStore] Error generating fallback dish image:', err);
  }

  return null;
}

/**
 * Rehydrates all images from stored ZIP packs into /storage/products/ during server startup
 */
export async function rehydrateAllPackImages(): Promise<number> {
  ensureStorageDirs();
  let count = 0;

  if (!fs.existsSync(PACKS_DIR)) return 0;

  try {
    const packFiles = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.zip'));
    for (const pFile of packFiles) {
      const packPath = path.join(PACKS_DIR, pFile);
      try {
        const zipData = fs.readFileSync(packPath);
        const zip = new JSZip();
        const loaded = await zip.loadAsync(zipData);

        for (const relativePath of Object.keys(loaded.files)) {
          const entry = loaded.files[relativePath];
          if (entry.dir) continue;

          const baseName = path.basename(relativePath);
          if (/\.(jpe?g|png|webp|gif|svg|bmp|jfif)$/i.test(baseName)) {
            const buf = await entry.async('nodebuffer');
            const sanitized = sanitizeImageFilename(baseName);
            saveImageToStore(sanitized, buf);
            count++;
          }
        }
      } catch (e) {
        console.warn(`[ImageStore] Error rehydrating from ${pFile}:`, e);
      }
    }
  } catch (err) {
    console.warn('[ImageStore] Rehydration error:', err);
  }

  if (count > 0) {
    console.log(`🖼️ [ImageStore] Successfully re-hydrated ${count} product images from stored pack archives`);
  }
  return count;
}
