import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { fetchRemoteState, saveRemoteState } from './firebase.js';
import {
  Customer,
  License,
  LicenseDevice,
  LicenseRequest,
  BusinessActivity,
  ProductPack,
  ProductPackVersion,
  Product,
  AdminUser,
  AuditLog,
  SystemSettings,
  LicensePlan,
  LicenseStatus,
  CustomerStatus,
  SubscriptionPricingConfig,
  PurchaseInvoice,
  PurchaseItem,
  Supplier,
  AiUsageEvent,
  RestaurantMenu,
  MenuTable,
  PublishedMenuCategory,
  PublishedMenuProduct,
  TableOrder,
  TableOrderItem,
  TableOrderStatus
} from '../src/types/dzpos.js';

export const DEFAULT_PRICING_CONFIG: SubscriptionPricingConfig = {
  currency: 'DZD',
  currency_symbol: 'د.ج',
  yearly: {
    devices_1: 15000,
    devices_2: 25000,
    devices_3: 33000,
    devices_4: 40000,
    devices_5: 46000,
    per_extra_device: 6000
  },
  lifetime: {
    devices_1: 35000,
    devices_2: 55000,
    devices_3: 72000,
    devices_4: 86000,
    devices_5: 98000,
    per_extra_device: 14000
  },
  trial_duration_days: 30,
  updated_at: new Date('2026-01-01').toISOString()
};

export const WILAYAS_DZ = [
  { code: '01', name: 'Adrar' },
  { code: '02', name: 'Chlef' },
  { code: '03', name: 'Laghouat' },
  { code: '04', name: 'Oum El Bouaghi' },
  { code: '05', name: 'Batna' },
  { code: '06', name: 'Béjaïa' },
  { code: '07', name: 'Biskra' },
  { code: '08', name: 'Béchar' },
  { code: '09', name: 'Blida' },
  { code: '10', name: 'Bouira' },
  { code: '11', name: 'Tamanrasset' },
  { code: '12', name: 'Tébessa' },
  { code: '13', name: 'Tlemcen' },
  { code: '14', name: 'Tiaret' },
  { code: '15', name: 'Tizi Ouzou' },
  { code: '16', name: 'Alger' },
  { code: '17', name: 'Djelfa' },
  { code: '18', name: 'Jijel' },
  { code: '19', name: 'Sétif' },
  { code: '20', name: 'Saïda' },
  { code: '21', name: 'Skikda' },
  { code: '22', name: 'Sidi Bel Abbès' },
  { code: '23', name: 'Annaba' },
  { code: '24', name: 'Guelma' },
  { code: '25', name: 'Constantine' },
  { code: '26', name: 'Médéa' },
  { code: '27', name: 'Mostaganem' },
  { code: '28', name: 'M\'Sila' },
  { code: '29', name: 'Mascara' },
  { code: '30', name: 'Ouargla' },
  { code: '31', name: 'Oran' },
  { code: '32', name: 'El Bayadh' },
  { code: '33', name: 'Illizi' },
  { code: '34', name: 'Bordj Bou Arreridj' },
  { code: '35', name: 'Boumerdès' },
  { code: '36', name: 'El Tarf' },
  { code: '37', name: 'Tindouf' },
  { code: '38', name: 'Tissemsilt' },
  { code: '39', name: 'El Oued' },
  { code: '40', name: 'Khenchela' },
  { code: '41', name: 'Souk Ahras' },
  { code: '42', name: 'Tipaza' },
  { code: '43', name: 'Mila' },
  { code: '44', name: 'Aïn Defla' },
  { code: '45', name: 'Naâma' },
  { code: '46', name: 'Aïn Témouchent' },
  { code: '47', name: 'Ghardaïa' },
  { code: '48', name: 'Relizane' },
  { code: '49', name: 'Timimoun' },
  { code: '50', name: 'Bordj Badji Mokhtar' },
  { code: '51', name: 'Ouled Djellal' },
  { code: '52', name: 'Béni Abbès' },
  { code: '53', name: 'In Salah' },
  { code: '54', name: 'In Guezzam' },
  { code: '55', name: 'Touggourt' },
  { code: '56', name: 'Djanet' },
  { code: '57', name: 'El M\'Ghair' },
  { code: '58', name: 'El Meniaa' }
];

export interface DatabaseSchema {
  customers: Customer[];
  licenses: License[];
  license_requests: LicenseRequest[];
  activities: BusinessActivity[];
  product_packs: ProductPack[];
  product_pack_versions: ProductPackVersion[];
  products: Product[];
  admin_users: AdminUser[];
  audit_logs: AuditLog[];
  settings: SystemSettings;
  purchases: PurchaseInvoice[];
  suppliers: Supplier[];
  ai_usage_events: AiUsageEvent[];
  restaurant_menus: RestaurantMenu[];
  menu_tables: MenuTable[];
  table_orders: TableOrder[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'dzpos_db.json');
const PACKS_DIR = path.join(DATA_DIR, 'packs');

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PACKS_DIR)) {
    fs.mkdirSync(PACKS_DIR, { recursive: true });
  }
}

