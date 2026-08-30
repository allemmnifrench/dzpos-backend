import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import customersRouter from './server/routes/customers.js';
import licensesRouter from './server/routes/licenses.js';
import licenseRequestsRouter from './server/routes/licenseRequests.js';
import activitiesRouter from './server/routes/activities.js';
import productPacksRouter from './server/routes/productPacks.js';
import syncRouter from './server/routes/sync.js';
import licenseApiRouter from './server/routes/licenseApi.js';
import auditRouter from './server/routes/audit.js';
import statsRouter from './server/routes/stats.js';
import settingsRouter from './server/routes/settings.js';
import docsRouter from './server/routes/docs.js';
import authRouter from './server/routes/auth.js';
import subscriptionsRouter from './server/routes/subscriptions.js';
import { purchasesRouter } from './server/routes/purchases.js';
import menuRouter from './server/routes/menu.js';
import ordersRouter from './server/routes/orders.js';
import { db } from './server/db.js';
import { retrieveImage, rehydrateAllPackImages } from './server/services/imageStore.js';

async function startServer() {
  // Ensure Cloud Firestore database state is fully hydrated
  try {
    await db.ready();
    // Rehydrate product images from stored pack archives
    await rehydrateAllPackImages();
  } catch (e) {
    console.warn('DB ready check warning:', e);
  }

  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-admin-role', 'x-admin-user', 'x-admin-user-id', '*'],
    exposedHeaders: ['ETag', 'Content-Length']
  }));
  app.options('*', cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Basic request logger & Retrofit URL normalizer
  app.use((req, res, next) => {
    // Automatically fix duplicate /api/api/ prefix from Retrofit configuration
    if (req.url.startsWith('/api/api/')) {
      req.url = req.url.replace('/api/api/', '/api/');
    }
    if (req.url.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.url} - ${req.ip}`);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'DZPOS Cloud Backend',
      version: '2.4.0',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      db_status: 'online',
      cloud_persistence: 'Firebase Firestore',
      customers_count: db.getCustomers().length,
      licenses_count: db.getLicenses().length,
      packs_count: db.getProductPacks().length
    });
  });

  // Serve public static uploaded storage with open CORS and image headers
  const storagePath = path.join(process.cwd(), 'storage');
  const productsStoragePath = path.join(process.cwd(), 'storage', 'products');

  const staticOptions = {
    dotfiles: 'ignore',
    etag: true,
    maxAge: '1d',
    setHeaders: (res: express.Response) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    }
  };

  // Dynamic Image Recovery Handler for ephemeral container resilience
  const dynamicImageHandler = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawFilename = req.params.filename || req.params[0] || path.basename(req.path);
    if (!rawFilename) return next();

    try {
      const img = await retrieveImage(rawFilename);
      if (img) {
        res.setHeader('Content-Type', img.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        return res.send(img.buffer);
      }
    } catch (e) {
      console.warn('Dynamic image recovery error:', e);
    }
    next();
  };

  // Dedicated image retrieval routes with on-the-fly recovery from pack archives and dynamic culinary visuals
  const imageRoutes = [
    '/storage/products/:filename',
    '/storage/products/*',
    '/storage/:filename',
    '/storage/*',
    '/api/storage/products/:filename',
    '/api/storage/products/*',
    '/api/storage/:filename',
    '/api/storage/*',
    '/uploads/products/:filename',
    '/uploads/products/*',
    '/uploads/:filename',
    '/uploads/*',
    '/images/products/:filename',
    '/images/products/*',
    '/images/:filename',
    '/images/*',
    '/product_images/:filename',
    '/product_images/*',
    '/media/:filename',
    '/media/*'
  ];
  app.get(imageRoutes, dynamicImageHandler);

  // Mount storage and common alias routes (/uploads, /images, /media, /product_images)
  app.use('/storage', express.static(storagePath, staticOptions));
  app.use('/uploads', express.static(storagePath, staticOptions));
  app.use('/uploads/products', express.static(productsStoragePath, staticOptions));
  app.use('/images', express.static(productsStoragePath, staticOptions));
  app.use('/images/products', express.static(productsStoragePath, staticOptions));
  app.use('/media', express.static(productsStoragePath, staticOptions));
  app.use('/product_images', express.static(productsStoragePath, staticOptions));

  // Dedicated route for POST /api/licenses/verify
  app.post('/api/licenses/verify', (req, res, next) => {
    req.url = '/verify';
    licenseApiRouter(req, res, next);
  });

  // Dedicated routes for license / subscription request aliases
  app.post('/api/licenses/request', (req, res, next) => {
    req.url = '/request';
    licenseRequestsRouter(req, res, next);
  });
  app.post('/api/license/request', (req, res, next) => {
    req.url = '/request';
    licenseRequestsRouter(req, res, next);
  });
  app.use('/api/subscriptions/orders', (req, res, next) => {
    req.url = '/orders';
    subscriptionsRouter(req, res, next);
  });

  // Mount API modules
  app.use('/api/orders', ordersRouter);
  app.use('/orders', ordersRouter);
  app.use('/v1/orders', ordersRouter);
  app.use('/public/v1/orders', ordersRouter);
  app.use('/api/table-orders', ordersRouter);
  app.use('/api/table_orders', ordersRouter);
  app.use('/table-orders', ordersRouter);
  app.use('/table_orders', ordersRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/plans', subscriptionsRouter);
  app.use('/api/calculate-price', (req, res, next) => {
    req.url = '/calculate-price';
    subscriptionsRouter(req, res, next);
  });
  app.use('/api/customers', customersRouter);
  app.use('/api/licenses', licensesRouter);
  app.use('/api/license-requests', licenseRequestsRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/product-packs', productPacksRouter);
  app.use('/api/sync', syncRouter);
  app.use('/sync', syncRouter);
  app.use('/api/license', licenseApiRouter);
  app.use('/license', licenseApiRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/docs', docsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/purchases', purchasesRouter);
  app.use('/api/menu', menuRouter);
  app.use('/menu', menuRouter);
  app.use('/v1/menu', menuRouter);

  // Mount Public v1 Aliases for Android Retrofit compatibility
  app.use('/api/public/v1/orders', ordersRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/public/v1/purchases', purchasesRouter);
  app.use('/api/v1/purchases', purchasesRouter);
  app.use('/api/v1/ai', purchasesRouter);
  app.use('/api/public/v1/ai', purchasesRouter);
  app.use('/api/ai', purchasesRouter);
  app.use('/api/public/v1/subscriptions', subscriptionsRouter);
  app.use('/api/v1/subscriptions', subscriptionsRouter);
  app.use('/api/public/v1/license', licenseApiRouter);
  app.use('/api/public/v1/licenses', licenseApiRouter);
  app.use('/api/public/v1/sync', syncRouter);
  app.use('/api/public/v1/activities', activitiesRouter);
  app.use('/api/public/v1/license-requests', licenseRequestsRouter);
  app.use('/api/public/v1/license/request', licenseRequestsRouter);
  app.use('/api/public/v1/menu', menuRouter);
  app.use('/api/v1/menu', menuRouter);

  // Global API 404 handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: `API Route ${req.method} ${req.baseUrl} does not exist`,
        timestamp: new Date().toISOString()
      }
    });
  });

  // Vite integration (Dev vs Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 DZPOS Central Backend Server running`);
    console.log(`📍 Port: ${PORT} (0.0.0.0)`);
    console.log(`📡 API Base: http://0.0.0.0:${PORT}/api`);
    console.log(`=========================================`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
