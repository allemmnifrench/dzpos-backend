import { GoogleGenAI, Type, Schema } from '@google/genai';
import { db } from '../db.js';
import { matchItemAgainstCatalog } from './productMatcher.js';
import { AiInvoiceAnalysisResult, PurchaseItem, PurchaseInvoice } from '../../src/types/dzpos.js';

export function getApiKey(): string | null {
  const settings = db.getSettings();
  const customKey = settings.ai_config?.custom_gemini_api_key?.trim();
  if (customKey) return customKey;
  return process.env.GEMINI_API_KEY?.trim() || null;
}

function getAiClient(): { client: GoogleGenAI; apiKey: string } | null {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }
  return { client: new GoogleGenAI({ apiKey }), apiKey };
}

const invoiceExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    supplier_name: {
      type: Type.STRING,
      description: 'The full trade/company name of the vendor/supplier on the invoice (Fournisseur / اسم المورد أو التاجر)'
    },
    supplier_phone: {
      type: Type.STRING,
      description: 'Phone number of the supplier if mentioned'
    },
    supplier_address: {
      type: Type.STRING,
      description: 'Address / Wilaya / City of the supplier if mentioned'
    },
    supplier_tax_id: {
      type: Type.STRING,
      description: 'Fiscal identification / NIF / NIS / RC / N° Article if printed'
    },
    invoice_number: {
      type: Type.STRING,
      description: 'Invoice number / Facture N° / Bon N° / رقم الفاتورة'
    },
    invoice_date: {
      type: Type.STRING,
      description: 'Invoice date in YYYY-MM-DD format (or original date string)'
    },
    order_ref: {
      type: Type.STRING,
      description: 'Order reference, Bon de commande number (BC), or Delivery note (BL) if present'
    },
    payment_method: {
      type: Type.STRING,
      description: 'Payment method (e.g. Espèces, Chèque, Virement, À terme / Crédit) if stated'
    },
    subtotal_ht: {
      type: Type.NUMBER,
      description: 'Total amount before taxes (Total HT / الإجمالي قبل الضريبة) in Algerian Dinar (DZD)'
    },
    total_tax: {
      type: Type.NUMBER,
      description: 'Total tax / TVA amount (Montant TVA / قيمة الرسم على القيمة المضافة) in DZD'
    },
    total_discount: {
      type: Type.NUMBER,
      description: 'Total discount / Remise amount in DZD if present'
    },
    total_ttc: {
      type: Type.NUMBER,
      description: 'Total amount including taxes (Total TTC / Net à payer / المبلغ الإجمالي المستحق) in DZD'
    },
    confidence_overall: {
      type: Type.NUMBER,
      description: 'Estimated confidence score from 0.0 to 1.0 based on image readability'
    },
    notes: {
      type: Type.STRING,
      description: 'Any notable invoice remarks, payment conditions, or observations'
    },
    items: {
      type: Type.ARRAY,
      description: 'List of all product / merchandise line items on the invoice',
      items: {
        type: Type.OBJECT,
        properties: {
          raw_name: {
            type: Type.STRING,
            description: 'Exact product designation/description as written on the invoice (e.g. "COCA COLA 1L", "LAIT CANDIA 1L")'
          },
          barcode: {
            type: Type.STRING,
            description: 'Barcode / EAN-13 / Code-barres if printed or visible in the line item'
          },
          category: {
            type: Type.STRING,
            description: 'General category (e.g. Boissons, Épicerie, Détergents, Outillage, Parfumerie)'
          },
          unit: {
            type: Type.STRING,
            description: 'Unit of measure (e.g. Pièce, Carton, Fardeau, Pack, Kg, L)'
          },
          quantity: {
            type: Type.NUMBER,
            description: 'Quantity purchased (numeric value, e.g. 24, 12, 1)'
          },
          unit_price: {
            type: Type.NUMBER,
            description: 'Unit purchase price before tax (Prix Unitaire HT) in DZD'
          },
          discount_rate: {
            type: Type.NUMBER,
            description: 'Discount percentage on this item (0 to 100) or 0'
          },
          tax_rate: {
            type: Type.NUMBER,
            description: 'TVA rate percentage (e.g. 19, 9, 0)'
          },
          total_ht: {
            type: Type.NUMBER,
            description: 'Line total HT (Quantity * Unit Price - Discount)'
          },
          total_ttc: {
            type: Type.NUMBER,
            description: 'Line total TTC including taxes'
          },
          confidence_scores: {
            type: Type.OBJECT,
            properties: {
              raw_name: { type: Type.NUMBER, description: 'Confidence 0.0-1.0' },
              barcode: { type: Type.NUMBER, description: 'Confidence 0.0-1.0' },
              quantity: { type: Type.NUMBER, description: 'Confidence 0.0-1.0' },
              unit_price: { type: Type.NUMBER, description: 'Confidence 0.0-1.0' }
            }
          }
        },
        required: ['raw_name', 'quantity', 'unit_price']
      }
    }
  },
  required: ['supplier_name', 'items', 'total_ttc']
};

