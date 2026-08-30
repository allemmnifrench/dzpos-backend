import { Product, MatchedCandidate, PurchaseItem } from '../../src/types/dzpos.js';

/**
 * Normalizes text for robust multi-lingual (Arabic, French, English) matching
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove french accents
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // keep alphanumeric, spaces, and arabic
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts volume / weight / count tokens (e.g. "1l", "1.5l", "33cl", "250g", "1kg")
 */
function extractQuantityAttributes(str: string): string[] {
  const norm = str.toLowerCase();
  const matches = norm.match(/\b\d+(\.\d+)?\s*(l|litre|litres|cl|ml|g|gr|grammes|kg|kilo|kilos|pcs|piece|pieces|bt|bte|pack|x\d+)\b/g);
  return matches ? matches.map(m => m.replace(/\s+/g, '')) : [];
}

/**
 * Levenshtein distance similarity (0.0 to 1.0)
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * Jaccard token overlap similarity (0.0 to 1.0)
 */
function tokenJaccardSimilarity(s1: string, s2: string): number {
  const tokens1 = new Set(s1.split(' ').filter(t => t.length > 1));
  const tokens2 = new Set(s2.split(' ').filter(t => t.length > 1));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) {
      intersection++;
    }
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Computes composite match score between invoice raw item and catalog product
 */
export function calculateMatchScore(rawItem: { raw_name: string; barcode?: string }, product: Product): number {
  // 1. Exact Barcode Match
  if (rawItem.barcode && product.barcode) {
    const cleanRawBarcode = rawItem.barcode.trim().replace(/\s+/g, '');
    const cleanProdBarcode = product.barcode.trim().replace(/\s+/g, '');
    if (cleanRawBarcode.length >= 6 && cleanRawBarcode === cleanProdBarcode) {
      return 1.0; // 100% Certainty
    }
  }

  const normRaw = normalizeText(rawItem.raw_name);
  const normProd = normalizeText(product.name);
  const normProdAr = normalizeText(product.name_ar || '');
  const normProdFr = normalizeText(product.name_fr || '');

  if (normRaw === normProd || normRaw === normProdAr || normRaw === normProdFr) {
    return 0.98;
  }

  // Token similarities against all names
  const simName = tokenJaccardSimilarity(normRaw, normProd);
  const simAr = normProdAr ? tokenJaccardSimilarity(normRaw, normProdAr) : 0;
  const simFr = normProdFr ? tokenJaccardSimilarity(normRaw, normProdFr) : 0;
  const bestTokenSim = Math.max(simName, simAr, simFr);

  // Levenshtein similarity
  const levSim = Math.max(
    levenshteinSimilarity(normRaw, normProd),
    normProdFr ? levenshteinSimilarity(normRaw, normProdFr) : 0
  );

  // Substring inclusion bonus
  let inclusionBonus = 0;
  if (normRaw.includes(normProd) || normProd.includes(normRaw)) {
    inclusionBonus = 0.25;
  } else if (normProdFr && (normRaw.includes(normProdFr) || normProdFr.includes(normRaw))) {
    inclusionBonus = 0.25;
  }

  // Volume / size attribute verification
  const rawAttrs = extractQuantityAttributes(rawItem.raw_name);
  const prodAttrs = extractQuantityAttributes(`${product.name} ${product.name_fr || ''}`);
  let attrMultiplier = 1.0;
  if (rawAttrs.length > 0 && prodAttrs.length > 0) {
    const common = rawAttrs.filter(a => prodAttrs.includes(a));
    if (common.length > 0) {
      attrMultiplier = 1.15;
    } else {
      // Conflicting volumes (e.g. 1L vs 1.5L)
      attrMultiplier = 0.75;
    }
  }

  // Brand match bonus
  let brandBonus = 0;
  if (product.brand) {
    const normBrand = normalizeText(product.brand);
    if (normBrand.length > 2 && normRaw.includes(normBrand)) {
      brandBonus = 0.15;
    }
  }

  const baseScore = (bestTokenSim * 0.55) + (levSim * 0.35) + inclusionBonus + brandBonus;
  const finalScore = Math.min(0.99, baseScore * attrMultiplier);

  return Math.round(finalScore * 100) / 100;
}

/**
 * Matches an extracted invoice item against the DZPOS product catalog
 */
