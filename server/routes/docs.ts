import { Router } from 'express';

const router = Router();

export const API_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'DZPOS Central Cloud Backend API',
    version: '2.4.0',
    description: 'Production-ready central REST API for DZPOS: Customer & License Management, Device Binding, Business Activities, Product Data Packs Versioning & Synchronization, Offline-first POS Protocol, and Admin Operations.',
    contact: {
      name: 'DZPOS Engineering Team',
      email: 'support@dzpos.dz',
      url: 'https://dzpos.dz'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'DZPOS Central Cloud Server'
    }
  ],
  tags: [
    { name: 'Subscriptions & Pricing', description: 'Annual & Lifetime subscription plans, centralized device pricing (1, 2, 3, 4, 5, 5+), verified price calculation, device slot management, and binding' },
    { name: 'Sync (Offline-First)', description: 'Product pack discovery, checksum check, and catalog downloads for POS client terminals' },
    { name: 'License Verification', description: 'Real-time and offline grace-period license validation & hardware device binding' },
    { name: 'License Requests', description: 'In-app and customer portal license purchasing/renewal flow' },
    { name: 'Customers', description: 'Customer directory, wilaya mapping, and account status management' },
    { name: 'Licenses (Admin)', description: 'Full license issuance, extension, freeze, revocation, and terminal management' },
    { name: 'Business Activities', description: 'Commercial sector categories (grocery, hardware, clothing, etc.)' },
    { name: 'Table Menu & QR (POS Sync & Public Access)', description: 'Publishing table menus from DZPOS offline terminals, table QR links generation, zero-auth public menu for customers, and table management' },
    { name: 'Product Data Packs', description: 'Pack creation, schema validation, preview, publishing, and instant rollback' },
    { name: 'AI Key Distribution & Purchases', description: 'Backend as secure AI Key & Model source for Android POS clients with direct offline execution & background purchase sync' },
    { name: 'Audit & Analytics', description: 'System telemetry, audit logs, and dashboard metrics' }
  ],
  endpoints: [
    {
      path: '/api/menu/publish',
      method: 'POST',
      tag: 'Table Menu & QR (POS Sync & Public Access)',
      summary: 'Publish/Sync Table Menu from POS (Idempotent & Versioned)',
      description: 'Called by DZPOS application when cashier publishes or updates the digital menu. Calculates SHA-256 checksum to ensure idempotency. Stores category snapshot, product details, prices in DZD, Wi-Fi credentials, and restaurant branding.',
      auth: 'Bearer <licenseKey> or x-license-key header',
      headers: ['Authorization: Bearer <DZPOS-LICENSE-KEY>', 'x-device-id: POS-MAIN-01'],
      queryParams: [],
      body: {
        restaurant_name: 'مطعم ومشاوي الباهية',
        public_slug: 'el-bahia-resto',
        tagline: 'أشهى المأكولات والمشاوي التقليدية على الفحم',
        description: 'أفضل تجربة تذوق للمشاوي الطازجة، البيتزا الإيطالية، والأطباق العريقة في وهران.',
        phone: '041 33 22 11',
        whatsapp: '213550123456',
        wifi_ssid: 'ElBahia_Guest',
        wifi_password: 'bahia2026',
        theme_color: '#E11D48',
        snapshot: {
          categories: [
            { category_id: 'cat_grill', name: 'مشاوي على الفحم', name_ar: 'مشاوي على الفحم', icon: '🔥', sort_order: 1 },
            { category_id: 'cat_drinks', name: 'مشروبات وعصائر', name_ar: 'مشروبات وعصائر', icon: '🥤', sort_order: 2 }
          ],
          products: [
            { product_id: 'p1', name: 'صحن مشاوي مشكلة عائلي (Mix Grill)', price: 2400, category_id: 'cat_grill', is_available: true, is_featured: true, unit: 'Plat' },
            { product_id: 'p2', name: 'عصير برتقال طبيعي طازج', price: 250, category_id: 'cat_drinks', is_available: true, is_featured: false, unit: 'Verre' }
          ]
        },
        tables: [
          { table_number: 'T01', table_code: 'T01', label_ar: 'طاولة رقم 01', capacity: 4, zone: 'الصالة الرئيسية' }
        ]
      },
      response: {
        success: true,
        menu_id: 'menu_1740000000000_abc',
        public_slug: 'el-bahia-resto',
        public_url: '/menu/el-bahia-resto',
        revision: 2,
        checksum_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        published_at: '2026-08-27T10:00:00.000Z',
        tables_count: 3,
        message: 'Menu published successfully to DZPOS Cloud Table Menu service.'
      }
    },
    {
      path: '/api/menu/public/:slug',
      method: 'GET',
      tag: 'Table Menu & QR (POS Sync & Public Access)',
      summary: 'Public Menu Access for Customer Smartphones (Zero Auth)',
      description: 'Lightweight, ultra-fast public endpoint returning published menu snapshot, categories, products, prices, table details, and Wi-Fi credentials when customers scan QR code.',
      auth: 'None (Public Open Access)',
      headers: [],
      queryParams: [{ name: 'table', type: 'string', required: false, description: 'Table code scanned (e.g. T01, VIP2)' }],
      body: null,
      response: {
        success: true,
        restaurant: {
          id: 'menu_1740000000000_abc',
          name: 'مطعم ومشاوي الباهية',
          tagline: 'أشهى المأكولات والمشاوي التقليدية على الفحم',
          currency_symbol: 'د.ج',
          wifi_ssid: 'ElBahia_Guest',
          wifi_password: 'bahia2026'
        },
        table: {
          table_number: 'T01',
          table_code: 'T01',
          label_ar: 'طاولة رقم 01',
          zone: 'الصالة الرئيسية'
        },
        snapshot: {
          total_categories: 4,
          total_products: 6,
          categories: [],
          products: []
        }
      }
    },
    {
      path: '/api/menu/status',
      method: 'GET',
      tag: 'Table Menu & QR (POS Sync & Public Access)',
      summary: 'Check Published Menu Status & Revision for License',
      description: 'Used by POS terminal to verify if a published menu exists, compare revision numbers, and fetch table QR URLs.',
      auth: 'Bearer <licenseKey> or ?license_key=',
      headers: ['Authorization: Bearer <DZPOS-LICENSE-KEY>'],
      queryParams: [],
      body: null,
      response: {
        success: true,
        is_published: true,
        menu: {
          id: 'menu_1740000000000_abc',
          restaurant_name: 'مطعم ومشاوي الباهية',
          public_slug: 'el-bahia-resto',
          revision: 2,
          tables_count: 3
        }
      }
    },
    {
      path: '/api/menu/tables',
      method: 'GET',
      tag: 'Table Menu & QR (POS Sync & Public Access)',
      summary: 'List Restaurant Tables & QR metadata',
      description: 'Returns all tables, seat capacities, zones, and QR URLs for a menu or license key.',
      auth: 'Admin or License query',
      headers: [],
      queryParams: [{ name: 'menu_id', type: 'string', required: false }, { name: 'license_key', type: 'string', required: false }],
      body: null,
      response: {
        success: true,
        tables: [
          {
            id: 'tbl_menu_1_T01',
            menu_id: 'menu_1',
            table_number: 'T01',
            table_code: 'T01',
            label_ar: 'طاولة رقم 01',
            capacity: 4,
            zone: 'الصالة الرئيسية',
            qr_url: '/menu/el-bahia-resto/table/T01'
          }
        ]
      }
    },
    {
      path: '/api/menu/tables',
      method: 'POST',
      tag: 'Table Menu & QR (POS Sync & Public Access)',
      summary: 'Add or Update Table Metadata & QR Code Link',
      description: 'Create or update table configuration, table code, capacity, and zone.',
      auth: 'Admin or POS License',
      headers: ['Content-Type: application/json'],
      queryParams: [],
      body: {
        menu_id: 'menu_1740000000000_abc',
        table_number: 'T04',
        table_code: 'T04',
        label_ar: 'طاولة رقم 04 (شرفة)',
        capacity: 6,
        zone: 'الشرفة الخارجية'
      },
      response: {
        success: true,
        table: {
          id: 'tbl_menu_1_T04',
          table_number: 'T04',
          table_code: 'T04',
          label_ar: 'طاولة رقم 04 (شرفة)',
          qr_url: '/menu/el-bahia-resto/table/T04'
        },
        message: 'Table saved successfully.'
      }
    },
    {
      path: '/api/subscriptions/plans',
      method: 'GET',
      tag: 'Subscriptions & Pricing',
      summary: 'Get all subscription plans, device tiers (1-5, 5+) & dynamic prices',
      description: 'Centralized pricing endpoint returning Annual and Lifetime plans, device counts (1, 2, 3, 4, 5, 5+), prices in DZD, and pricing formula for extra devices. App displays prices dynamically without hardcoding.',
      auth: 'Public / POS Terminal',
      headers: [],
      queryParams: [],
      body: null,
      response: {
        success: true,
        data: {
          currency: 'DZD',
          currency_symbol: 'د.ج',
          plans: [
            {
              id: 'yearly',
              name_ar: 'الاشتراك السنوي',
              duration_days: 365,
              is_lifetime: false,
              tiers: [
                { device_count: 1, price_dzd: 15000 },
                { device_count: 2, price_dzd: 25000 },
                { device_count: 3, price_dzd: 33000 },
                { device_count: 4, price_dzd: 40000 },
                { device_count: 5, price_dzd: 46000 }
              ],
              custom_tier: {
                min_devices: 6,
                base_5_price: 46000,
                per_extra_device_price: 6000
              }
            },
            {
              id: 'lifetime',
              name_ar: 'الاشتراك الأبدي (Lifetime)',
              duration_days: null,
              is_lifetime: true,
              tiers: [
                { device_count: 1, price_dzd: 35000 },
                { device_count: 2, price_dzd: 55000 },
                { device_count: 3, price_dzd: 72000 },
                { device_count: 4, price_dzd: 86000 },
                { device_count: 5, price_dzd: 98000 }
              ],
              custom_tier: {
                min_devices: 6,
                base_5_price: 98000,
                per_extra_device_price: 14000
              }
            }
          ]
        }
      },
      errors: ['500 Server Error']
    },
    {
      path: '/api/subscriptions/calculate-price',
      method: 'POST',
      tag: 'Subscriptions & Pricing',
      summary: 'Calculate official verified price for device count',
      description: 'Calculates the official price in DZD on the backend. When device count > 5, applies base price of 5 devices + per_extra_device rule.',
      auth: 'Public / POS Terminal',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: {
        subscription_type: 'yearly',
        device_count: 7
      },
      response: {
        success: true,
        data: {
          subscription_type: 'yearly',
          device_count: 7,
          price_dzd: 58000,
          currency: 'DZD',
          currency_symbol: 'د.ج',
          is_lifetime: false,
          duration_days: 365,
          breakdown: {
            base_tier_devices: 5,
            base_price: 46000,
            extra_devices: 2,
            per_extra_price: 6000,
            extra_price_total: 12000,
            total_price: 58000
          },
          rule_description: 'باقة 5 أجهزة (46,000 د.ج) + 2 أجهزة إضافية بسعر (6,000 د.ج لكل جهاز إضافي)'
        }
      },
      errors: ['400 INVALID_SUBSCRIPTION_TYPE', '400 INVALID_DEVICE_COUNT']
    },
    {
      path: '/api/subscriptions/request',
      method: 'POST',
      tag: 'Subscriptions & Pricing',
      summary: 'Submit new subscription request with verified price',
      description: 'Creates a subscription order with backend price calculation, customer details, and initial device hardware signature.',
      auth: 'Public / POS Terminal',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: {
        customer_name: 'سفيان بن عمار',
        phone: '0555123456',
        business_name: 'سوبرماركت التوفيق',
        activity_code: 'grocery',
        wilaya_code: '16',
        subscription_type: 'lifetime',
        device_count: 3,
        device_id: 'HW-DZ-ALGER-POS-01',
        device_name: 'Main Caisse Terminal'
      },
      response: {
        success: true,
        message: 'تم إرسال طلب الاشتراك وحساب السعر الرسمي بنجاح',
        data: {
          request_id: 'req_sub_1708892000',
          subscription_type: 'lifetime',
          is_lifetime: true,
          device_count: 3,
          calculated_price_dzd: 72000,
          currency: 'DZD',
          status: 'pending'
        }
      },
      errors: ['400 VALIDATION_ERROR']
    },
    {
      path: '/api/subscriptions/devices/bind',
      method: 'POST',
      tag: 'Subscriptions & Pricing',
      summary: 'Bind terminal device to subscription (Enforces limit)',
      description: 'Registers hardware device ID to subscription. If active devices reach max_devices, returns DEVICE_LIMIT_REACHED error.',
      auth: 'Public / POS Terminal',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: {
        license_key: 'DZPOS-LIFE-88A1-4B9C-7F02',
        device_id: 'HW-DZ-TAB-02',
        device_name: 'Caisse 2 (Tablet)',
        os: 'Android 14 POS'
      },
      response: {
        success: true,
        message: 'تم ربط الجهاز الجديد بالاشتراك بنجاح',
        data: {
          max_devices: 3,
          active_devices_count: 2,
          remaining_slots: 1
        }
      },
      errors: ['403 DEVICE_LIMIT_REACHED', '404 INVALID_LICENSE']
    },
    {
      path: '/api/subscriptions/devices/unbind',
      method: 'POST / DELETE',
      tag: 'Subscriptions & Pricing',
      summary: 'Unbind / remove device from subscription to free up slot',
      description: 'Permanently removes a device from the license, instantly liberating a device slot so a new terminal can be bound.',
      auth: 'Public / Merchant / Admin',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: {
        license_key: 'DZPOS-LIFE-88A1-4B9C-7F02',
        device_id: 'HW-DZ-OLD-TAB-01'
      },
      response: {
        success: true,
        message: 'تم إلغاء ربط الجهاز وتحرير خانة جديدة بنجاح',
        data: {
          max_devices: 3,
          active_devices_count: 1,
          remaining_slots: 2
        }
      },
      errors: ['404 DEVICE_NOT_FOUND', '404 INVALID_LICENSE']
    },
    {
      path: '/api/sync/activities',
      method: 'GET',
      tag: 'Sync (Offline-First)',
      summary: 'Get list of 11 commercial activities and catalogs',
      description: 'Used by DZPOS client app upon initial install to display commercial activities (grocery, retail, restaurant, hardware, clothing, cosmetics, pharmacy, wholesale, bakery, appliances, bookstore) and show catalog metadata.',
      auth: 'Public',
      headers: [],
      queryParams: [],
      body: null,
      response: {
        success: true,
        activities: [
          {
            code: 'grocery',
            name_ar: 'بقالة ومواد غذائية عامة',
            name_fr: 'Épicerie & Alimentation Générale',
            icon: '🛒',
            description: 'كتالوج المنتجات الغذائية والمشروبات مع الباركود',
            category_count: 12,
            product_count: 250,
            latest_version: '3.0.0',
            checksum_sha256: 'ccab075f773d1c237817ee297ca644f5e9c7ff64bf2dffb1670e1681f671269f'
          }
        ]
      },
      errors: ['500 Server Error']
    },
    {
      path: '/api/sync/check',
      method: 'GET / POST',
      tag: 'Sync (Offline-First)',
      summary: 'Check if newer catalog version is available',
      description: 'Checks if newer product pack version is available for a given activity code against current local version.',
      auth: 'Public / POS Terminal',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      queryParams: [
        { name: 'activity_code', required: true, example: 'grocery' },
        { name: 'current_version', required: false, example: '2.0.0' }
      ],
      body: {
        activity_code: 'grocery',
        current_version: '2.0.0',
        license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
        device_id: 'HW-DZ-ALGER-POS-01'
      },
      response: {
        success: true,
        has_update: true,
        update_available: true,
        latest_version: '3.0.0',
        checksum_sha256: 'ccab075f773d1c237817ee297ca644f5e9c7ff64bf2dffb1670e1681f671269f',
        total_products: 250,
        total_categories: 12,
        download_url: 'https://dzposs.ai.studio/api/sync/download?activity_code=grocery'
      },
      errors: ['400 VALIDATION_ERROR', '404 ACTIVITY_NOT_FOUND']
    },
    {
      path: '/api/sync/download',
      method: 'GET / POST',
      tag: 'Sync (Offline-First)',
      summary: 'Download complete product pack with categories and images',
      description: 'Returns categories and products JSON payload with purchase_price, wholesale_price, image_url, tax_rate, and SHA-256 integrity.',
      auth: 'Public / POS Terminal',
      queryParams: [
        { name: 'activity_code', required: true, example: 'grocery' },
        { name: 'version', required: false, example: '3' }
      ],
      body: null,
      response: {
        success: true,
        pack: {
          activity_code: 'grocery',
          version: '3.0.0',
          categories: [
            {
              id: 'cat_beverages',
              name_ar: 'المشروبات والغازوز',
              name_fr: 'Boissons',
              color_hex: '#2563EB'
            }
          ],
          products: [
            {
              id: 'prod_dz_001',
              name_ar: 'حمود بوعلام سيليكتو 1 لتر',
              name_fr: 'Hamoud Boualem Selecto 1L',
              barcode: '6130001001012',
              sku: '6130001001012',
              category_name: 'المشروبات والغازوز',
              price: 110.0,
              purchase_price: 95.0,
              wholesale_price: 102.0,
              unit: 'قارورة',
              stock_qty: 100,
              min_stock_alert: 10,
              image_url: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=512&h=512&fit=crop',
              tax_rate: 19.0,
              is_tax_exempt: false
            }
          ]
        },
        checksum_sha256: 'ccab075f773d1c237817ee297ca644f5e9c7ff64bf2dffb1670e1681f671269f'
      },
      errors: ['404 PRODUCT_PACK_NOT_FOUND', '404 VERSION_NOT_FOUND']
    },
    {
      path: '/api/sync/upload-pack',
      method: 'POST',
      tag: 'Sync (Offline-First)',
      summary: 'Upload and publish exported JSON catalog from DZPOS POS App',
      description: 'Ingests exported JSON backup from the Android app, increments catalog version, and generates SHA256 integrity checksum.',
      auth: 'Admin / POS Terminal',
      body: {
        activity_code: 'grocery',
        auto_publish: true,
        products: [
          {
            name_ar: 'حمود بوعلام سيليكتو 1 لتر',
            name_fr: 'Hamoud Boualem Selecto 1L',
            barcode: '6130001001012',
            category_name: 'المشروبات والغازوز',
            price: 110.0,
            purchase_price: 95.0,
            unit: 'قارورة'
          }
        ]
      },
      response: {
        success: true,
        message: 'Pack successfully uploaded and published',
        activity_code: 'grocery',
        version: '3.1.0',
        total_products: 250,
        checksum_sha256: 'ccab075f773d...'
      },
      errors: ['400 VALIDATION_ERROR']
    },
    {
      path: '/api/sync/upload-zip',
      method: 'POST (multipart/form-data)',
      tag: 'Sync (Offline-First)',
      summary: 'Upload full .zip backup containing SQLite db, product images & manifest',
      description: 'Accepts raw exported .zip from Android DZPOS containing square_pos_database.db, product_images/ folder, and backup_manifest.json. Parses SQLite tables, extracts images to CDN storage, computes SHA-256 and publishes new catalog version automatically.',
      auth: 'Admin / POS Terminal',
      headers: [{ name: 'Content-Type', value: 'multipart/form-data' }],
      body: {
        file: '(Binary .ZIP file)',
        activity_code: 'grocery'
      },
      response: {
        success: true,
        message: 'تم رفع واستيراد ملف .zip بنجاح',
        activity_code: 'grocery',
        version: '3.1.0',
        total_products: 250,
        total_categories: 12,
        total_images: 56,
        zip_url: 'https://dzposs.ai.studio/storage/packs/grocery_v4.zip',
        download_url: 'https://dzposs.ai.studio/api/sync/download?activity_code=grocery',
        checksum_sha256: 'ccab075f773d...'
      },
      errors: ['400 FILE_MISSING', '500 ZIP_PROCESSING_FAILED']
    },
    {
      path: '/api/license/device-check',
      method: 'GET / POST',
      tag: 'Zero-Touch Remote Activation',
      summary: 'Mobile Terminal Auto-Poll: Check Remote Activation & Auto-Inject License',
      description: 'Used by DZPOS Mobile App upon opening or during startup polling. If the admin clicked "توليد وتفعيل عن بعد" in the central dashboard, this endpoint immediately returns the active license key, customer metadata, and catalog download URL for automatic license injection without typing.',
      auth: 'Public / POS Mobile Client',
      queryParams: [
        { name: 'device_id', required: true, example: 'HW-DZ-MOB-8829' }
      ],
      body: {
        device_id: 'HW-DZ-MOB-8829'
      },
      response: {
        success: true,
        activated: true,
        registered: true,
        status: 'active',
        license_key: 'DZPOS-PRO-8K9L-4M2N-99X1',
        device_id: 'HW-DZ-MOB-8829',
        customer_name: 'سوبرماركت القدس',
        business_name: 'سوبرماركت القدس (الجزائر)',
        activity_code: 'grocery',
        activity_name: 'بقالة ومواد غذائية عامة',
        plan: 'pro',
        expires_at: '2027-08-22T00:00:00.000Z',
        days_remaining: 365,
        features: ['pos_standard', 'offline_sync', 'barcode_scanner', 'multi_device'],
        latest_pack_version: 4,
        pack_download_url: '/api/sync/download?activity_code=grocery',
        message: 'تم تفعيل الجهاز بنجاح! تم استيراد رخصة العمل وتجهيز المحطة.'
      },
      errors: ['400 VALIDATION_ERROR (device_id required)']
    },
    {
      path: '/api/license/register-device',
      method: 'POST',
      tag: 'Zero-Touch Remote Activation',
      summary: 'Register mobile terminal for 1-click admin activation',
      description: 'The mobile app sends its Device UUID, device model, shop name, and phone upon first run or clicking "طلب تفعيل عن بعد". Creates a pending request in the admin dashboard.',
      auth: 'Public / POS Mobile Client',
      body: {
        device_id: 'HW-DZ-MOB-8829',
        device_name: 'Samsung Galaxy Tab A8 POS',
        os: 'Android 14 (DZPOS Mobile v2.4.0)',
        app_version: 'v2.4.0',
        business_name: 'سوبرماركت القدس',
        customer_name: 'أحمد بن علي',
        phone: '0550123456',
        activity_code: 'grocery',
        wilaya_code: '16',
        requested_plan: 'pro'
      },
      response: {
        success: true,
        message: 'تم تسجيل الجهاز بنجاح. يمكنك الآن تفعيله مباشرة من لوحة الإدارة.',
        request_id: 'req_172389...',
        data: {
          request_id: 'req_172389...',
          device_id: 'HW-DZ-MOB-8829',
          status: 'pending'
        }
      },
      errors: ['400 VALIDATION_ERROR']
    },
    {
      path: '/api/license/remote-activate',
      method: 'POST',
      tag: 'Zero-Touch Remote Activation',
      summary: 'Admin 1-Click: Generate License & Activate Mobile Terminal Remotely',
      description: 'Called by admin to generate a new license key, link the device ID, and activate the mobile terminal immediately without manual code typing.',
      auth: 'Admin / Super Admin Bearer Token',
      body: {
        device_id: 'HW-DZ-MOB-8829',
        device_name: 'Samsung Galaxy Tab A8 POS',
        customer_name: 'أحمد بن علي',
        phone: '0550123456',
        business_name: 'سوبرماركت القدس',
        activity_code: 'grocery',
        wilaya_code: '16',
        plan: 'pro',
        duration_days: 365
      },
      response: {
        success: true,
        message: 'تم تفعيل جهاز الهاتف عن بعد بنجاح وتوليد المفتاح! سيتفعل التطبيق على الهاتف تلقائياً.',
        data: {
          license: {
            license_id: 'lic_1723...',
            license_key: 'DZPOS-PRO-8K9L-4M2N-99X1',
            customer_name: 'أحمد بن علي',
            status: 'active'
          }
        }
      },
      errors: ['400 VALIDATION_ERROR', '401 UNAUTHORIZED']
    },
    {
      path: '/api/license/verify',
      method: 'POST',
      tag: 'License Verification',
      summary: 'Verify license & bind POS hardware terminal',
      description: 'Checks key validity, binds device hardware UUID, calculates remaining active days, and evaluates offline grace period (e.g. 7 days).',
      auth: 'POS Terminal Client',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: {
        license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
        device_id: 'HW-DZ-ALGER-POS-01',
        device_name: 'Caisse Principale (Android 13)',
        os: 'Android 13',
        app_version: 'v2.4.0'
      },
      response: {
        success: true,
        data: {
          valid: true,
          status: 'active',
          expires_at: '2027-03-10T00:00:00.000Z',
          days_remaining: 206,
          is_grace_period: false,
          grace_period_days_left: 0,
          customer: {
            name: 'Mourad Belkacem',
            business_name: 'Supérette El Baraka',
            wilaya: 'Alger'
          },
          plan: 'pro',
          features: ['pos_standard', 'multi_device', 'offline_sync', 'barcode_scanner'],
          max_devices: 2,
          active_devices_count: 2,
          offline_cache_duration_hours: 168
        }
      },
      errors: ['400 INVALID_LICENSE', '403 LICENSE_EXPIRED', '403 LICENSE_SUSPENDED', '403 DEVICE_LIMIT_REACHED', '403 DEVICE_NOT_AUTHORIZED']
    },
    {
      path: '/api/license-requests',
      method: 'POST',
      tag: 'License Requests',
      summary: 'Submit license purchase/renewal request',
      description: 'Can be submitted from within the DZPOS client terminal or web portal.',
      auth: 'Public / POS Terminal',
      body: {
        customer_name: 'Nassim Khelifi',
        phone: '0540 88 77 66',
        business_name: 'Café & Salon de Thé El Khadra',
        activity_code: 'restaurant',
        wilaya_code: '06',
        requested_plan: 'pro',
        requested_duration_days: 365,
        notes: '2 caisses tactiles Béjaïa'
      },
      response: {
        success: true,
        message: 'License request submitted successfully',
        data: { request_id: 'req_1723...', status: 'pending' }
      },
      errors: ['400 VALIDATION_ERROR']
    },
    {
      path: '/api/license-requests/:id/approve',
      method: 'POST',
      tag: 'License Requests',
      summary: 'Approve request & auto-issue License Key',
      description: 'Main Admin / Admin action: approves request, ensures customer record, generates secure key, binds license, and creates audit log.',
      auth: 'Admin Token / Role (MAIN_ADMIN, ADMIN)',
      body: {
        plan: 'pro',
        duration_days: 365,
        admin_notes: 'Approved via phone confirmation'
      },
      response: {
        success: true,
        message: 'License request approved and license generated successfully',
        data: {
          license: {
            license_id: 'lic_123...',
            license_key: 'DZPOS-PRO-XXXX-XXXX-XXXX',
            plan: 'pro',
            status: 'active'
          }
        }
      },
      errors: ['403 FORBIDDEN', '404 VALIDATION_ERROR']
    },
    {
      path: '/api/product-packs/validate-file',
      method: 'POST',
      tag: 'Product Data Packs',
      summary: 'Validate uploaded CSV or JSON product file',
      description: 'Parses rows, checks for missing names/barcodes/prices, flags duplicate barcodes, and outputs error report + preview table.',
      auth: 'Admin Token (MAIN_ADMIN, ADMIN)',
      body: {
        activity_code: 'grocery',
        file_type: 'csv',
        raw_content: 'Designation,Code_Barre,Prix,Categorie\nCoca Cola 1L,5449000000996,120,Boissons'
      },
      response: {
        success: true,
        data: {
          total_rows: 1,
          valid_rows_count: 1,
          errors_count: 0,
          is_valid: true,
          preview: [{ name: 'Coca Cola 1L', barcode: '5449000000996', default_price: 120 }]
        }
      },
      errors: ['400 INVALID_FILE', '404 ACTIVITY_NOT_FOUND']
    },
    {
      path: '/api/product-packs/create-version',
      method: 'POST',
      tag: 'Product Data Packs',
      summary: 'Confirm import & create new Pack Version',
      description: 'Saves validated products into a version JSON file on disk, calculates SHA-256 checksum, and registers version record (Draft or Published).',
      auth: 'Admin Token (MAIN_ADMIN, ADMIN)',
      body: {
        activity_code: 'grocery',
        products: [{ name: '...', barcode: '...', default_price: 100 }],
        changes_summary: 'Batch update 2026',
        auto_publish: false
      },
      response: {
        success: true,
        message: 'Version v4 created successfully (ready)',
        data: { version: 4, checksum_sha256: '...', total_products: 50, status: 'ready' }
      },
      errors: ['400 VALIDATION_ERROR', '404 ACTIVITY_NOT_FOUND']
    },
    {
      path: '/api/product-packs/:activityCode/rollback',
      method: 'POST',
      tag: 'Product Data Packs',
      summary: 'Instant rollback to previous pack version',
      description: 'Rolls back live published catalog from v(N) to v(target) instantly without re-uploading files. Archives faulty version and updates pointers.',
      auth: 'Main Admin Only (MAIN_ADMIN)',
      body: {
        target_version: 2,
        reason: 'Detected wrong pricing in v3'
      },
      response: {
        success: true,
        message: "Successfully rolled back pack 'grocery' from v3 to v2",
        data: { current_active_version: 2, rolled_back_from: 3 }
      },
      errors: ['403 FORBIDDEN', '404 VERSION_NOT_FOUND']
    },
    {
      path: '/api/v1/ai/credentials',
      method: 'GET',
      tag: 'AI Key Distribution & Purchases',
      summary: 'Export Gemini AI credentials & prompt schema to licensed POS app',
      description: 'Backend acts as the secure source/hub distributing the Gemini API Key, recommended model (gemini-3.7-flash), temperature, system prompts, and strict JSON response schemas to licensed POS clients for direct client-side OCR & invoice analysis.',
      auth: 'Public / POS Terminal with X-License-Key & X-Device-Fingerprint headers',
      headers: [
        { name: 'X-License-Key', value: 'DZPOS-2026-TEST-7798' },
        { name: 'X-Device-Fingerprint', value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
      ],
      queryParams: [],
      body: null,
      response: {
        success: true,
        message: 'AI credentials and prompt configuration exported successfully for client-side processing',
        data: {
          provider: 'google_gemini',
          api_key: 'AIzaSyD...',
          key_available: true,
          export_enabled: true,
          model: 'gemini-3.7-flash',
          fallback_model: 'gemini-2.5-flash',
          temperature: 0.1,
          endpoint: 'https://generativelanguage.googleapis.com/v1beta',
          client_execution_mode: 'DIRECT_CLIENT_SDK',
          system_instruction: 'You are DZPOS AI Invoice Parsing Engine...',
          response_schema: { type: 'OBJECT', properties: { supplier_name: { type: 'STRING' }, items: { type: 'ARRAY' } } },
          daily_limit: 150,
          remaining_today: 142,
          sync_endpoint: '/api/v1/purchases/sync',
          cached_until: '2026-08-27T06:00:00.000Z',
          supported_features: ['INVOICE_OCR', 'RECEIPT_PARSER', 'BARCODE_DETECTION', 'PRODUCT_FUZZY_MATCH']
        }
      },
      errors: ['401 UNAUTHORIZED_LICENSE', '429 DAILY_AI_LIMIT_EXCEEDED']
    },
    {
      path: '/api/v1/purchases/sync',
      method: 'POST',
      tag: 'AI Key Distribution & Purchases',
      summary: 'Sync client-processed purchase invoice to central cloud backend',
      description: 'Accepts purchase invoices that were parsed and matched directly by the Android POS app locally (via Room DB) to sync inventory updates and financial logs to the central backend database.',
      auth: 'Public / POS Terminal with X-License-Key',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'X-License-Key', value: 'DZPOS-2026-TEST-7798' },
        { name: 'X-Device-Name', value: 'Caisse-Principale-01' }
      ],
      body: {
        invoice_number: 'FAC-2026-8941',
        invoice_date: '2026-08-26',
        supplier_name: 'SARL DistriFood Algérie',
        supplier_phone: '0550 44 33 22',
        supplier_tax_id: 'NIF: 099816001234567',
        status: 'confirmed',
        subtotal_ht: 45600,
        total_tax: 0,
        total_discount: 0,
        total_ttc: 45600,
        activity_code: 'grocery',
        items: [
          {
            product_id: 'prod_dz_g01',
            matched_product_name: 'Hamoud Boualem Selecto 1L',
            raw_name: 'Hamoud Selecto 1L x12',
            barcode: '6130001001012',
            category: 'Boissons & Gazéifiées',
            unit: 'Pack',
            quantity: 10,
            unit_price: 1100,
            selling_price: 110,
            total_ht: 11000,
            total_ttc: 11000,
            match_status: 'matched'
          }
        ]
      },
      response: {
        success: true,
        message: 'Client-processed purchase record synced successfully',
        data: { id: 'pur_1756200000', status: 'confirmed', items_count: 1 }
      },
      errors: ['400 INVALID_PURCHASE_DATA', '500 SYNC_FAILED']
    }
  ]
};

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: API_SPEC
  });
});

export default router;
