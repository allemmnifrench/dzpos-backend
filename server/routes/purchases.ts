import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db } from '../db.js';
import { analyzeInvoiceDocument, getClientAiCredentials } from '../services/invoiceAiService.js';
import { matchItemAgainstCatalog } from '../services/productMatcher.js';
import { PurchaseInvoice, Supplier } from '../../src/types/dzpos.js';

export const purchasesRouter = express.Router();

/**
 * GET /api/purchases/ai-credentials & GET /api/v1/ai/credentials
 * Exports Gemini AI credentials, prompt schemas, and model parameters to POS terminals & client apps.
 * The backend acts as the secure source/hub distributing the AI configuration to licensed apps.
 */
purchasesRouter.get('/ai-credentials', (req, res) => {
  try {
    const licenseKey = (req.headers['x-license-key'] as string) || (req.query.license_key as string);
    const deviceId = (req.headers['x-device-fingerprint'] as string) || (req.headers['x-device-id'] as string) || (req.query.device_id as string);
    const credentials = getClientAiCredentials(licenseKey, deviceId);
    return res.json({
      success: true,
      message: 'AI credentials and prompt configuration exported successfully for client-side processing',
      data: credentials
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/purchases/sync
 * Syncs purchase receipts processed directly by the client app / Android POS back to the central backend.
 */
purchasesRouter.post('/sync', (req, res) => {
  try {
    const actor = (req.headers['x-actor'] as string) || (req.headers['x-device-name'] as string) || 'pos_client_app';
    const payload = req.body;

    if (Array.isArray(payload)) {
      const results = payload.map(item => db.createPurchase(item, actor));
      return res.json({
        success: true,
        message: `Synced ${results.length} client-processed purchase records successfully`,
        data: results
      });
    } else if (payload && payload.supplier_name) {
      const created = db.createPurchase(payload, actor);
      return res.json({
        success: true,
        message: 'Client-processed purchase record synced successfully',
        data: created
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid purchase payload received for sync' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Ensure storage directory exists for uploaded invoices
const INVOICES_STORAGE_DIR = path.join(process.cwd(), 'data', 'invoices');
if (!fs.existsSync(INVOICES_STORAGE_DIR)) {
  fs.mkdirSync(INVOICES_STORAGE_DIR, { recursive: true });
}

// Multer in-memory upload handler (up to 30MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }
});

/**
 * Serve saved invoice files (images / PDFs)
 */
purchasesRouter.get('/invoices/file/:fileName', (req, res) => {
  const safeName = path.basename(req.params.fileName);
  const filePath = path.join(INVOICES_STORAGE_DIR, safeName);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ success: false, message: 'Invoice file not found' });
  }
});

/**
 * Analyze an invoice document (Photo / Scanned image / PDF) using AI (Gemini 3.7)
 * Accepts either multipart/form-data upload with field 'file' OR JSON with 'image_base64'
 */
purchasesRouter.post('/analyze-invoice', upload.single('file'), async (req, res) => {
  try {
    let fileBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    let fileName = `invoice_${Date.now()}.jpg`;
    let activityCode = (req.body?.activity_code as string) || 'grocery';
    const actor = (req.headers['x-actor'] as string) || 'admin';

    // 1. Check if multipart file uploaded
    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/jpeg';
      fileName = req.file.originalname || fileName;
    }
    // 2. Check if base64 provided in JSON body
    else if (req.body?.image_base64) {
      const b64Data = req.body.image_base64;
      const match = b64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        fileBuffer = Buffer.from(match[2], 'base64');
      } else {
        fileBuffer = Buffer.from(b64Data, 'base64');
      }
      if (req.body.file_name) fileName = req.body.file_name;
      if (req.body.mime_type) mimeType = req.body.mime_type;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid invoice file or image data received. Please provide a photo or PDF document.'
      });
    }

    // Save copy to local disk for audit & visualization
    const ext = path.extname(fileName) || (mimeType === 'application/pdf' ? '.pdf' : '.jpg');
    const storedFileName = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    const storedFilePath = path.join(INVOICES_STORAGE_DIR, storedFileName);
    fs.writeFileSync(storedFilePath, fileBuffer);
    const fileUrl = `/api/purchases/invoices/file/${storedFileName}`;

    console.log(`🔍 [AI Invoice Analysis] Starting analysis for file: ${fileName} (${fileBuffer.length} bytes, ${mimeType})...`);

    const isSampleTest = req.body?.is_sample_test === 'true' || req.body?.is_sample_test === true;

    // Run AI analysis through Gemini service
    const analysisResult = await analyzeInvoiceDocument({
      fileBuffer,
      mimeType,
      fileName,
      activityCode,
      actor,
      isSampleTest
    });

    // Attach file URL for client review
    analysisResult.file_url = fileUrl;
    analysisResult.file_name = fileName;

    return res.json({
      success: true,
      data: analysisResult
    });
  } catch (error: any) {
    console.error('❌ Error analyzing invoice with AI:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze invoice with AI.'
    });
  }
});

/**
 * Real-time matching single product against catalog
 */
purchasesRouter.post('/match-product', (req, res) => {
  try {
    const { raw_name, barcode, activity_code, quantity, unit_price } = req.body;
    const catalog = db.getProducts();
    const match = matchItemAgainstCatalog(
      {
        raw_name: raw_name || '',
        barcode: barcode || '',
        quantity: quantity || 1,
        unit_price: unit_price || 0
      },
      catalog,
      activity_code || 'grocery'
    );
    return res.json({ success: true, data: match });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * List all purchase invoices with filters
 */
purchasesRouter.get('/', (req, res) => {
  try {
    let purchases = db.getPurchases();
    const { search, status, activity_code, date_from, date_to, supplier_id } = req.query;

    if (search && typeof search === 'string') {
      const q = search.trim().toLowerCase();
      purchases = purchases.filter(p =>
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
        (p.order_ref && p.order_ref.toLowerCase().includes(q)) ||
        (p.items && p.items.some(i => (i.matched_product_name || i.raw_name).toLowerCase().includes(q)))
      );
    }

    if (status && typeof status === 'string' && status !== 'all') {
      purchases = purchases.filter(p => p.status === status);
    }

    if (activity_code && typeof activity_code === 'string' && activity_code !== 'all') {
      purchases = purchases.filter(p => p.activity_code === activity_code);
    }

    if (date_from && typeof date_from === 'string') {
      purchases = purchases.filter(p => p.invoice_date >= date_from);
    }

    if (date_to && typeof date_to === 'string') {
      purchases = purchases.filter(p => p.invoice_date <= date_to);
    }

    if (supplier_id && typeof supplier_id === 'string') {
      purchases = purchases.filter(p => p.supplier_id === supplier_id);
    }

    return res.json({
      success: true,
      count: purchases.length,
      data: purchases
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get a single purchase invoice by ID
 */
purchasesRouter.get('/:id', (req, res) => {
  try {
    const purchase = db.getPurchaseById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found' });
    }
    return res.json({ success: true, data: purchase });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create a new purchase invoice (or confirm directly)
 */
purchasesRouter.post('/', (req, res) => {
  try {
    const actor = (req.headers['x-actor'] as string) || 'admin';
    const purchaseData = req.body;

    if (!purchaseData.supplier_name) {
      return res.status(400).json({ success: false, error: 'Supplier name is required' });
    }

    if (!Array.isArray(purchaseData.items) || purchaseData.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Purchase invoice must contain at least one line item' });
    }

    const created = db.createPurchase(purchaseData, actor);

    return res.status(201).json({
      success: true,
      message: created.status === 'confirmed' ? 'تم حفظ فاتورة الشراء وتحديث المخزون والأسعار بنجاح' : 'تم حفظ مسودة فاتورة الشراء بنجاح',
      data: created
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update an existing purchase invoice
 */
purchasesRouter.put('/:id', (req, res) => {
  try {
    const actor = (req.headers['x-actor'] as string) || 'admin';
    const updated = db.updatePurchase(req.params.id, req.body, actor);
    return res.json({
      success: true,
      message: 'تم تحديث فاتورة الشراء بنجاح',
      data: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Confirm a draft purchase invoice (executes inventory & product update transaction)
 */
purchasesRouter.post('/:id/confirm', (req, res) => {
  try {
    const actor = (req.headers['x-actor'] as string) || 'admin';
    const confirmed = db.confirmPurchase(req.params.id, actor);
    return res.json({
      success: true,
      message: 'تم تأكيد الفاتورة وترحيل الكميات للمخزون بنجاح',
      data: confirmed
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete a purchase invoice
 */
purchasesRouter.delete('/:id', (req, res) => {
  try {
    const actor = (req.headers['x-actor'] as string) || 'admin';
    const deleted = db.deletePurchase(req.params.id, actor);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found' });
    }
    return res.json({
      success: true,
      message: 'تم حذف الفاتورة بنجاح'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Suppliers directory endpoints
 */
purchasesRouter.get('/suppliers/list', (req, res) => {
  try {
    const suppliers = db.getSuppliers();
    return res.json({ success: true, data: suppliers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

purchasesRouter.post('/suppliers', (req, res) => {
  try {
    const supplier = db.createSupplier(req.body);
    return res.json({ success: true, data: supplier });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * AI Usage statistics and event logs
 */
purchasesRouter.get('/ai-usage/stats', (req, res) => {
  try {
    const events = db.getAiUsageEvents();
    let totalTokens = 0;
    let totalCalls = events.length;
    let successCalls = 0;
    let totalLatency = 0;

    for (const evt of events) {
      totalTokens += evt.total_tokens || 0;
      if (evt.status === 'success') successCalls++;
      totalLatency += evt.latency_ms || 0;
    }

    const avgLatency = totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0;
    const successRate = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 100;

    return res.json({
      success: true,
      data: {
        total_calls: totalCalls,
        success_calls: successCalls,
        success_rate_percent: successRate,
        total_tokens: totalTokens,
        average_latency_ms: avgLatency,
        events: events.slice(0, 50)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