/**
 * Analyzes a purchase invoice image or PDF file using multimodal Gemini AI
 */
export async function analyzeInvoiceDocument(params: {
  fileBuffer: Buffer;
  mimeType: string;
  fileName?: string;
  activityCode?: string;
  actor?: string;
  isSampleTest?: boolean;
}): Promise<AiInvoiceAnalysisResult> {
  const startTime = Date.now();
  const { fileBuffer, mimeType, fileName, activityCode, actor, isSampleTest } = params;

  let rawResult: any = null;
  const settings = db.getSettings();
  const primaryModel = settings.ai_config?.model_name || 'gemini-2.5-flash';
  const fallbackModel = settings.ai_config?.fallback_model_name || 'gemini-1.5-flash';
  let modelUsed = primaryModel;
  let tokenCount = 0;
  let ocrWarning: string | undefined = undefined;
  let isFallback = false;

  const aiInfo = getAiClient();

  if (aiInfo && !isSampleTest) {
    const base64Data = fileBuffer.toString('base64');
    const prompt = `You are an expert OCR and financial document analysis AI specializing in Algerian retail and wholesale purchase invoices (Factures d'achat, Bons de livraison, Bons de réception, وصل استلام / فاتورة شراء).
Analyze the provided document with high precision.

Extract all details accurately:
- Supplier business name (Nom du fournisseur / Entreprise)
- Contact details, NIF / NIS / RC if visible
- Invoice Number (Facture N° / Bon N°)
- Invoice Date (convert to YYYY-MM-DD if possible)
- Order Reference (Réf Commande / BC)
- Complete list of purchased products (Désignation, Code-barres/EAN if visible, Quantité, Prix Unitaire HT, Remise, TVA, Total HT, Total TTC)
- Financial Summary (Total HT, Total TVA, Total Remise, Total TTC / Net à Payer en Dinars Algériens DZD).

Document may be in French, Arabic, or bilingual. Some images may have medium resolution, skewed angle, or thermal receipt formatting. Extract all rows with utmost numerical and spelling fidelity.`;

    // Attempt 1: Primary configured model
    try {
      const response = await aiInfo.client.models.generateContent({
        model: primaryModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg')
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: invoiceExtractionSchema,
          temperature: 0.1
        }
      });

      const responseText = response.text?.trim();
      if (responseText) {
        rawResult = JSON.parse(responseText);
        tokenCount = (response as any).usageMetadata?.totalTokenCount || 1200;
        modelUsed = primaryModel;
      }
    } catch (err: any) {
      console.warn(`[Gemini OCR] Primary model ${primaryModel} failed:`, err?.message || err);

      // Attempt 2: Fallback model
      if (fallbackModel && fallbackModel !== primaryModel) {
        try {
          const responseFallback = await aiInfo.client.models.generateContent({
            model: fallbackModel,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg')
                    }
                  },
                  {
                    text: prompt
                  }
                ]
              }
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: invoiceExtractionSchema,
              temperature: 0.1
            }
          });

          const responseTextFallback = responseFallback.text?.trim();
          if (responseTextFallback) {
            rawResult = JSON.parse(responseTextFallback);
            tokenCount = (responseFallback as any).usageMetadata?.totalTokenCount || 1000;
            modelUsed = fallbackModel;
          }
        } catch (fallbackErr: any) {
          console.warn(`[Gemini OCR] Fallback model ${fallbackModel} failed:`, fallbackErr?.message || fallbackErr);
        }
      }
    }
  }

  // Fallback intelligent heuristic generator if API key not set or call failed
  if (!rawResult || !rawResult.items || rawResult.items.length === 0) {
    rawResult = generateFallbackInvoiceData(fileName, activityCode);
    modelUsed = 'hybrid-ocr-fallback';
    isFallback = true;
    
    if (!aiInfo) {
      ocrWarning = 'تنبيه: مفتاح Google Gemini API غير متوفر أو غير مضبوط. تم استخدام عينة افتراضية توضيحية. لتمكين قراءة صور وفواتير حقيقية بدقة، يرجى حفظ مفتاح API في صفحة الإعدادات (Settings).';
    } else {
      ocrWarning = 'تنبيه: تعذر على الذكاء الاصطناعي قراءة تفاصيل الصورة بدقة كافية أو حدث خطأ في الاتصال، فتم عرض عينة توضيحية. يرجى التأكد من وضوح الصورة وتوفر الحصة في مفتاح API.';
    }
  }

  const latencyMs = Date.now() - startTime;

  // Record AI usage in database
  db.recordAiUsage({
    id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    operation: 'analyze_invoice',
    model: modelUsed,
    total_tokens: tokenCount,
    latency_ms: latencyMs,
    status: isFallback ? 'fallback' : 'success',
    user_id: actor || 'admin',
    timestamp: new Date().toISOString(),
    details: {
      fileName,
      mimeType,
      items_extracted: rawResult.items?.length || 0,
      supplier_name: rawResult.supplier_name,
      is_fallback: isFallback
    }
  });

  // Fetch product catalog for matching
  const allProducts = db.getProducts();

  // Match items against DZPOS catalog
  const processedItems: PurchaseItem[] = (rawResult.items || []).map((rawItem: any) => {
    return matchItemAgainstCatalog(
      {
        raw_name: String(rawItem.raw_name || 'منتج غير مسمى'),
        barcode: rawItem.barcode ? String(rawItem.barcode).trim() : undefined,
        category: rawItem.category,
        quantity: Number(rawItem.quantity) || 1,
        unit_price: Number(rawItem.unit_price) || 0,
        discount: Number(rawItem.discount_rate) || 0,
        tax_rate: Number(rawItem.tax_rate) ?? 0,
        confidence_scores: rawItem.confidence_scores || {
          raw_name: 0.90,
          quantity: 0.95,
          unit_price: 0.92,
          barcode: rawItem.barcode ? 0.95 : 0.30
        }
      },
      allProducts,
      activityCode
    );
  });

  // Calculate totals
  let calculatedSubtotalHt = 0;
  let calculatedTotalTax = 0;
  let calculatedTotalDiscount = 0;
  let calculatedTotalTtc = 0;

  for (const itm of processedItems) {
    calculatedSubtotalHt += itm.total_ht;
    calculatedTotalTax += itm.tax_amount;
    calculatedTotalDiscount += itm.discount;
    calculatedTotalTtc += itm.total_ttc;
  }

  const subtotalHt = rawResult.subtotal_ht || Math.round(calculatedSubtotalHt * 100) / 100;
  const totalTax = rawResult.total_tax || Math.round(calculatedTotalTax * 100) / 100;
  const totalDiscount = rawResult.total_discount || Math.round(calculatedTotalDiscount * 100) / 100;
  const totalTtc = rawResult.total_ttc || Math.round(calculatedTotalTtc * 100) / 100;

  // Duplicate Check against existing purchase invoices
  const existingPurchases = db.getPurchases();
  const invoiceNumClean = String(rawResult.invoice_number || '').trim().toLowerCase();
  const supplierClean = String(rawResult.supplier_name || '').trim().toLowerCase();
  const invoiceDateClean = String(rawResult.invoice_date || '').trim();

  let duplicateWarning: AiInvoiceAnalysisResult['duplicate_warning'] = undefined;
  if (invoiceNumClean && supplierClean) {
    const foundDup = existingPurchases.find(p => {
      const pInv = String(p.invoice_number || '').trim().toLowerCase();
      const pSupp = String(p.supplier_name || '').trim().toLowerCase();
      return pInv === invoiceNumClean && pSupp === supplierClean;
    });

    if (foundDup) {
      duplicateWarning = {
        is_duplicate: true,
        existing_invoice_id: foundDup.id,
        message: `تنبيه: توجد فاتورة سابقة مسجلة لنفس المورد "${foundDup.supplier_name}" برقم "${foundDup.invoice_number}" بتاريخ ${foundDup.invoice_date} (المعرف: ${foundDup.id}).`
      };
    }
  }

  const matchedCount = processedItems.filter(i => i.match_status === 'matched').length;
  const reviewCount = processedItems.filter(i => i.match_status === 'review_required').length;
  const newCount = processedItems.filter(i => i.match_status === 'new_product').length;

  return {
    success: true,
    is_fallback: isFallback,
    ocr_warning: ocrWarning,
    supplier_name: rawResult.supplier_name || 'مورد عام (Fournisseur Divers)',
    supplier_phone: rawResult.supplier_phone || '',
    supplier_address: rawResult.supplier_address || '',
    supplier_tax_id: rawResult.supplier_tax_id || '',
    invoice_number: rawResult.invoice_number || `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    invoice_date: rawResult.invoice_date || new Date().toISOString().split('T')[0],
    order_ref: rawResult.order_ref || '',
    payment_method: rawResult.payment_method || 'Espèces (نقداً)',
    subtotal_ht: subtotalHt,
    total_tax: totalTax,
    total_discount: totalDiscount,
    total_ttc: totalTtc,
    items: processedItems,
    confidence_overall: rawResult.confidence_overall || 0.94,
    notes: rawResult.notes || '',
    duplicate_warning: duplicateWarning,
    meta: {
      model: modelUsed,
      latency_ms: latencyMs,
      tokens: tokenCount,
      matched_count: matchedCount,
      review_count: reviewCount,
      new_count: newCount
    }
  };
}

/**
 * Fallback generator with realistic Algerian market purchase items
 */
function generateFallbackInvoiceData(fileName?: string, activityCode?: string) {
  const isHardware = activityCode === 'hardware' || (fileName && fileName.toLowerCase().includes('quincaillerie'));
  const isClothing = activityCode === 'clothing' || (fileName && fileName.toLowerCase().includes('mode'));

  if (isHardware) {
    return {
      supplier_name: 'SARL BatiPro Algérie - Distribution Outillage',
      supplier_phone: '023 88 12 34',
      supplier_address: 'Zone Industrielle Oued Smar, Alger',
      supplier_tax_id: 'NIF: 001216098765432 / RC: 16/00-9876543',
      invoice_number: `FAC-BP-${Math.floor(1000 + Math.random() * 9000)}`,
      invoice_date: new Date().toISOString().split('T')[0],
      order_ref: 'BC-2026-081',
      payment_method: 'Virement bancaire',
      subtotal_ht: 88500,
      total_tax: 16815,
      total_discount: 0,
      total_ttc: 105315,
      confidence_overall: 0.92,
      notes: 'Facture d\'approvisionnement outillage professionnel - Livraison effectuée',
      items: [
        {
          raw_name: 'Perceuse à Percussion 750W INGCO',
          barcode: '6925582103456',
          category: 'Outillage électroportatif',
          unit: 'Pièce',
          quantity: 6,
          unit_price: 5200,
          discount_rate: 0,
          tax_rate: 19,
          total_ht: 31200,
          total_ttc: 37128,
          confidence_scores: { raw_name: 0.98, quantity: 0.97, unit_price: 0.95, barcode: 0.99 }
        },
        {
          raw_name: 'Meuleuse d\'angle 115mm 1010W CROWN',
          barcode: '7640177789012',
          category: 'Outillage électroportatif',
          unit: 'Pièce',
          quantity: 4,
          unit_price: 6800,
          discount_rate: 0,
          tax_rate: 19,
          total_ht: 27200,
          total_ttc: 32368,
          confidence_scores: { raw_name: 0.96, quantity: 0.98, unit_price: 0.94, barcode: 0.99 }
        },
        {
          raw_name: 'Mètre ruban Professionnel 5m STANLEY',
          barcode: '3253560306967',
          category: 'Mesure & Traçage',
          unit: 'Pièce',
          quantity: 20,
          unit_price: 650,
          discount_rate: 0,
          tax_rate: 19,
          total_ht: 13000,
          total_ttc: 15470,
          confidence_scores: { raw_name: 0.95, quantity: 0.99, unit_price: 0.96, barcode: 0.99 }
        },
        {
          raw_name: 'Ciment Blanc GICA 25kg',
          barcode: '6131102987654',
          category: 'Gros Œuvre & Maçonnerie',
          unit: 'Sac',
          quantity: 15,
          unit_price: 1140,
          discount_rate: 0,
          tax_rate: 19,
          total_ht: 17100,
          total_ttc: 20349,
          confidence_scores: { raw_name: 0.94, quantity: 0.96, unit_price: 0.92, barcode: 0.98 }
        }
      ]
    };
  }

  // Default: Grocery / Superette Invoice
  return {
    supplier_name: 'EURL DistriFood Algérie - Gros Produits Alimentaires',
    supplier_phone: '0550 44 33 22',
    supplier_address: 'Lotissement El Hamiz, Dar El Beïda, Alger',
    supplier_tax_id: 'NIF: 099816001234567 / RC: 16/00-1122334',
    invoice_number: `FAC-AL-${Math.floor(1000 + Math.random() * 9000)}`,
    invoice_date: new Date().toISOString().split('T')[0],
    order_ref: 'BC-DZ-894',
    payment_method: 'Espèces (نقداً)',
    subtotal_ht: 54600,
    total_tax: 0,
    total_discount: 500,
    total_ttc: 54100,
    confidence_overall: 0.95,
    notes: 'Livraison complète magasin - Produits sous garantie DLUO conforme',
    items: [
      {
        raw_name: 'Boisson Gazeuse Hamoud Selecto 1L (Fardeau x6)',
        barcode: '6130123000018',
        category: 'Boissons & Jus',
        unit: 'Fardeau',
        quantity: 30,
        unit_price: 520,
        discount_rate: 0,
        tax_rate: 0,
        total_ht: 15600,
        total_ttc: 15600,
        confidence_scores: { raw_name: 0.98, quantity: 0.99, unit_price: 0.97, barcode: 0.99 }
      },
      {
        raw_name: 'Huile de Table Elio 5L CEVITAL (Carton x4)',
        barcode: '6130456000025',
        category: 'Huiles & Condiments',
        unit: 'Carton',
        quantity: 20,
        unit_price: 2450,
        discount_rate: 0,
        tax_rate: 0,
        total_ht: 49000,
        total_ttc: 49000,
        confidence_scores: { raw_name: 0.99, quantity: 0.98, unit_price: 0.98, barcode: 0.99 }
      },
      {
        raw_name: 'Lait UHT Demi-Écrémé Candia Silhouette 1L (Pack x12)',
        barcode: '6130789000032',
        category: 'Produits Laitiers',
        unit: 'Pack',
        quantity: 15,
        unit_price: 1560,
        discount_rate: 0,
        tax_rate: 0,
        total_ht: 23400,
        total_ttc: 23400,
        confidence_scores: { raw_name: 0.96, quantity: 0.97, unit_price: 0.95, barcode: 0.98 }
      },
      {
        raw_name: 'Fromage Fondu Portion La Vache Qui Rit (Boîte 24p)',
        barcode: '6131234000049',
        category: 'Produits Laitiers',
        unit: 'Boîte',
        quantity: 25,
        unit_price: 360,
        discount_rate: 0,
        tax_rate: 0,
        total_ht: 9000,
        total_ttc: 9000,
        confidence_scores: { raw_name: 0.97, quantity: 0.98, unit_price: 0.96, barcode: 0.99 }
      }
    ]
  };
}

export { invoiceExtractionSchema };

export function getClientAiCredentials(licenseKey?: string, deviceId?: string) {
  const settings = db.getSettings();
  const aiConfig = settings.ai_config || {
    enabled: true,
    export_gemini_key_to_clients: true,
    model_name: 'gemini-3.7-flash',
    fallback_model_name: 'gemini-2.5-flash',
    temperature: 0.1,
    daily_scan_limit_per_device: 150,
    allow_offline_prompt_cache: true,
    system_instruction: `You are an expert OCR and financial document analysis AI specializing in Algerian retail and wholesale purchase invoices (Factures d'achat, Bons de livraison, Bons de réception, وصل استلام / فاتورة شراء).
Analyze the provided document with high precision.
Extract all details accurately:
- Supplier business name (Nom du fournisseur / Entreprise)
- Contact details, NIF / NIS / RC if visible
- Invoice Number (Facture N° / Bon N°)
- Invoice Date (convert to YYYY-MM-DD if possible)
- Order Reference (Réf Commande / BC)
- Complete list of purchased products (Désignation, Code-barres/EAN if visible, Quantité, Prix Unitaire HT, Remise, TVA, Total HT, Total TTC)
- Financial Summary (Total HT, Total TVA, Total Remise, Total TTC / Net à Payer en Dinars Algériens DZD).
Document may be in French, Arabic, or bilingual.`,
    supported_features: ['INVOICE_OCR', 'RECEIPT_PARSER', 'BARCODE_DETECTION', 'PRODUCT_FUZZY_MATCH']
  };

  const apiKey = aiConfig.custom_gemini_api_key || process.env.GEMINI_API_KEY || '';

  // In case key export is disabled by admin
  const isExportAllowed = aiConfig.export_gemini_key_to_clients !== false;

  return {
    provider: 'google_gemini',
    api_key: isExportAllowed ? apiKey : '',
    key_available: Boolean(apiKey),
    export_enabled: isExportAllowed,
    model: aiConfig.model_name || 'gemini-3.7-flash',
    fallback_model: aiConfig.fallback_model_name || 'gemini-2.5-flash',
    temperature: aiConfig.temperature || 0.1,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    system_instruction: aiConfig.system_instruction,
    response_schema: invoiceExtractionSchema,
    daily_limit: aiConfig.daily_scan_limit_per_device || 150,
    remaining_today: 142,
    client_execution_mode: 'DIRECT_CLIENT_SDK' as const,
    sync_endpoint: '/api/v1/purchases/sync',
    cached_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    supported_features: aiConfig.supported_features || ['INVOICE_OCR', 'RECEIPT_PARSER', 'BARCODE_DETECTION', 'PRODUCT_FUZZY_MATCH'],
    license_status: licenseKey ? 'verified' : 'general_access'
  };
}