export function matchItemAgainstCatalog(
  rawItem: {
    raw_name: string;
    barcode?: string;
    category?: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    tax_rate?: number;
    confidence_scores?: Record<string, number>;
  },
  catalog: Product[],
  activityCode?: string
): PurchaseItem {
  const targetList = (activityCode && activityCode !== 'all')
    ? catalog.filter(p => p.activity_code === activityCode)
    : catalog;

  // 1. Direct Barcode Search
  if (rawItem.barcode && rawItem.barcode.trim().length >= 6) {
    const cleanBc = rawItem.barcode.trim();
    const barcodeMatch = targetList.find(p => p.barcode === cleanBc);
    if (barcodeMatch) {
      const unitPrice = rawItem.unit_price || barcodeMatch.purchase_price || 0;
      const discount = rawItem.discount || 0;
      const taxRate = rawItem.tax_rate ?? barcodeMatch.tax_rate ?? 0;
      const totalHt = Math.max(0, (rawItem.quantity * unitPrice) - discount);
      const taxAmount = Math.round((totalHt * (taxRate / 100)) * 100) / 100;
      const totalTtc = totalHt + taxAmount;

      return {
        id: `pi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        product_id: barcodeMatch.product_id,
        matched_product_name: barcodeMatch.name,
        raw_name: rawItem.raw_name,
        barcode: barcodeMatch.barcode,
        category: barcodeMatch.category || rawItem.category,
        quantity: rawItem.quantity || 1,
        unit_price: unitPrice,
        selling_price: barcodeMatch.price || barcodeMatch.default_price,
        discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_ht: totalHt,
        total_ttc: totalTtc,
        confidence: {
          raw_name: rawItem.confidence_scores?.raw_name ?? 0.95,
          barcode: 1.0,
          quantity: rawItem.confidence_scores?.quantity ?? 0.95,
          unit_price: rawItem.confidence_scores?.unit_price ?? 0.95,
          product_match: 1.0
        },
        match_status: 'matched',
        matched_candidates: [{
          product_id: barcodeMatch.product_id,
          name: barcodeMatch.name,
          name_ar: barcodeMatch.name_ar,
          name_fr: barcodeMatch.name_fr,
          barcode: barcodeMatch.barcode,
          category: barcodeMatch.category,
          price: barcodeMatch.price || barcodeMatch.default_price,
          purchase_price: barcodeMatch.purchase_price || 0,
          score: 1.0
        }]
      };
    }
  }

  // 2. Fuzzy Score Evaluation
  const scoredCandidates: Array<{ product: Product; score: number }> = [];

  for (const prod of targetList) {
    const score = calculateMatchScore(rawItem, prod);
    if (score >= 0.32) {
      scoredCandidates.push({ product: prod, score });
    }
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  const topCandidates: MatchedCandidate[] = scoredCandidates.slice(0, 4).map(c => ({
    product_id: c.product.product_id,
    name: c.product.name,
    name_ar: c.product.name_ar,
    name_fr: c.product.name_fr,
    barcode: c.product.barcode,
    category: c.product.category,
    price: c.product.price || c.product.default_price,
    purchase_price: c.product.purchase_price || 0,
    score: c.score
  }));

  const bestMatch = topCandidates[0];
  const unitPrice = rawItem.unit_price || (bestMatch ? bestMatch.purchase_price : 0);
  const discount = rawItem.discount || 0;
  const taxRate = rawItem.tax_rate ?? 0;
  const totalHt = Math.max(0, (rawItem.quantity * unitPrice) - discount);
  const taxAmount = Math.round((totalHt * (taxRate / 100)) * 100) / 100;
  const totalTtc = totalHt + taxAmount;

  // Decide match status based on threshold
  let matchStatus: PurchaseItem['match_status'] = 'new_product';
  let matchedProductId: string | undefined = undefined;
  let matchedProductName: string | undefined = undefined;
  let sellingPrice: number | undefined = undefined;

  if (bestMatch && bestMatch.score >= 0.80) {
    matchStatus = 'matched';
    matchedProductId = bestMatch.product_id;
    matchedProductName = bestMatch.name;
    sellingPrice = bestMatch.price;
  } else if (bestMatch && bestMatch.score >= 0.38) {
    matchStatus = 'review_required';
    matchedProductId = bestMatch.product_id;
    matchedProductName = bestMatch.name;
    sellingPrice = bestMatch.price;
  } else {
    matchStatus = 'new_product';
    sellingPrice = Math.round(unitPrice * 1.25); // default markup 25% for new items
  }

  return {
    id: `pi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    product_id: matchedProductId,
    matched_product_name: matchedProductName,
    raw_name: rawItem.raw_name,
    barcode: rawItem.barcode || (bestMatch?.barcode || ''),
    category: bestMatch?.category || rawItem.category || 'عام',
    quantity: rawItem.quantity || 1,
    unit_price: unitPrice,
    selling_price: sellingPrice,
    discount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_ht: totalHt,
    total_ttc: totalTtc,
    confidence: {
      raw_name: rawItem.confidence_scores?.raw_name ?? 0.88,
      barcode: rawItem.barcode ? (rawItem.confidence_scores?.barcode ?? 0.90) : 0.40,
      quantity: rawItem.confidence_scores?.quantity ?? 0.92,
      unit_price: rawItem.confidence_scores?.unit_price ?? 0.90,
      product_match: bestMatch ? bestMatch.score : 0.20
    },
    match_status: matchStatus,
    matched_candidates: topCandidates,
    is_new_product: matchStatus === 'new_product'
  };
}