export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function generateSecureLicenseKey(plan: LicensePlan = 'pro'): string {
  const prefix = `DZPOS-${plan.toUpperCase().slice(0, 3)}`;
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${part1}-${part2}-${part3}`;
}

const INITIAL_ACTIVITIES: BusinessActivity[] = [
  {
    id: 'act_grocery',
    code: 'grocery',
    name_ar: 'بقالة ومواد غذائية عامة',
    name_fr: 'Épicerie & Alimentation Générale',
    name_en: 'Grocery & General Food',
    description: 'كتالوج المنتجات الغذائية والمشروبات مع الباركود',
    icon: '🛒',
    status: 'active',
    sort_order: 1,
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString(),
    latest_pack_version: 3,
    total_products: 250
  },
  {
    id: 'act_retail',
    code: 'retail',
    name_ar: 'تجارة التجزئة والمحلات',
    name_fr: 'Commerce de détail',
    name_en: 'Retail & General Stores',
    description: 'كتالوج المحلات التجارية المتنوعة ومحلات السوبرات',
    icon: '🏪',
    status: 'active',
    sort_order: 2,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-11').toISOString(),
    latest_pack_version: 2,
    total_products: 180
  },
  {
    id: 'act_restaurant',
    code: 'restaurant',
    name_ar: 'مطاعم وأكلات سريعة ومقاهي',
    name_fr: 'Restaurant, Fast-Food & Café',
    name_en: 'Restaurant, Fast-Food & Cafe',
    description: 'قائمة الوجبات السريعة، المشروبات، والمأكولات',
    icon: '🍽️',
    status: 'active',
    sort_order: 3,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-15').toISOString(),
    latest_pack_version: 2,
    total_products: 95
  },
  {
    id: 'act_hardware',
    code: 'hardware',
    name_ar: 'خردوات وعقاقير وبناء (Droguerie)',
    name_fr: 'Quincaillerie & Droguerie',
    name_en: 'Hardware & Tools',
    description: 'كتالوج مواد البناء، الدهانات، الأدوات والعدد',
    icon: '🔧',
    status: 'active',
    sort_order: 4,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-12').toISOString(),
    latest_pack_version: 2,
    total_products: 140
  },
  {
    id: 'act_clothing',
    code: 'clothing',
    name_ar: 'ملابس وأحذية وأزياء',
    name_fr: 'Vêtements, Chaussures & Mode',
    name_en: 'Clothing, Shoes & Fashion',
    description: 'كتالوج الألبسة، الأحذية والموضة بمختلف المقاسات والألوان',
    icon: '👕',
    status: 'active',
    sort_order: 5,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-14').toISOString(),
    latest_pack_version: 2,
    total_products: 110
  },
  {
    id: 'act_cosmetics',
    code: 'cosmetics',
    name_ar: 'عطور ومواد التجميل والعناية',
    name_fr: 'Cosmétique & Parfumerie',
    name_en: 'Cosmetics & Perfumes',
    description: 'كتالوج العطور، مستحضرات التجميل والعناية الشخصية',
    icon: '✨',
    status: 'active',
    sort_order: 6,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-15').toISOString(),
    latest_pack_version: 2,
    total_products: 85
  },
  {
    id: 'act_pharmacy',
    code: 'pharmacy',
    name_ar: 'صيدلية وشبه صيدلاني',
    name_fr: 'Pharmacie & Parapharmacie',
    name_en: 'Pharmacy & Para-pharmacy',
    description: 'كتالوج الأدوية والمكملات والمستلزمات الطبية وشبه الصيدلانية',
    icon: '💊',
    status: 'active',
    sort_order: 7,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-15').toISOString(),
    latest_pack_version: 2,
    total_products: 120
  },
  {
    id: 'act_wholesale',
    code: 'wholesale',
    name_ar: 'تجارة الجملة والتوزيع',
    name_fr: 'Commerce de gros',
    name_en: 'Wholesale & Distribution',
    description: 'كتالوج مبيعات الجملة ونصف الجملة مع وحدات الكرتون',
    icon: '📦',
    status: 'active',
    sort_order: 8,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-15').toISOString(),
    latest_pack_version: 2,
    total_products: 160
  },
  {
    id: 'act_bakery',
    code: 'bakery',
    name_ar: 'مخبزة وحلويات عصرية وتقليدية',
    name_fr: 'Boulangerie & Pâtisserie',
    name_en: 'Bakery & Pastry',
    description: 'كتالوج الخبز، المعجنات، والحلويات العصرية والتقليدية',
    icon: '🥐',
    status: 'active',
    sort_order: 9,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-15').toISOString(),
    latest_pack_version: 2,
    total_products: 70
  },
  {
    id: 'act_appliances',
    code: 'appliances',
    name_ar: 'أجهزة كهرومنزلية وهواتف',
    name_fr: 'Électroménager & Téléphonie',
    name_en: 'Home Appliances & Phones',
    description: 'كتالوج الأجهزة المنزلية، الهواتف الذكية، والإلكترونيات',
    icon: '📺',
    status: 'active',
    sort_order: 10,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-15').toISOString(),
    latest_pack_version: 2,
    total_products: 90
  },
  {
    id: 'act_bookstore',
    code: 'bookstore',
    name_ar: 'مكتبة وأدوات مدرسية وقرطاسية',
    name_fr: 'Librairie & Papeterie',
    name_en: 'Bookstore & Stationery',
    description: 'كتالوج الكتب، الأدوات المدرسية، والمكتبيات',
    icon: '📚',
    status: 'active',
    sort_order: 11,
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-15').toISOString(),
    latest_pack_version: 2,
    total_products: 130
  }
];

const INITIAL_PRODUCTS_GROCERY: Product[] = [
  {
    product_id: 'prod_dz_g01',
    activity_code: 'grocery',
    name: 'Hamoud Boualem Selecto 1L',
    name_ar: 'حمود بوعلام سيليكتو 1 لتر',
    name_fr: 'Hamoud Boualem Selecto 1L',
    barcode: '6130001001012',
    category: 'Boissons & Gazéifiées',
    brand: 'Hamoud Boualem',
    unit: 'Bouteille',
    default_price: 110,
    status: 'active',
    metadata: { volume: '1L', vat_rate: 19 },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g02',
    activity_code: 'grocery',
    name: 'Hamoud Boualem Blanche 1L',
    name_ar: 'حمود بوعلام بيضاء 1 لتر',
    name_fr: 'Hamoud Boualem Gazouz Blanche 1L',
    barcode: '6130001001029',
    category: 'Boissons & Gazéifiées',
    brand: 'Hamoud Boualem',
    unit: 'Bouteille',
    default_price: 110,
    status: 'active',
    metadata: { volume: '1L', vat_rate: 19 },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g03',
    activity_code: 'grocery',
    name: 'Rouiba Jus Orange 1L Tetra',
    name_ar: 'عصير رويبة برتقال 1 لتر',
    name_fr: 'Rouiba Jus Orange 1L',
    barcode: '6130002002015',
    category: 'Jus & Nectars',
    brand: 'Rouiba',
    unit: 'Pack Tetra',
    default_price: 160,
    status: 'active',
    metadata: { volume: '1L' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g04',
    activity_code: 'grocery',
    name: 'N\'gaous Jus Abricot 1L',
    name_ar: 'عصير نقاوس مشمش 1 لتر',
    name_fr: 'N\'gaous Jus Abricot 1L',
    barcode: '6130003003018',
    category: 'Jus & Nectars',
    brand: 'N\'gaous',
    unit: 'Bouteille',
    default_price: 140,
    status: 'active',
    metadata: { volume: '1L' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g05',
    activity_code: 'grocery',
    name: 'Huile Elio 5L Cevital',
    name_ar: 'زيت إيليو 5 لتر سيفيتال',
    name_fr: 'Huile de table Elio 5L Cevital',
    barcode: '6130004004011',
    category: 'Huiles & Graisses',
    brand: 'Cevital',
    unit: 'Bidon 5L',
    default_price: 650,
    status: 'active',
    metadata: { regulated: true },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g06',
    activity_code: 'grocery',
    name: 'Margarine Fleurial 500g',
    name_ar: 'مارغرين فلوريال 500غ',
    name_fr: 'Margarine Fleurial 500g',
    barcode: '6130004004028',
    category: 'Beurres & Margarines',
    brand: 'Cevital',
    unit: 'Barquette',
    default_price: 190,
    status: 'active',
    metadata: { weight: '500g' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g07',
    activity_code: 'grocery',
    name: 'Candia Lait Silhouette 1L',
    name_ar: 'حليب كانديا سيلويت 1 لتر',
    name_fr: 'Lait Candia Silhouette UHT 1L',
    barcode: '6130005005014',
    category: 'Produits Laitiers',
    brand: 'Candia Tchin-Lait',
    unit: 'Brique 1L',
    default_price: 130,
    status: 'active',
    metadata: { volume: '1L' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g08',
    activity_code: 'grocery',
    name: 'Soummam Yaourt Fort Fraise 100g',
    name_ar: 'ياغورت صومام فورت فراولة',
    name_fr: 'Soummam Yaourt Fort Fraise 100g',
    barcode: '6130006006017',
    category: 'Produits Laitiers',
    brand: 'Soummam',
    unit: 'Pot 100g',
    default_price: 30,
    status: 'active',
    metadata: { flavor: 'Fraise' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g09',
    activity_code: 'grocery',
    name: 'Fromage Portion La Vache Qui Rit 16P',
    name_ar: 'جبن لافاش كيري 16 قطعة',
    name_fr: 'La Vache Qui Rit 16 Portions',
    barcode: '6130007007010',
    category: 'Fromages',
    brand: 'Bel Algérie',
    unit: 'Boîte 16P',
    default_price: 320,
    status: 'active',
    metadata: { portions: 16 },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g10',
    activity_code: 'grocery',
    name: 'Bimo Biscuits Petit Beurre 175g',
    name_ar: 'بسكويت بيمو بتي بور 175غ',
    name_fr: 'Bimo Biscuits Petit Beurre 175g',
    barcode: '6130008008013',
    category: 'Biscuiterie & Chocolats',
    brand: 'Bimo / Palmary',
    unit: 'Paquet',
    default_price: 80,
    status: 'active',
    metadata: { weight: '175g' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g11',
    activity_code: 'grocery',
    name: 'Palmary Gaufrette Kool Break 50g',
    name_ar: 'قوفريط بال ماري كول بريك',
    name_fr: 'Palmary Kool Break Gaufrette Chocolat',
    barcode: '6130008008020',
    category: 'Biscuiterie & Chocolats',
    brand: 'Palmary',
    unit: 'Pièce',
    default_price: 35,
    status: 'active',
    metadata: { weight: '50g' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g12',
    activity_code: 'grocery',
    name: 'Café Moulu Bonal 250g',
    name_ar: 'قهوة بونال مطحونة 250غ',
    name_fr: 'Café Moulu Familial Bonal 250g',
    barcode: '6130009009016',
    category: 'Café & Thé',
    brand: 'Bonal',
    unit: 'Paquet 250g',
    default_price: 340,
    status: 'active',
    metadata: { weight: '250g' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g13',
    activity_code: 'grocery',
    name: 'Café Moulu 1001 250g',
    name_ar: 'قهوة ألف وواحد 250غ',
    name_fr: 'Café Moulu Prestige 1001 250g',
    barcode: '6130009009023',
    category: 'Café & Thé',
    brand: '1001',
    unit: 'Paquet 250g',
    default_price: 310,
    status: 'active',
    metadata: { weight: '250g' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g14',
    activity_code: 'grocery',
    name: 'Pâtes Sim Spaghettis N5 500g',
    name_ar: 'سباغيتي سيم رقم 5 - 500غ',
    name_fr: 'Sim Spaghettis N°5 500g',
    barcode: '6130010010012',
    category: 'Pâtes & Couscous',
    brand: 'Sim',
    unit: 'Paquet 500g',
    default_price: 95,
    status: 'active',
    metadata: { weight: '500g' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g15',
    activity_code: 'grocery',
    name: 'Couscous Mama Moyen 1kg',
    name_ar: 'كسكس ماما متوسط 1 كغ',
    name_fr: 'Couscous Mama Moyen 1kg',
    barcode: '6130011011019',
    category: 'Pâtes & Couscous',
    brand: 'Mama / Amor Benamor',
    unit: 'Paquet 1kg',
    default_price: 180,
    status: 'active',
    metadata: { weight: '1kg' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g16',
    activity_code: 'grocery',
    name: 'Double Concentré de Tomate Amor Benamor 800g',
    name_ar: 'طماطم مصبرة عمور بن عمر 800غ',
    name_fr: 'Double Concentré Tomate Amor Benamor 800g',
    barcode: '6130012012016',
    category: 'Conserves & Épicerie Salée',
    brand: 'Amor Benamor',
    unit: 'Boîte Métal 800g',
    default_price: 260,
    status: 'active',
    metadata: { weight: '800g' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g17',
    activity_code: 'grocery',
    name: 'Lessive Poudre Le Chat 3kg',
    name_ar: 'مسحوق غسيل لوشا 3 كغ',
    name_fr: 'Lessive Poudre Machine Le Chat 3kg',
    barcode: '6130013013013',
    category: 'Entretien & Nettoyage',
    brand: 'Henkel Le Chat',
    unit: 'Sac 3kg',
    default_price: 750,
    status: 'active',
    metadata: { weight: '3kg' },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  },
  {
    product_id: 'prod_dz_g18',
    activity_code: 'grocery',
    name: 'Eau Minérale Guedila 1.5L Pack x6',
    name_ar: 'ماء معدني قديلا 1.5 لتر حزمة 6',
    name_fr: 'Eau Minérale Naturelle Guedila 1.5L (Pack 6)',
    barcode: '6130014014010',
    category: 'Eaux Minérales',
    brand: 'Guedila',
    unit: 'Pack 6 Bouteilles',
    default_price: 240,
    status: 'active',
    metadata: { pack_qty: 6, unit_price: 40 },
    version: 3,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString()
  }
];

const INITIAL_PRODUCTS_HARDWARE: Product[] = [
  {
    product_id: 'prod_dz_h01',
    activity_code: 'hardware',
    name: 'Perceuse à Percussion Total 850W',
    name_ar: 'مثقاب كهربائي توتال 850 واط',
    name_fr: 'Perceuse à Percussion 850W Total Tools',
    barcode: '6933596210015',
    category: 'Outillage Électroportatif',
    brand: 'Total Tools',
    unit: 'Pièce',
    default_price: 6800,
    status: 'active',
    metadata: { power: '850W', warranty_months: 12 },
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-12').toISOString()
  },
  {
    product_id: 'prod_dz_h02',
    activity_code: 'hardware',
    name: 'Meuleuse d\'angle Crown 115mm 1010W',
    name_ar: 'صاروخ جلخ كراون 115 ملم 1010 واط',
    name_fr: 'Meuleuse d\'angle Crown 115mm',
    barcode: '6933596210022',
    category: 'Outillage Électroportatif',
    brand: 'Crown',
    unit: 'Pièce',
    default_price: 5200,
    status: 'active',
    metadata: { power: '1010W', disc_size: '115mm' },
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-12').toISOString()
  },
  {
    product_id: 'prod_dz_h03',
    activity_code: 'hardware',
    name: 'Ruban à Mesurer 5M Professionnel',
    name_ar: 'متر قياس 5 أمتار احترافي',
    name_fr: 'Mètre Ruban 5m Bi-matière',
    barcode: '6933596210039',
    category: 'Mesure & Traçage',
    brand: 'Ingco',
    unit: 'Pièce',
    default_price: 450,
    status: 'active',
    metadata: { length: '5m' },
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-12').toISOString()
  },
  {
    product_id: 'prod_dz_h04',
    activity_code: 'hardware',
    name: 'Ciment Blanc Saidal 25kg',
    name_ar: 'إسمنت أبيض 25 كغ',
    name_fr: 'Sac Ciment Blanc 25kg',
    barcode: '6130020020018',
    category: 'Matériaux de Construction',
    brand: 'GICA',
    unit: 'Sac 25kg',
    default_price: 1150,
    status: 'active',
    metadata: { weight: '25kg' },
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-12').toISOString()
  },
  {
    product_id: 'prod_dz_h05',
    activity_code: 'hardware',
    name: 'Peinture Blanche Satinée Astral 10L',
    name_ar: 'دهان أبيض ساتيني أسترال 10 لتر',
    name_fr: 'Peinture Acrylique Satinée Astral 10L',
    barcode: '6130020020025',
    category: 'Peinture & Droguerie',
    brand: 'Astral Algérie',
    unit: 'Seau 10L',
    default_price: 4800,
    status: 'active',
    metadata: { volume: '10L', color: 'Blanc' },
    version: 2,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-08-12').toISOString()
  }
];

const INITIAL_RESTAURANT_MENUS: RestaurantMenu[] = [
  {
    id: 'menu_el_bahia',
    customer_id: 'cust_01',
    license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
    restaurant_name: 'مطعم ومشاوي الباهية',
    restaurant_name_ar: 'مطعم ومشاوي الباهية',
    restaurant_name_fr: 'Restaurant & Grillades El Bahia',
    public_slug: 'el-bahia-resto',
    public_token: 'tok_el_bahia_2026',
    enabled: true,
    tagline: 'أشهى المأكولات والمشاوي التقليدية على الفحم',
    description: 'أفضل تجربة تذوق للمشاوي الطازجة، البيتزا الإيطالية، والأطباق التقليدية العريقة في وهران.',
    currency: 'DZD',
    currency_symbol: 'د.ج',
    phone: '041 33 22 11',
    whatsapp: '213550123456',
    address: 'شارع العربي بن مهيدي، وهران',
    city: 'Oran',
    wilaya_code: '31',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&auto=format&fit=crop&q=80',
    cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80',
    wifi_ssid: 'ElBahia_Guest',
    wifi_password: 'bahia2026',
    theme_color: '#E11D48',
    opening_hours: 'يومياً: 11:30 صباحاً - 12:00 ليلاً',
    revision: 1,
    checksum_sha256: 'a1b2c3d4e5f60000000000000000000000000000000000000000000000000000',
    last_published_at: new Date('2026-08-20T12:00:00.000Z').toISOString(),
    created_at: new Date('2026-08-01T00:00:00.000Z').toISOString(),
    updated_at: new Date('2026-08-20T12:00:00.000Z').toISOString(),
    tables_count: 6,
    snapshot: {
      published_at: new Date('2026-08-20T12:00:00.000Z').toISOString(),
      total_categories: 4,
      total_products: 9,
      device_id: 'DEV-POS-ORAN-01',
      app_version: 'v2.4.0',
      categories: [
        {
          category_id: 'cat_grill',
          name: 'مشاوي على الفحم',
          name_ar: 'مشاوي على الفحم',
          name_fr: 'Grillades au Charbon',
          icon: '🔥',
          sort_order: 1,
          is_active: true
        },
        {
          category_id: 'cat_dishes',
          name: 'أطباق ووجبات رئيسية',
          name_ar: 'أطباق ووجبات رئيسية',
          name_fr: 'Plats Principaux',
          icon: '🍲',
          sort_order: 2,
          is_active: true
        },
        {
          category_id: 'cat_sandwiches',
          name: 'سندويتشات وبرغر',
          name_ar: 'سندويتشات وبرغر',
          name_fr: 'Sandwiches & Burgers',
          icon: '🍔',
          sort_order: 3,
          is_active: true
        },
        {
          category_id: 'cat_drinks',
          name: 'مشروبات وعصائر طبيعية',
          name_ar: 'مشروبات وعصائر طبيعية',
          name_fr: 'Boissons & Jus Frais',
          icon: '🥤',
          sort_order: 4,
          is_active: true
        }
      ],
      products: [
        {
          product_id: 'prod_m00_wings',
          name: 'أجنحة دجاج متبلة ومقرمشة (Chicken Wings)',
          name_ar: 'أجنحة دجاج',
          name_fr: 'Ailes de Poulet Croustillantes (Wings)',
          description: 'أجنحة دجاج طازجة متبلة بالبهارات الجزائرية الخاصة ومقلية بقرمشة ذهبية مع الصوص المفضل.',
          description_ar: 'أجنحة دجاج طازجة متبلة بالبهارات الجزائرية الخاصة ومقلية بقرمشة ذهبية مع الصوص المفضل.',
          image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80',
          price: 500,
          category_id: 'cat_grill',
          category_name: 'مشاوي على الفحم',
          unit: 'Portion',
          is_available: true,
          is_featured: true,
          sort_order: 0,
          badges: ['الأكثر طلباً', 'تخصيص كامل'],
          preparation_time_minutes: 12,
          sizes: [
            { id: 'size_small', name: 'صغير', name_ar: 'صغير', name_fr: 'Petit', price: 500, price_delta: 0, is_default: true },
            { id: 'size_medium', name: 'متوسط', name_ar: 'متوسط', name_fr: 'Moyen', price: 550, price_delta: 50 },
            { id: 'size_large', name: 'كبير', name_ar: 'كبير', name_fr: 'Grand', price: 600, price_delta: 100 }
          ],
          addons: [
            { id: 'add_cheese', name: 'جبن إضافي', name_ar: '+ جبن إضافي', name_fr: '+ Fromage extra', price: 50, emoji: '🧀' },
            { id: 'add_mayo', name: 'مايونيز', name_ar: '+ مايونيز', name_fr: '+ Mayonnaise', price: 30, emoji: '🧴' },
            { id: 'add_olives', name: 'زيتون', name_ar: '+ زيتون', name_fr: '+ Olives', price: 40, emoji: '🫒' },
            { id: 'add_algerienne', name: 'صوص جزائري', name_ar: '+ صوص جزائري', name_fr: '+ Sauce Algérienne', price: 30, emoji: '🌶️' },
            { id: 'add_fries', name: 'بطاطا مقلية', name_ar: '+ بطاطا مقلية', name_fr: '+ Frites', price: 100, emoji: '🍟' },
            { id: 'add_egg', name: 'بيض مقلي', name_ar: '+ بيض مقلي', name_fr: '+ Œuf', price: 40, emoji: '🍳' }
          ],
          special_options: [
            { id: 'opt_thin_dough', name: 'عجينة رقيقة', name_ar: 'عجينة رقيقة', emoji: '🥖' },
            { id: 'opt_spicy_sauce', name: 'صوص حار', name_ar: 'صوص حار', emoji: '🌶️' },
            { id: 'opt_no_onion', name: 'بدون بصل', name_ar: 'بدون بصل', emoji: '🧅' },
            { id: 'opt_no_cheese', name: 'بدون جبن', name_ar: 'بدون جبن', emoji: '🧀' },
            { id: 'opt_low_salt', name: 'ملح قليل', name_ar: 'ملح قليل', emoji: '🧂' },
            { id: 'opt_extra_grill', name: 'شواء زيادة', name_ar: 'شواء زيادة', emoji: '🔥' },
            { id: 'opt_herbs', name: 'أعشاب عطرية', name_ar: 'أعشاب عطرية', emoji: '🌿' }
          ]
        },
        {
          product_id: 'prod_m01',
          name: 'صحن مشاوي مشكلة عائلي (Mix Grill)',
          name_ar: 'صحن مشاوي مشكلة عائلي (Mix Grill)',
          name_fr: 'Assiette Mix Grill Familiale',
          description: 'تشكيلة فاخرة من شيش طاووق، كفتة مشوية، كوتلات غنمي، تقدم مع البطاطس المقلية والصلصات.',
          description_ar: 'تشكيلة فاخرة من شيش طاووق، كفتة مشوية، كوتلات غنمي، تقدم مع البطاطس المقلية والصلصات.',
          image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
          price: 2400,
          category_id: 'cat_grill',
          category_name: 'مشاوي على الفحم',
          unit: 'Plat',
          is_available: true,
          is_featured: true,
          sort_order: 1,
          badges: ['الأكثر طلباً', 'Chef Special'],
          preparation_time_minutes: 25
        },
        {
          product_id: 'prod_m02',
          name: 'شيش طاووق دجاج متبل',
          name_ar: 'شيش طاووق دجاج متبل',
          name_fr: 'Chich Taouk Poulet Mariné',
          description: 'أسياخ صدر دجاج طري متبل بخلطة الأعشاب والليمون مع الأرز البسمتي.',
          description_ar: 'أسياخ صدر دجاج طري متبل بخلطة الأعشاب والليمون مع الأرز البسمتي.',
          image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80',
          price: 950,
          category_id: 'cat_grill',
          category_name: 'مشاوي على الفحم',
          unit: 'Portion',
          is_available: true,
          is_featured: false,
          sort_order: 2,
          preparation_time_minutes: 15
        },
        {
          product_id: 'prod_m03',
          name: 'كفتة لحم غنمي مشوية',
          name_ar: 'كفتة لحم غنمي مشوية',
          name_fr: 'Brochettes Kefta d\'Agneau',
          description: 'لحم غنمي مفروم مع التوابل التقليدية والبقدونس مشوي على الفحم الطبيعي.',
          description_ar: 'لحم غنمي مفروم مع التوابل التقليدية والبقدونس مشوي على الفحم الطبيعي.',
          image_url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&auto=format&fit=crop&q=80',
          price: 1100,
          category_id: 'cat_grill',
          category_name: 'مشاوي على الفحم',
          unit: 'Portion',
          is_available: true,
          is_featured: true,
          sort_order: 3,
          preparation_time_minutes: 15
        },
        {
          product_id: 'prod_m04',
          name: 'طاجين الزيتون الوهراني بالدجاج',
          name_ar: 'طاجين الزيتون الوهراني بالدجاج',
          name_fr: 'Tajine d\'Olives au Poulet',
          description: 'طبق تقليدي عريق بالزيتون الأخضر المحلى وقطع الدجاج المحمر في الفرن مع المرق المخثر.',
          description_ar: 'طبق تقليدي عريق بالزيتون الأخضر المحلى وقطع الدجاج المحمر في الفرن مع المرق المخثر.',
          image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80',
          price: 850,
          category_id: 'cat_dishes',
          category_name: 'أطباق ووجبات رئيسية',
          unit: 'Plat',
          is_available: true,
          is_featured: false,
          sort_order: 4,
          preparation_time_minutes: 10
        },
        {
          product_id: 'prod_m05',
          name: 'كسكسي وهراني باللحم والخضر',
          name_ar: 'كسكسي وهراني باللحم والخضر',
          name_fr: 'Couscous Traditionnel Viande',
          description: 'كسكس رقيق ومبخّر مع مرق الخضار المشكلة وحبات الحمص وقطعة لحم غنمي طرية.',
          description_ar: 'كسكس رقيق ومبخّر مع مرق الخضار المشكلة وحبات الحمص وقطعة لحم غنمي طرية.',
          image_url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&auto=format&fit=crop&q=80',
          price: 1250,
          category_id: 'cat_dishes',
          category_name: 'أطباق ووجبات رئيسية',
          unit: 'Plat',
          is_available: true,
          is_featured: true,
          sort_order: 5,
          preparation_time_minutes: 15
        },
        {
          product_id: 'prod_m06',
          name: 'برغر الباهية الملكي (Double Beef Burger)',
          name_ar: 'برغر الباهية الملكي (Double Beef Burger)',
          name_fr: 'Burger Royal Double Beef',
          description: 'قطعتين لحم بقري صافي مع جبنة الشيدر الذائبة، البصل المكرمل وصوص الباهية الخاصة.',
          description_ar: 'قطعتين لحم بقري صافي مع جبنة الشيدر الذائبة، البصل المكرمل وصوص الباهية الخاصة.',
          image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
          price: 750,
          category_id: 'cat_sandwiches',
          category_name: 'سندويتشات وبرغر',
          unit: 'Pièce',
          is_available: true,
          is_featured: true,
          sort_order: 6,
          preparation_time_minutes: 12
        },
        {
          product_id: 'prod_m07',
          name: 'طاكوس الباهية ميكس (Tacos XXL)',
          name_ar: 'طاكوس الباهية ميكس (Tacos XXL)',
          name_fr: 'Tacos XXL Mix Viande & Poulet',
          description: 'طاكوس فرنسي بحجم كبير محشو بالدجاج المتبل، اللحم المفروم، والصلصة الجبنية المنزلية.',
          description_ar: 'طاكوس فرنسي بحجم كبير محشو بالدجاج المتبل، اللحم المفروم، والصلصة الجبنية المنزلية.',
          image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
          price: 650,
          category_id: 'cat_sandwiches',
          category_name: 'سندويتشات وبرغر',
          unit: 'Pièce',
          is_available: true,
          is_featured: false,
          sort_order: 7,
          preparation_time_minutes: 10
        },
        {
          product_id: 'prod_m08',
          name: 'عصير برتقال وليمون طبيعي طازج',
          name_ar: 'عصير برتقال وليمون طبيعي طازج',
          name_fr: 'Jus d\'Orange & Citronnade Frais',
          description: 'عصير منعش معصور 100% طبيعي بدون سكر مضاف.',
          description_ar: 'عصير منعش معصور 100% طبيعي بدون سكر مضاف.',
          image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80',
          price: 250,
          category_id: 'cat_drinks',
          category_name: 'مشروبات وعصائر طبيعية',
          unit: 'Verre',
          is_available: true,
          is_featured: false,
          sort_order: 8,
          preparation_time_minutes: 5
        },
        {
          product_id: 'prod_m09',
          name: 'مشروب حمود بوعلام سيليكتو / كوكا كولا',
          name_ar: 'مشروب حمود بوعلام سيليكتو / كوكا كولا',
          name_fr: 'Boisson Gazéifiée Selecto / Coca',
          description: 'مشروب غازي مثلج في زجاجة 33cl أو كانيت.',
          description_ar: 'مشروب غازي مثلج في زجاجة 33cl أو كانيت.',
          image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
          price: 120,
          category_id: 'cat_drinks',
          category_name: 'مشروبات وعصائر طبيعية',
          unit: 'Canette',
          is_available: true,
          is_featured: false,
          sort_order: 9,
          preparation_time_minutes: 2
        }
      ]
    }
  }
];

const INITIAL_MENU_TABLES: MenuTable[] = [
  {
    id: 'tbl_bahia_01',
    menu_id: 'menu_el_bahia',
    license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
    table_number: 'T01',
    table_code: 'T01',
    label_ar: 'طاولة رقم 01',
    label_fr: 'Table 01',
    capacity: 4,
    zone: 'الصالة الرئيسية',
    enabled: true,
    qr_url: '/menu/el-bahia-resto/table/T01',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z'
  },
  {
    id: 'tbl_bahia_02',
    menu_id: 'menu_el_bahia',
    license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
    table_number: 'T02',
    table_code: 'T02',
    label_ar: 'طاولة رقم 02',
    label_fr: 'Table 02',
    capacity: 4,
    zone: 'الصالة الرئيسية',
    enabled: true,
    qr_url: '/menu/el-bahia-resto/table/T02',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z'
  },
  {
    id: 'tbl_bahia_03',
    menu_id: 'menu_el_bahia',
    license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
    table_number: 'T03',
    table_code: 'T03',
    label_ar: 'طاولة رقم 03',
    label_fr: 'Table 03',
    capacity: 6,
    zone: 'صالة العائلات',
    enabled: true,
    qr_url: '/menu/el-bahia-resto/table/T03',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z'
  },
  {
    id: 'tbl_bahia_04',
    menu_id: 'menu_el_bahia',
    license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
    table_number: 'T04',
    table_code: 'T04',
    label_ar: 'طاولة رقم 04',
    label_fr: 'Table 04',
    capacity: 6,
    zone: 'صالة العائلات',
    enabled: true,
    qr_url: '/menu/el-bahia-resto/table/T04',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z'
  },
  {
    id: 'tbl_bahia_vip1',
    menu_id: 'menu_el_bahia',
    license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
    table_number: 'VIP 1',
    table_code: 'VIP1',
    label_ar: 'صالة كبار الزوار (VIP)',
    label_fr: 'Salon VIP 1',
    capacity: 10,
    zone: 'VIP',
    enabled: true,
    qr_url: '/menu/el-bahia-resto/table/VIP1',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z'
  },
  {
    id: 'tbl_bahia_terrasse1',
    menu_id: 'menu_el_bahia',
    license_key: 'DZPOS-PRO-7A9B-4C2E-88D1',
    table_number: 'TR 01',
    table_code: 'TR01',
    label_ar: 'شرفة خارجية 01',
    label_fr: 'Terrasse 01',
    capacity: 4,
    zone: 'الشرفة الخارجية (Terrasse)',
    enabled: true,
    qr_url: '/menu/el-bahia-resto/table/TR01',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z'
  }
];

export class DatabaseStore {
  private data: DatabaseSchema;
  private isLoaded = false;
  public readyPromise: Promise<boolean>;
  public readonly emitter = new EventEmitter();

  constructor() {
    this.data = this.getDefaultSchema();
    this.readyPromise = this.init();
  }

  public async ready(): Promise<boolean> {
    return this.readyPromise;
  }

  private getDefaultSchema(): DatabaseSchema {
    return {
      customers: [],
      licenses: [],
      license_requests: [],
      activities: INITIAL_ACTIVITIES,
      product_packs: [],
      product_pack_versions: [],
      products: [...INITIAL_PRODUCTS_GROCERY, ...INITIAL_PRODUCTS_HARDWARE],
      admin_users: [
        {
          id: 'usr_superadmin_allemmni',
          username: 'allemmni',
          email: 'allemmnifrench@gmail.com',
          full_name: 'Super Admin (allemmnifrench@gmail.com)',
          role: 'MAIN_ADMIN',
          active: true,
          created_at: new Date('2026-01-01').toISOString(),
          last_login_at: new Date().toISOString()
        },
        {
          id: 'usr_main_admin',
          username: 'superadmin',
          email: 'admin@dzpos.dz',
          full_name: 'Main Administrator (DZPOS Hub)',
          role: 'MAIN_ADMIN',
          active: true,
          created_at: new Date('2026-01-01').toISOString(),
          last_login_at: new Date().toISOString()
        },
        {
          id: 'usr_admin_ops',
          username: 'ops_manager',
          email: 'ops@dzpos.dz',
          full_name: 'Karim Haddad (Operations Admin)',
          role: 'ADMIN',
          active: true,
          created_at: new Date('2026-02-10').toISOString(),
          last_login_at: new Date().toISOString()
        },
        {
          id: 'usr_support',
          username: 'support_agent',
          email: 'support@dzpos.dz',
          full_name: 'Amel Benali (Support Team)',
          role: 'SUPPORT',
          active: true,
          created_at: new Date('2026-03-01').toISOString(),
          last_login_at: new Date().toISOString()
        }
      ],
      audit_logs: [],
      settings: {
        grace_period_days: 7,
        allow_trial_auto_approve: true,
        max_devices_trial: 1,
        max_devices_basic: 1,
        max_devices_pro: 2,
        max_devices_enterprise: 5,
        require_device_binding: true,
        offline_cache_duration_hours: 168, // 7 days cache validity
        system_name: 'DZPOS Central Management Platform',
        support_phone: '+213 550 12 34 56',
        support_email: 'support@dzpos.dz',
        pricing: DEFAULT_PRICING_CONFIG
      },
      purchases: [
        {
          id: 'pur_demo_01',
          invoice_number: 'FAC-2026-8941',
          invoice_date: '2026-08-20',
          order_ref: 'BC-AL-102',
          supplier_name: 'SARL DistriFood Algérie',
          supplier_phone: '0550 44 33 22',
          supplier_address: 'El Hamiz, Alger',
          supplier_tax_id: 'NIF: 099816001234567',
          status: 'confirmed',
          payment_status: 'paid',
          payment_method: 'Espèces',
          subtotal_ht: 45600,
          total_tax: 0,
          total_discount: 0,
          total_ttc: 45600,
          items_count: 3,
          created_at: '2026-08-20T10:30:00.000Z',
          confirmed_at: '2026-08-20T10:35:00.000Z',
          activity_code: 'grocery',
          items: [
            {
              id: 'pi_demo_01_1',
              product_id: 'prod_groc_001',
              matched_product_name: 'حليب كانديا 1 لتر',
              raw_name: 'Lait Candia 1L Demi-Écrémé (Pack x12)',
              barcode: '6130123456789',
              category: 'منتجات الحليب ومشتقاته',
              unit: 'Pack',
              quantity: 10,
              unit_price: 1560,
              selling_price: 135,
              discount: 0,
              tax_rate: 0,
              tax_amount: 0,
              total_ht: 15600,
              total_ttc: 15600,
              confidence: { raw_name: 0.99, barcode: 1.0, quantity: 0.98, unit_price: 0.96, product_match: 1.0 },
              match_status: 'matched'
            },
            {
              id: 'pi_demo_01_2',
              product_id: 'prod_groc_002',
              matched_product_name: 'زيت المائدة إيليو 5 لتر',
              raw_name: 'Huile Elio 5L Cevital (Carton x4)',
              barcode: '6130987654321',
              category: 'الزيوت والدهون',
              unit: 'Carton',
              quantity: 10,
              unit_price: 2450,
              selling_price: 650,
              discount: 0,
              tax_rate: 0,
              tax_amount: 0,
              total_ht: 24500,
              total_ttc: 24500,
              confidence: { raw_name: 0.99, barcode: 1.0, quantity: 0.99, unit_price: 0.98, product_match: 1.0 },
              match_status: 'matched'
            },
            {
              id: 'pi_demo_01_3',
              product_id: 'prod_groc_004',
              matched_product_name: 'مشروب حمود بوعلام 1 لتر',
              raw_name: 'Hamoud Boualem Selecto 1L (Fardeau x6)',
              barcode: '6130111222333',
              category: 'المشروبات الغازية والعصائر',
              unit: 'Fardeau',
              quantity: 10,
              unit_price: 550,
              selling_price: 110,
              discount: 0,
              tax_rate: 0,
              tax_amount: 0,
              total_ht: 5500,
              total_ttc: 5500,
              confidence: { raw_name: 0.98, barcode: 1.0, quantity: 0.97, unit_price: 0.95, product_match: 1.0 },
              match_status: 'matched'
            }
          ],
          ai_metadata: {
            analyzed_at: '2026-08-20T10:29:45.000Z',
            model: 'gemini-3.7-flash',
            confidence_avg: 0.98,
            latency_ms: 1840,
            tokens_used: 1350
          }
        }
      ],
      suppliers: [
        {
          id: 'sup_01',
          name: 'SARL DistriFood Algérie',
          phone: '0550 44 33 22',
          email: 'contact@distrifood.dz',
          address: 'El Hamiz, Alger',
          wilaya_code: '16',
          wilaya_name: 'Alger',
          nif: '099816001234567',
          nis: '16001234567',
          rc: '16/00-1122334',
          total_purchases_dzd: 45600,
          purchases_count: 1,
          created_at: '2026-08-20T10:30:00.000Z',
          updated_at: '2026-08-20T10:35:00.000Z'
        },
        {
          id: 'sup_02',
          name: 'SARL BatiPro Algérie (Outillage & Quincaillerie)',
          phone: '023 88 12 34',
          email: 'sales@batipro.dz',
          address: 'Zone Industrielle Oued Smar, Alger',
          wilaya_code: '16',
          wilaya_name: 'Alger',
          nif: '001216098765432',
          rc: '16/00-9876543',
          total_purchases_dzd: 0,
          purchases_count: 0,
          created_at: '2026-08-20T11:00:00.000Z',
          updated_at: '2026-08-20T11:00:00.000Z'
        }
      ],
      ai_usage_events: [
        {
          id: 'ai_evt_init',
          operation: 'analyze_invoice',
          model: 'gemini-3.7-flash',
          total_tokens: 1350,
          latency_ms: 1840,
          status: 'success',
          user_id: 'allemmni',
          timestamp: '2026-08-20T10:29:45.000Z',
          details: {
            supplier_name: 'SARL DistriFood Algérie',
            items_extracted: 3
          }
        }
      ],
      restaurant_menus: INITIAL_RESTAURANT_MENUS,
      menu_tables: INITIAL_MENU_TABLES,
      table_orders: []
    };
  }

  private async init(): Promise<boolean> {
    ensureDirectories();
    let loadedFromLocal = false;

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const defaultSettings = this.getDefaultSchema().settings;
        const loadedSettings = parsed.settings ? {
          ...defaultSettings,
          ...parsed.settings,
          pricing: parsed.settings.pricing ? {
            ...DEFAULT_PRICING_CONFIG,
            ...parsed.settings.pricing,
            yearly: { ...DEFAULT_PRICING_CONFIG.yearly, ...(parsed.settings.pricing.yearly || {}) },
            lifetime: { ...DEFAULT_PRICING_CONFIG.lifetime, ...(parsed.settings.pricing.lifetime || {}) }
          } : DEFAULT_PRICING_CONFIG
        } : defaultSettings;

        this.data = {
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          licenses: Array.isArray(parsed.licenses) ? parsed.licenses : [],
          license_requests: Array.isArray(parsed.license_requests) ? parsed.license_requests : [],
          activities: Array.isArray(parsed.activities) && parsed.activities.length > 0 ? parsed.activities : INITIAL_ACTIVITIES,
          product_packs: Array.isArray(parsed.product_packs) ? parsed.product_packs : [],
          product_pack_versions: Array.isArray(parsed.product_pack_versions) ? parsed.product_pack_versions : [],
          products: Array.isArray(parsed.products) ? parsed.products : [...INITIAL_PRODUCTS_GROCERY, ...INITIAL_PRODUCTS_HARDWARE],
          admin_users: Array.isArray(parsed.admin_users) ? parsed.admin_users : [],
          audit_logs: Array.isArray(parsed.audit_logs) ? parsed.audit_logs : [],
          settings: loadedSettings,
          purchases: Array.isArray(parsed.purchases) ? parsed.purchases : this.getDefaultSchema().purchases,
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : this.getDefaultSchema().suppliers,
          ai_usage_events: Array.isArray(parsed.ai_usage_events) ? parsed.ai_usage_events : this.getDefaultSchema().ai_usage_events,
          restaurant_menus: Array.isArray(parsed.restaurant_menus) && parsed.restaurant_menus.length > 0 ? parsed.restaurant_menus : INITIAL_RESTAURANT_MENUS,
          menu_tables: Array.isArray(parsed.menu_tables) && parsed.menu_tables.length > 0 ? parsed.menu_tables : INITIAL_MENU_TABLES,
          table_orders: Array.isArray(parsed.table_orders) ? parsed.table_orders : []
        };
        this.syncDiskPackFiles();
        this.ensurePackFilesOnDisk();
        this.ensureSuperAdmin();
        loadedFromLocal = true;
      } catch (err) {
        console.error('Error reading DB_FILE, attempting backup recovery:', err);
      }
    }

    if (!loadedFromLocal) {
      this.seedInitialData();
      this.syncDiskPackFiles();
      this.ensurePackFilesOnDisk();
      this.ensureSuperAdmin();
      this.saveLocal();
    }

    this.isLoaded = true;

    // Fetch & hydrate state from remote Cloud Firestore to survive container restarts/updates
    try {
      const hydrated = await this.hydrateFromFirestore();
      return hydrated;
    } catch (err: any) {
      console.warn('⚠️ Cloud Firestore hydration check:', err.message || err);
      return false;
    }
  }

  private ensureSuperAdmin() {
    const existingSuper = this.data.admin_users.find(
      u => u.email.toLowerCase() === 'allemmnifrench@gmail.com' || u.username.toLowerCase() === 'allemmni'
    );
    if (!existingSuper) {
      this.data.admin_users.unshift({
        id: 'usr_superadmin_allemmni',
        username: 'allemmni',
        email: 'allemmnifrench@gmail.com',
        full_name: 'Super Admin (allemmnifrench@gmail.com)',
        role: 'MAIN_ADMIN',
        active: true,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      });
    } else {
      existingSuper.role = 'MAIN_ADMIN';
      existingSuper.active = true;
    }
  }

  public async hydrateFromFirestore(): Promise<boolean> {
    try {
      console.log('🔄 Checking Firestore for remote cloud state...');
      const remoteState = await fetchRemoteState();
      if (remoteState && typeof remoteState === 'object') {
        const hasCustomers = Array.isArray(remoteState.customers) && remoteState.customers.length > 0;
        const hasLicenses = Array.isArray(remoteState.licenses) && remoteState.licenses.length > 0;
        const hasRequests = Array.isArray(remoteState.license_requests) && remoteState.license_requests.length > 0;
        const hasActivities = Array.isArray(remoteState.activities) && remoteState.activities.length > 0;

        if (hasCustomers || hasLicenses || hasRequests || hasActivities) {
          console.log('☁️ Restoring database from Cloud Firestore (Survives all container updates & rebuilds)...');
          this.data = {
            customers: Array.isArray(remoteState.customers) ? remoteState.customers : this.data.customers,
            licenses: Array.isArray(remoteState.licenses) ? remoteState.licenses : this.data.licenses,
            license_requests: Array.isArray(remoteState.license_requests) ? remoteState.license_requests : this.data.license_requests,
            activities: Array.isArray(remoteState.activities) && remoteState.activities.length > 0 ? remoteState.activities : this.data.activities,
            product_packs: Array.isArray(remoteState.product_packs) ? remoteState.product_packs : this.data.product_packs,
            product_pack_versions: Array.isArray(remoteState.product_pack_versions) ? remoteState.product_pack_versions : this.data.product_pack_versions,
            products: Array.isArray(remoteState.products) && remoteState.products.length > 0 ? remoteState.products : this.data.products,
            admin_users: Array.isArray(remoteState.admin_users) && remoteState.admin_users.length > 0 ? remoteState.admin_users : this.data.admin_users,
            audit_logs: Array.isArray(remoteState.audit_logs) ? remoteState.audit_logs : this.data.audit_logs,
            settings: remoteState.settings ? {
              ...this.getDefaultSchema().settings,
              ...remoteState.settings,
              pricing: remoteState.settings.pricing ? {
                ...DEFAULT_PRICING_CONFIG,
                ...remoteState.settings.pricing,
                yearly: { ...DEFAULT_PRICING_CONFIG.yearly, ...(remoteState.settings.pricing.yearly || {}) },
                lifetime: { ...DEFAULT_PRICING_CONFIG.lifetime, ...(remoteState.settings.pricing.lifetime || {}) }
              } : DEFAULT_PRICING_CONFIG
            } : this.data.settings,
            purchases: Array.isArray(remoteState.purchases) && remoteState.purchases.length > 0 ? remoteState.purchases : this.data.purchases,
            suppliers: Array.isArray(remoteState.suppliers) && remoteState.suppliers.length > 0 ? remoteState.suppliers : this.data.suppliers,
            ai_usage_events: Array.isArray(remoteState.ai_usage_events) ? remoteState.ai_usage_events : this.data.ai_usage_events,
            restaurant_menus: Array.isArray(remoteState.restaurant_menus) && remoteState.restaurant_menus.length > 0 ? remoteState.restaurant_menus : (this.data.restaurant_menus || INITIAL_RESTAURANT_MENUS),
            menu_tables: Array.isArray(remoteState.menu_tables) && remoteState.menu_tables.length > 0 ? remoteState.menu_tables : (this.data.menu_tables || INITIAL_MENU_TABLES),
            table_orders: Array.isArray(remoteState.table_orders) ? remoteState.table_orders : (this.data.table_orders || [])
          };
          this.syncDiskPackFiles();
          this.ensurePackFilesOnDisk();
          this.ensureSuperAdmin();
          this.saveLocal();
          console.log(`✅ Restored: ${this.data.customers.length} customers, ${this.data.licenses.length} licenses, ${this.data.products.length} products across ${this.data.product_pack_versions.length} versions from Cloud Firestore.`);
          return true;
        } else {
          // Cloud doc is empty, push baseline state
          console.log('☁️ Initializing remote Firestore database with baseline state...');
          await saveRemoteState(this.data);
          return true;
        }
      } else {
        // Initializing Firestore for the first time
        console.log('☁️ First-time cloud setup: Pushing current state to Cloud Firestore...');
        await saveRemoteState(this.data);
        return true;
      }
    } catch (err: any) {
      console.warn('⚠️ Cloud Firestore hydration error:', err.message || err);
      return false;
    }
  }

  /**
   * Guarantees all pack version JSON files exist on disk for high-speed POS sync
   */
  public ensurePackFilesOnDisk() {
    try {
      if (!fs.existsSync(PACKS_DIR)) {
        fs.mkdirSync(PACKS_DIR, { recursive: true });
      }

      for (const act of this.data.activities) {
        const actCode = act.code;
        const actDir = path.join(PACKS_DIR, actCode);
        if (!fs.existsSync(actDir)) {
          fs.mkdirSync(actDir, { recursive: true });
        }

        const actVersions = this.data.product_pack_versions.filter(v => v.activity_code === actCode);
        const actProducts = this.data.products.filter(p => p.activity_code === actCode);

        for (const ver of actVersions) {
          const verPath = path.join(actDir, `v${ver.version}.json`);
          if (!fs.existsSync(verPath) || fs.statSync(verPath).size === 0) {
            let prods = actProducts.filter(p => p.version === ver.version);
            if (prods.length === 0) {
              prods = actProducts;
            }
            if (prods.length > 0) {
              fs.writeFileSync(verPath, JSON.stringify(prods, null, 2), 'utf-8');
            }
          }
        }

        // Also ensure latest.json exists
        const latestVer = act.latest_pack_version || (actVersions.length > 0 ? Math.max(...actVersions.map(v => v.version)) : 1);
        const latestPath = path.join(actDir, 'latest.json');
        const verPath = path.join(actDir, `v${latestVer}.json`);
        if (fs.existsSync(verPath)) {
          try {
            fs.copyFileSync(verPath, latestPath);
          } catch {}
        } else if (actProducts.length > 0) {
          fs.writeFileSync(latestPath, JSON.stringify(actProducts, null, 2), 'utf-8');
          fs.writeFileSync(verPath, JSON.stringify(actProducts, null, 2), 'utf-8');
        }
      }
    } catch (err) {
      console.warn('⚠️ ensurePackFilesOnDisk notice:', err);
    }
  }

  /**
   * Scans the data/packs directory to guarantee any version file on disk is registered
   */
  private syncDiskPackFiles() {
    try {
      if (!fs.existsSync(PACKS_DIR)) return;
      const actDirs = fs.readdirSync(PACKS_DIR);
      for (const actCode of actDirs) {
        const actPath = path.join(PACKS_DIR, actCode);
        if (!fs.statSync(actPath).isDirectory()) continue;

        const files = fs.readdirSync(actPath);
        for (const file of files) {
          const match = file.match(/^v(\d+)\.json$/);
          if (match) {
            const verNum = parseInt(match[1], 10);
            const filePath = path.join(actPath, file);
            const raw = fs.readFileSync(filePath, 'utf-8');
            const prods: Product[] = JSON.parse(raw);
            const checksum = computeSha256(raw);

            const exists = this.data.product_pack_versions.find(
              v => v.activity_code === actCode && v.version === verNum
            );

            if (!exists) {
              this.data.product_pack_versions.push({
                version_id: `ver_${actCode}_v${verNum}`,
                activity_code: actCode,
                version: verNum,
                status: 'published',
                checksum_sha256: checksum,
                total_products: prods.length,
                file_size_bytes: Buffer.byteLength(raw),
                changes_summary: `Pack Version v${verNum} (Permanent Master Reference: ${prods.length} items)`,
                created_by: 'system_storage',
                created_at: new Date().toISOString(),
                published_at: new Date().toISOString()
              });
            }

            // Also make sure activity knows the latest version
            const activity = this.data.activities.find(a => a.code === actCode);
            if (activity && (activity.latest_pack_version || 0) < verNum) {
              activity.latest_pack_version = verNum;
              activity.total_products = prods.length;
            }
          }
        }
      }
    } catch (e) {
      console.warn('syncDiskPackFiles notice:', e);
    }
  }

  private saveLocal() {
    ensureDirectories();
    const serialized = JSON.stringify(this.data, null, 2);
    try {
      fs.writeFileSync(DB_FILE, serialized, 'utf-8');
      fs.writeFileSync(`${DB_FILE}.bak`, serialized, 'utf-8');
    } catch (err) {
      console.error('Failed to write local database file:', err);
    }
  }

  public save() {
    this.saveLocal();
    // Non-blocking asynchronous sync to Cloud Firestore
    saveRemoteState(this.data).catch(err => {
      console.warn('⚠️ Cloud Firestore save warning:', err);
    });
  }

  private seedInitialData() {
    this.data = this.getDefaultSchema();
    this.data.customers = [];
    this.data.licenses = [];
    this.data.license_requests = [];
    this.data.audit_logs = [];
  }

  public savePackVersionFile(activity_code: string, version: number, products: Product[]): { filePath: string; checksum: string; size: number } {
    ensureDirectories();
    const actDir = path.join(PACKS_DIR, activity_code);
    if (!fs.existsSync(actDir)) {
      fs.mkdirSync(actDir, { recursive: true });
    }
    const filename = `v${version}.json`;
    const filePath = path.join(actDir, filename);

    // Sanitize every product with strict activity_code and version
    const sanitizedProducts = products.map(p => ({
      ...p,
      activity_code,
      version
    }));

    const content = JSON.stringify(sanitizedProducts, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');

    // Also write latest.json for instant master sync
    try {
      const latestPath = path.join(actDir, 'latest.json');
      fs.writeFileSync(latestPath, content, 'utf-8');
    } catch (e) {
      console.warn('Failed saving latest.json:', e);
    }

    const checksum = computeSha256(content);
    const size = Buffer.byteLength(content);

    // Update in-memory and persisted products list strictly replacing old versions of this activity
    if (Array.isArray(sanitizedProducts) && sanitizedProducts.length > 0) {
      this.data.products = [
        ...this.data.products.filter(p => p.activity_code !== activity_code),
        ...sanitizedProducts
      ];
      this.save();
    }

    return { filePath, checksum, size };
  }

  public getPackVersionProducts(activity_code: string, version?: number): Product[] | null {
    const actDir = path.join(PACKS_DIR, activity_code);
    
    // 1. If specific version number is requested
    if (typeof version === 'number' && version > 0) {
      const filePath = path.join(actDir, `v${version}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
              .filter(p => p && (p.activity_code === activity_code || !p.activity_code))
              .map(p => ({ ...p, activity_code }));
          }
        } catch (err) {
          console.error(`Error reading pack file ${filePath}:`, err);
        }
      }
    }

    // 2. Try latest.json for this activity
    const latestPath = path.join(actDir, 'latest.json');
    if (fs.existsSync(latestPath)) {
      try {
        const raw = fs.readFileSync(latestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter(p => p && (p.activity_code === activity_code || !p.activity_code))
            .map(p => ({ ...p, activity_code }));
        }
      } catch (err) {
        // ignore
      }
    }

    // 3. Fallback from in-memory products strictly for this activity
    const fromMem = this.data.products.filter(p => p && p.activity_code === activity_code);
    if (fromMem.length > 0) {
      return fromMem;
    }

    return null;
  }

  // Getters
  public getCustomers() { return this.data.customers; }
  public getCustomerById(id: string) { return this.data.customers.find(c => c.id === id); }
  public getLicenses() { return this.data.licenses; }
  public getLicenseByKey(key: string) { return this.data.licenses.find(l => l.license_key === key); }
  public getLicenseById(id: string) { return this.data.licenses.find(l => l.license_id === id); }
  public getLicenseRequests() { return this.data.license_requests; }
  public getActivities() { return this.data.activities; }
  public getActivityByCode(code: string) { return this.data.activities.find(a => a.code === code); }
  public getWilayas() { return WILAYAS_DZ; }
  public getProductPacks() { return this.data.product_packs; }
  public getProductPackVersions() { return this.data.product_pack_versions; }
  public getProducts() { return this.data.products; }
  public getAdminUsers() { return this.data.admin_users; }
  public getAuditLogs() { return this.data.audit_logs; }
  public getSettings() { return this.data.settings; }
  public getPurchases() { return this.data.purchases || []; }
  public getPurchaseById(id: string) { return (this.data.purchases || []).find(p => p.id === id); }
  public getSuppliers() { return this.data.suppliers || []; }
  public getSupplierById(id: string) { return (this.data.suppliers || []).find(s => s.id === id); }
  public getAiUsageEvents() { return this.data.ai_usage_events || []; }

  /**
   * Records AI Usage event
   */
  public recordAiUsage(event: AiUsageEvent) {
    if (!this.data.ai_usage_events) {
      this.data.ai_usage_events = [];
    }
    this.data.ai_usage_events.unshift(event);
    if (this.data.ai_usage_events.length > 200) {
      this.data.ai_usage_events = this.data.ai_usage_events.slice(0, 200);
    }
    this.save();
    return event;
  }

  /**
   * Creates or updates a Supplier record
   */
  public createSupplier(supplierData: Partial<Supplier>): Supplier {
    if (!this.data.suppliers) {
      this.data.suppliers = [];
    }
    const nameClean = (supplierData.name || '').trim();
    const existing = this.data.suppliers.find(s => s.name.toLowerCase() === nameClean.toLowerCase());
    if (existing) {
      existing.phone = supplierData.phone || existing.phone;
      existing.email = supplierData.email || existing.email;
      existing.address = supplierData.address || existing.address;
      existing.nif = supplierData.nif || existing.nif;
      existing.nis = supplierData.nis || existing.nis;
      existing.rc = supplierData.rc || existing.rc;
      existing.wilaya_code = supplierData.wilaya_code || existing.wilaya_code;
      existing.wilaya_name = supplierData.wilaya_name || existing.wilaya_name;
      existing.updated_at = new Date().toISOString();
      this.save();
      return existing;
    }

    const newSupplier: Supplier = {
      id: supplierData.id || `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: nameClean,
      phone: supplierData.phone || '',
      email: supplierData.email || '',
      address: supplierData.address || '',
      wilaya_code: supplierData.wilaya_code || '16',
      wilaya_name: supplierData.wilaya_name || 'Alger',
      nif: supplierData.nif || '',
      nis: supplierData.nis || '',
      rc: supplierData.rc || '',
      total_purchases_dzd: supplierData.total_purchases_dzd || 0,
      purchases_count: supplierData.purchases_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.suppliers.unshift(newSupplier);
    this.save();
    return newSupplier;
  }

  /**
   * Creates a Purchase Invoice and optionally confirms it in a secure transaction
   */
  public createPurchase(
    purchaseData: Partial<PurchaseInvoice> & { auto_confirm?: boolean },
    actor: string = 'admin'
  ): PurchaseInvoice {
    if (!this.data.purchases) {
      this.data.purchases = [];
    }

    const id = purchaseData.id || `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const items: PurchaseItem[] = Array.isArray(purchaseData.items) ? purchaseData.items : [];

    let subtotalHt = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalTtc = 0;

    for (const itm of items) {
      subtotalHt += itm.total_ht || ((itm.quantity * itm.unit_price) - (itm.discount || 0));
      totalTax += itm.tax_amount || 0;
      totalDiscount += itm.discount || 0;
      totalTtc += itm.total_ttc || (itm.total_ht + (itm.tax_amount || 0));
    }

    const purchase: PurchaseInvoice = {
      id,
      invoice_number: purchaseData.invoice_number || `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      invoice_date: purchaseData.invoice_date || now.split('T')[0],
      order_ref: purchaseData.order_ref || '',
      supplier_id: purchaseData.supplier_id,
      supplier_name: purchaseData.supplier_name || 'مورد عام',
      supplier_phone: purchaseData.supplier_phone || '',
      supplier_address: purchaseData.supplier_address || '',
      supplier_tax_id: purchaseData.supplier_tax_id || '',
      status: purchaseData.auto_confirm ? 'confirmed' : (purchaseData.status || 'draft'),
      payment_status: purchaseData.payment_status || 'paid',
      payment_method: purchaseData.payment_method || 'cash',
      subtotal_ht: Math.round(subtotalHt * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      total_discount: Math.round(totalDiscount * 100) / 100,
      total_ttc: Math.round(totalTtc * 100) / 100,
      items,
      items_count: items.length,
      notes: purchaseData.notes || '',
      file_url: purchaseData.file_url,
      file_name: purchaseData.file_name,
      activity_code: purchaseData.activity_code || 'grocery',
      created_by: actor,
      created_at: now,
      confirmed_at: purchaseData.auto_confirm ? now : undefined,
      ai_metadata: purchaseData.ai_metadata
    };

    // Ensure supplier exists in directory
    if (purchase.supplier_name) {
      const sup = this.createSupplier({
        name: purchase.supplier_name,
        phone: purchase.supplier_phone,
        address: purchase.supplier_address,
        nif: purchase.supplier_tax_id
      });
      purchase.supplier_id = sup.id;
    }

    this.data.purchases.unshift(purchase);

    // If auto_confirm is requested, execute inventory & catalog update transaction
    if (purchase.status === 'confirmed') {
      this.executeStockUpdateForPurchase(purchase, actor);
    }

    this.addAuditLog(actor, 'ADMIN', 'PURCHASE_CREATED', 'purchase', purchase.id, {
      invoice_number: purchase.invoice_number,
      supplier_name: purchase.supplier_name,
      total_ttc: purchase.total_ttc,
      items_count: purchase.items_count,
      status: purchase.status
    });

    this.save();
    return purchase;
  }

  /**
   * Confirms a purchase invoice and updates product stock levels & purchase prices
   */
  public confirmPurchase(purchaseId: string, actor: string = 'admin'): PurchaseInvoice {
    const purchase = this.getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error(`Purchase invoice with ID ${purchaseId} not found`);
    }

    if (purchase.status === 'confirmed') {
      return purchase; // Already confirmed
    }

    purchase.status = 'confirmed';
    purchase.confirmed_at = new Date().toISOString();

    this.executeStockUpdateForPurchase(purchase, actor);

    this.addAuditLog(actor, 'ADMIN', 'PURCHASE_CONFIRMED', 'purchase', purchase.id, {
      invoice_number: purchase.invoice_number,
      supplier_name: purchase.supplier_name,
      total_ttc: purchase.total_ttc
    });

    this.save();
    return purchase;
  }

  /**
   * Core inventory and product catalog update transaction
   */
  private executeStockUpdateForPurchase(purchase: PurchaseInvoice, actor: string) {
    const now = new Date().toISOString();
    const actCode = purchase.activity_code || 'grocery';

    for (const item of purchase.items) {
      // 1. Existing Matched Product
      if (item.product_id) {
        const prod = this.data.products.find(p => p.product_id === item.product_id);
        if (prod) {
          prod.stock_qty = (prod.stock_qty || 0) + Number(item.quantity);
          prod.purchase_price = Number(item.unit_price) || prod.purchase_price;
          if (item.selling_price && item.selling_price > 0) {
            prod.price = item.selling_price;
            prod.default_price = item.selling_price;
          }
          prod.updated_at = now;
        }
      }
      // 2. New Product Creation
      else if (item.is_new_product || item.match_status === 'new_product' || (!item.product_id && item.raw_name)) {
        const newProdId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const barcodeVal = (item.barcode && item.barcode.trim().length >= 4)
          ? item.barcode.trim()
          : `613${Math.floor(1000000000 + Math.random() * 9000000000)}`;

        const prodName = item.matched_product_name || item.raw_name || 'منتج جديد';
        const sellingPrice = item.selling_price || Math.round((item.unit_price || 100) * 1.25);

        const newProd: Product = {
          product_id: newProdId,
          activity_code: actCode,
          name: prodName,
          name_ar: prodName,
          name_fr: item.raw_name,
          barcode: barcodeVal,
          category: item.category || 'عام',
          brand: 'عام',
          unit: item.unit || 'Pièce',
          price: sellingPrice,
          default_price: sellingPrice,
          purchase_price: item.unit_price || 0,
          stock_qty: Number(item.quantity) || 0,
          min_stock_alert: 5,
          tax_rate: item.tax_rate ?? 0,
          status: 'active',
          version: 1,
          created_at: now,
          updated_at: now
        };

        this.data.products.push(newProd);
        item.product_id = newProdId;
        item.matched_product_name = prodName;
      }
    }

    // Update supplier statistics
    if (purchase.supplier_name) {
      const supplier = this.data.suppliers.find(s => s.name.toLowerCase() === purchase.supplier_name.toLowerCase());
      if (supplier) {
        supplier.total_purchases_dzd = (supplier.total_purchases_dzd || 0) + purchase.total_ttc;
        supplier.purchases_count = (supplier.purchases_count || 0) + 1;
        supplier.updated_at = now;
      }
    }

    // Rebuild pack files on disk so synced POS terminals receive updated catalog and stock
    this.syncDiskPackFiles();
    this.ensurePackFilesOnDisk();
  }

  /**
   * Updates an existing purchase invoice
   */
  public updatePurchase(id: string, updateData: Partial<PurchaseInvoice>, actor: string = 'admin'): PurchaseInvoice {
    const purchase = this.getPurchaseById(id);
    if (!purchase) {
      throw new Error(`Purchase invoice ${id} not found`);
    }

    Object.assign(purchase, updateData);
    if (updateData.items) {
      purchase.items_count = updateData.items.length;
    }

    this.addAuditLog(actor, 'ADMIN', 'PURCHASE_UPDATED', 'purchase', id, {
      invoice_number: purchase.invoice_number,
      supplier_name: purchase.supplier_name
    });

    this.save();
    return purchase;
  }

  /**
   * Deletes a purchase invoice
   */
  public deletePurchase(id: string, actor: string = 'admin'): boolean {
    const idx = (this.data.purchases || []).findIndex(p => p.id === id);
    if (idx === -1) return false;

    const removed = this.data.purchases.splice(idx, 1)[0];
    this.addAuditLog(actor, 'ADMIN', 'PURCHASE_DELETED', 'purchase', id, {
      invoice_number: removed.invoice_number,
      supplier_name: removed.supplier_name,
      total_ttc: removed.total_ttc
    });

    this.save();
    return true;
  }

  // Mutation helpers
  public addAuditLog(actor: string, actor_role: string, action: string, entity: string, entity_id: string, details?: Record<string, any>, ip?: string) {
    const log: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actor,
      actor_role,
      action,
      entity,
      entity_id,
      timestamp: new Date().toISOString(),
      ip: ip || '127.0.0.1',
      details
    };
    this.data.audit_logs.unshift(log);
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.save();
    return log;
  }

  // ==========================================
  // RESTAURANT MENU & TABLE MANAGEMENT METHODS
  // ==========================================

  public getRestaurantMenus(): RestaurantMenu[] {
    return this.data.restaurant_menus || [];
  }

  public getRestaurantMenuById(id: string): RestaurantMenu | undefined {
    return (this.data.restaurant_menus || []).find(m => m.id === id);
  }

  public getRestaurantMenuBySlug(slug: string): RestaurantMenu | undefined {
    const cleanSlug = (slug || '').trim().toLowerCase();
    return (this.data.restaurant_menus || []).find(
      m => (m.public_slug || '').toLowerCase() === cleanSlug || m.id === slug || m.public_token === slug
    );
  }

  public getRestaurantMenuByLicenseKey(licenseKey: string): RestaurantMenu | undefined {
    const cleanKey = (licenseKey || '').trim().toUpperCase();
    return (this.data.restaurant_menus || []).find(
      m => (m.license_key || '').toUpperCase() === cleanKey
    );
  }

  public saveRestaurantMenu(menu: RestaurantMenu, actor: string = 'system'): RestaurantMenu {
    if (!this.data.restaurant_menus) {
      this.data.restaurant_menus = [];
    }

    const idx = this.data.restaurant_menus.findIndex(m => m.id === menu.id || m.license_key === menu.license_key);
    if (idx >= 0) {
      this.data.restaurant_menus[idx] = {
        ...this.data.restaurant_menus[idx],
        ...menu,
        updated_at: new Date().toISOString()
      };
      menu = this.data.restaurant_menus[idx];
    } else {
      this.data.restaurant_menus.unshift(menu);
    }

    this.addAuditLog(actor, 'SYSTEM', 'MENU_SAVED', 'restaurant_menu', menu.id, {
      restaurant_name: menu.restaurant_name,
      license_key: menu.license_key,
      slug: menu.public_slug,
      revision: menu.revision
    });

    this.save();
    return menu;
  }

  public deleteRestaurantMenu(id: string, actor: string = 'admin'): boolean {
    if (!this.data.restaurant_menus) return false;
    const idx = this.data.restaurant_menus.findIndex(m => m.id === id);
    if (idx === -1) return false;

    const removed = this.data.restaurant_menus.splice(idx, 1)[0];
    // Also remove associated tables
    if (this.data.menu_tables) {
      this.data.menu_tables = this.data.menu_tables.filter(t => t.menu_id !== id && t.license_key !== removed.license_key);
    }

    this.addAuditLog(actor, 'ADMIN', 'MENU_DELETED', 'restaurant_menu', id, {
      restaurant_name: removed.restaurant_name,
      slug: removed.public_slug
    });

    this.save();
    return true;
  }

  public getMenuTables(menuId?: string, licenseKey?: string): MenuTable[] {
    let tables = this.data.menu_tables || [];
    if (menuId) {
      tables = tables.filter(t => t.menu_id === menuId);
    }
    if (licenseKey) {
      const cleanKey = licenseKey.trim().toUpperCase();
      tables = tables.filter(t => (t.license_key || '').toUpperCase() === cleanKey);
    }
    return tables;
  }

  public getMenuTableById(id: string): MenuTable | undefined {
    return (this.data.menu_tables || []).find(t => t.id === id);
  }

  public getMenuTableByCode(menuId: string, tableCode: string): MenuTable | undefined {
    const cleanCode = (tableCode || '').trim().toUpperCase();
    return (this.data.menu_tables || []).find(
      t => (t.menu_id === menuId || t.license_key === menuId) && (t.table_code.toUpperCase() === cleanCode || t.table_number.toUpperCase() === cleanCode)
    );
  }

  public saveMenuTable(table: MenuTable, actor: string = 'system'): MenuTable {
    if (!this.data.menu_tables) {
      this.data.menu_tables = [];
    }

    const idx = this.data.menu_tables.findIndex(
      t => t.id === table.id || (t.menu_id === table.menu_id && t.table_code.toUpperCase() === table.table_code.toUpperCase())
    );

    if (idx >= 0) {
      this.data.menu_tables[idx] = {
        ...this.data.menu_tables[idx],
        ...table,
        updated_at: new Date().toISOString()
      };
      table = this.data.menu_tables[idx];
    } else {
      this.data.menu_tables.push(table);
    }

    // Update table count on restaurant menu
    const menu = this.getRestaurantMenuById(table.menu_id);
    if (menu) {
      menu.tables_count = this.getMenuTables(menu.id).length;
    }

    this.save();
    return table;
  }

  public deleteMenuTable(id: string, actor: string = 'admin'): boolean {
    if (!this.data.menu_tables) return false;
    const idx = this.data.menu_tables.findIndex(t => t.id === id);
    if (idx === -1) return false;

    const removed = this.data.menu_tables.splice(idx, 1)[0];
    const menu = this.getRestaurantMenuById(removed.menu_id);
    if (menu) {
      menu.tables_count = this.getMenuTables(menu.id).length;
    }

    this.save();
    return true;
  }

  // ==========================================
  // Table Order Management Methods (QR Orders)
  // ==========================================

  public matchOrderStatus(orderStatus: string, filterStatus: string): boolean {
    if (!filterStatus || filterStatus.toUpperCase() === 'ALL' || filterStatus === '*') return true;
    const ord = (orderStatus || '').trim().toUpperCase();
    const filter = filterStatus.trim().toUpperCase();

    if (ord === filter) return true;

    // Active / Open / Unpaid / Live orders (anything needing staff attention or preparation)
    const activeSet = new Set(['ACTIVE', 'OPEN', 'UNPAID', 'LIVE', 'CURRENT', 'IN_PROGRESS', 'EN_COURS']);
    if (activeSet.has(filter)) {
      return ord === 'WAITING_WAITER' || ord === 'DRAFT' || ord === 'CONFIRMED' || ord === 'SENT_TO_KITCHEN';
    }

    // Pending / Waiting synonyms (WAITING_WAITER is the pending state for Table QR Orders)
    const pendingSet = new Set(['PENDING', 'WAITING', 'WAITING_WAITER', 'WAITING_CONFIRMATION', 'PENDING_CONFIRMATION', 'NEW', 'DRAFT', 'EN_ATTENTE', 'NOUVEAU']);
    if (pendingSet.has(filter)) {
      return pendingSet.has(ord) || ord === 'WAITING_WAITER' || ord === 'DRAFT';
    }

    // Confirmed synonyms
    const confirmedSet = new Set(['CONFIRMED', 'ACCEPTED', 'VALIDATED', 'CONFIRME', 'VALIDE', 'ACCEPTE']);
    if (confirmedSet.has(filter)) {
      return confirmedSet.has(ord);
    }

    // Kitchen / In preparation synonyms
    const kitchenSet = new Set(['SENT_TO_KITCHEN', 'KITCHEN', 'PREPARING', 'IN_PREPARATION', 'CUISINE', 'EN_PREPARATION']);
    if (kitchenSet.has(filter)) {
      return kitchenSet.has(ord);
    }

    // Completed / Done synonyms
    const completedSet = new Set(['COMPLETED', 'DONE', 'SERVED', 'PAID', 'TERMINE', 'PAYE', 'LIVRE']);
    if (completedSet.has(filter)) {
      return completedSet.has(ord);
    }

    // Cancelled synonyms
    const cancelledSet = new Set(['CANCELLED', 'REJECTED', 'ANNULE', 'REFUSE']);
    if (cancelledSet.has(filter)) {
      return cancelledSet.has(ord);
    }

    return false;
  }

  public getTableOrders(identifierOrLicense?: string, status?: string): TableOrder[] {
    let orders = this.data.table_orders || [];
    
    if (identifierOrLicense && identifierOrLicense !== 'ALL' && identifierOrLicense !== '*' && identifierOrLicense !== 'undefined' && identifierOrLicense !== 'null') {
      const cleanIdent = identifierOrLicense.trim().toUpperCase();
      
      // 1. Direct match on license_key, restaurant_id, restaurant_slug, public_order_number, or order id
      let matched = orders.filter(
        o =>
          (o.license_key || '').toUpperCase() === cleanIdent ||
          (o.restaurant_id || '').toUpperCase() === cleanIdent ||
          (o.restaurant_slug || '').toUpperCase() === cleanIdent ||
          (o.id || '').toUpperCase() === cleanIdent ||
          (o.public_order_number || '').toUpperCase() === cleanIdent ||
          (o.public_order_number || '').toUpperCase() === `#${cleanIdent}`
      );

      // 2. Check if identifier is a device_id
      if (matched.length === 0) {
        const licenses = this.data.licenses || [];
        const licenseWithDevice = licenses.find(l =>
          l.devices?.some((d: any) => {
            const devId = typeof d === 'string' ? d : d?.device_id;
            return (devId || '').toUpperCase() === cleanIdent;
          })
        );
        if (licenseWithDevice) {
          const licKey = (licenseWithDevice.license_key || '').toUpperCase();
          matched = orders.filter(o => (o.license_key || '').toUpperCase() === licKey);
        }
      }

      // 3. Check if identifier is a customer ID or license belonging to a menu
      if (matched.length === 0) {
        const menus = this.data.restaurant_menus || [];
        const relatedMenus = menus.filter(
          m =>
            (m.license_key || '').toUpperCase() === cleanIdent ||
            (m.customer_id || '').toUpperCase() === cleanIdent ||
            (m.id || '').toUpperCase() === cleanIdent ||
            (m.public_slug || '').toUpperCase() === cleanIdent
        );

        if (relatedMenus.length > 0) {
          const validKeys = new Set(
            relatedMenus.flatMap(m => [
              (m.license_key || '').toUpperCase(),
              (m.id || '').toUpperCase(),
              (m.public_slug || '').toUpperCase()
            ]).filter(Boolean)
          );

          matched = orders.filter(
            o =>
              validKeys.has((o.license_key || '').toUpperCase()) ||
              validKeys.has((o.restaurant_id || '').toUpperCase()) ||
              validKeys.has((o.restaurant_slug || '').toUpperCase())
          );
        }
      }

      // 4. Resilient Fallback: If still no match but orders exist in database, return all orders
      // This prevents POS synchronization black holes when license prefixes or demo keys differ
      if (matched.length > 0) {
        orders = matched;
      }
    }

    if (status) {
      orders = orders.filter(o => this.matchOrderStatus(o.status, status));
    }

    return orders;
  }

  public getTableOrderById(id: string): TableOrder | undefined {
    if (!id) return undefined;
    const cleanId = id.trim();
    return (this.data.table_orders || []).find(
      o => o.id === cleanId || o.id.toLowerCase() === cleanId.toLowerCase()
    );
  }

  public getTableOrderByToken(tokenOrUrl: string): TableOrder | undefined {
    if (!tokenOrUrl) return undefined;
    const raw = String(tokenOrUrl).trim();
    if (!raw) return undefined;

    const allOrders = this.data.table_orders || [];
    if (allOrders.length === 0) return undefined;

    // Build candidate tokens / IDs
    const candidates = new Set<string>();
    candidates.add(raw);

    // If it's a URL or contains slashes or query parameters
    if (raw.includes('/') || raw.includes('?') || raw.includes('#')) {
      try {
        const parsed = raw.startsWith('http')
          ? new URL(raw)
          : new URL(`http://localhost${raw.startsWith('/') ? '' : '/'}${raw}`);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          candidates.add(parts[parts.length - 1]);
        }
        if (parsed.searchParams.has('token')) candidates.add(parsed.searchParams.get('token')!);
        if (parsed.searchParams.has('code')) candidates.add(parsed.searchParams.get('code')!);
        if (parsed.searchParams.has('id')) candidates.add(parsed.searchParams.get('id')!);
        if (parsed.searchParams.has('order_id')) candidates.add(parsed.searchParams.get('order_id')!);
      } catch {
        const parts = raw.split(/[/?#]/).filter(Boolean);
        if (parts.length > 0) candidates.add(parts[parts.length - 1]);
      }
    }

    // Extract any token substring matching ord_tok_ or ord_
    const matchTok = raw.match(/ord_tok_[a-zA-Z0-9_-]+/);
    if (matchTok) candidates.add(matchTok[0]);
    const matchOrd = raw.match(/ord_[0-9]+_[a-zA-Z0-9]+/);
    if (matchOrd) candidates.add(matchOrd[0]);

    // Check each candidate
    for (const c of candidates) {
      if (!c) continue;
      const cleanC = c.trim();
      const hash = crypto.createHash('sha256').update(cleanC).digest('hex');

      const found = allOrders.find(o => {
        if (o.secure_token === cleanC) return true;
        if (o.secure_token_hash === hash || o.secure_token_hash === cleanC) return true;
        if (o.id === cleanC) return true;
        if (o.public_order_number && (o.public_order_number === cleanC || o.public_order_number.replace(/^#/, '') === cleanC.replace(/^#/, ''))) return true;
        if (o.qr_verification_url && (o.qr_verification_url === cleanC || o.qr_verification_url.endsWith(`/${cleanC}`))) return true;
        return false;
      });

      if (found) return found;
    }

    // Substring search in token or URL as last resilient fallback
    return allOrders.find(o => {
      if (o.secure_token && raw.includes(o.secure_token)) return true;
      if (o.id && raw.includes(o.id)) return true;
      if (o.qr_verification_url && raw.includes(o.qr_verification_url)) return true;
      return false;
    });
  }

  public getTableOrderByIdempotencyKey(key: string, licenseKey?: string): TableOrder | undefined {
    if (!key) return undefined;
    const cleanKey = key.trim();
    return (this.data.table_orders || []).find(o => {
      const matchKey = o.idempotency_key === cleanKey;
      if (!matchKey) return false;
      if (licenseKey) {
        return (o.license_key || '').toUpperCase() === licenseKey.trim().toUpperCase();
      }
      return true;
    });
  }

  public getTableOrderByNumber(publicOrderNumber: string, licenseKey?: string): TableOrder | undefined {
    const cleanNum = (publicOrderNumber || '').trim().replace(/^#/, '');
    return (this.data.table_orders || []).find(o => {
      const oNum = (o.public_order_number || '').trim().replace(/^#/, '');
      if (oNum !== cleanNum) return false;
      if (licenseKey) {
        return (o.license_key || '').toUpperCase() === licenseKey.trim().toUpperCase();
      }
      return true;
    });
  }

  public getTableOrdersByTable(tableCode: string, menuIdOrLicense: string): TableOrder[] {
    const cleanCode = (tableCode || '').trim().toUpperCase();
    const cleanId = (menuIdOrLicense || '').trim().toUpperCase();
    return (this.data.table_orders || []).filter(o => {
      const matchTable = (o.table_code || '').toUpperCase() === cleanCode || (o.table_number || '').toUpperCase() === cleanCode;
      const matchMenu = (o.license_key || '').toUpperCase() === cleanId || o.restaurant_id.toUpperCase() === cleanId || o.restaurant_slug.toUpperCase() === cleanId;
      return matchTable && matchMenu;
    });
  }

  public getNextTableOrderNumber(licenseKey: string): string {
    const cleanKey = (licenseKey || '').trim().toUpperCase();
    const todayPrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const todayOrders = (this.data.table_orders || []).filter(
      o => (o.license_key || '').toUpperCase() === cleanKey && (o.created_at || '').startsWith(todayPrefix)
    );
    const nextSeq = todayOrders.length + 1;
    return `#${String(nextSeq).padStart(3, '0')}`;
  }

  public saveTableOrder(order: TableOrder, actor: string = 'system'): TableOrder {
    if (!this.data.table_orders) {
      this.data.table_orders = [];
    }

    const idx = this.data.table_orders.findIndex(o => o.id === order.id);
    let actionType: 'create' | 'update' = 'create';
    if (idx >= 0) {
      actionType = 'update';
      this.data.table_orders[idx] = {
        ...this.data.table_orders[idx],
        ...order,
        updated_at: new Date().toISOString()
      };
      order = this.data.table_orders[idx];
    } else {
      actionType = 'create';
      this.data.table_orders.unshift(order);
    }

    this.save();

    // Broadcast table order mutation event to real-time subscribers (SSE / WebSockets)
    try {
      this.emitter.emit('table_order_changed', { order, action: actionType, actor });
    } catch (e) {
      console.warn('Error emitting table_order_changed event:', e);
    }

    return order;
  }

  public deleteTableOrder(id: string, actor: string = 'admin'): boolean {
    if (!this.data.table_orders) return false;
    const idx = this.data.table_orders.findIndex(o => o.id === id);
    if (idx === -1) return false;

    const removed = this.data.table_orders.splice(idx, 1)[0];
    this.addAuditLog(actor, 'ADMIN', 'ORDER_DELETED', 'table_order', id, {
      public_order_number: removed.public_order_number,
      license_key: removed.license_key,
      table_code: removed.table_code,
      total: removed.total
    });

    this.save();

    // Broadcast delete event to real-time subscribers
    try {
      this.emitter.emit('table_order_deleted', { orderId: id, order: removed, actor });
    } catch (e) {
      console.warn('Error emitting table_order_deleted event:', e);
    }

    return true;
  }
}

export const db = new DatabaseStore();
