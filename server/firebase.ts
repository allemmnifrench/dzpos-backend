import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let firebaseConfig: any = null;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    firebaseConfig = JSON.parse(raw);
  }
} catch (err) {
  console.warn('Could not load firebase-applet-config.json:', err);
}

export function getFirebaseApp() {
  if (!firebaseConfig) {
    return null;
  }
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

let cachedDb: any = null;

export function getFirebaseDb() {
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp();
  if (!app) return null;
  const databaseId = firebaseConfig?.firestoreDatabaseId;
  try {
    if (databaseId) {
      cachedDb = initializeFirestore(app, {
        ignoreUndefinedProperties: true
      }, databaseId);
    } else {
      cachedDb = initializeFirestore(app, {
        ignoreUndefinedProperties: true
      });
    }
  } catch (err) {
    // If already initialized, get instance
    try {
      cachedDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    } catch (e) {
      console.warn('Fallback getting Firestore instance:', e);
      cachedDb = getFirestore(app);
    }
  }
  return cachedDb;
}

const DZPOS_COLLECTION = 'dzpos_system';

// Quota exhaustion Circuit Breaker
let quotaExhaustedUntil: number = 0;
let quotaWarningLogged = false;

// Dirty checking cache to prevent redundant writes
const lastSavedHashes: Record<string, string> = {};

// Debounce timer for saving state
let debounceTimer: NodeJS.Timeout | null = null;
let pendingStateToSave: any = null;

function computeHash(data: any): string {
  try {
    const str = JSON.stringify(data || '');
    return crypto.createHash('sha256').update(str).digest('hex');
  } catch {
    return String(Date.now());
  }
}

/**
 * Deeply sanitizes an object to remove undefined values and non-serializable fields
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return undefined;
    return value;
  }));
}

export async function fetchRemoteState(): Promise<any | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    // 1. First attempt to load modular collections for resilience against 1MB document size limit
    const collections = [
      'customers',
      'licenses',
      'license_requests',
      'activities',
      'product_packs',
      'product_pack_versions',
      'products',
      'admin_users',
      'audit_logs',
      'settings',
      'purchases',
      'suppliers',
      'ai_usage_events',
      'restaurant_menus',
      'menu_tables',
      'table_orders'
    ];

    const results = await Promise.all(
      collections.map(async (name) => {
        try {
          // Special handling for chunked products
          if (name === 'products') {
            const metaSnap = await getDoc(doc(db, DZPOS_COLLECTION, 'products_meta'));
            if (metaSnap.exists()) {
              const meta = metaSnap.data();
              const totalChunks = meta?.total_chunks || 0;
              if (totalChunks > 0) {
                const chunkPromises = [];
                for (let i = 0; i < totalChunks; i++) {
                  chunkPromises.push(getDoc(doc(db, DZPOS_COLLECTION, `products_chunk_${i}`)));
                }
                const chunkSnaps = await Promise.all(chunkPromises);
                let allProducts: any[] = [];
                for (const chunkSnap of chunkSnaps) {
                  if (chunkSnap.exists()) {
                    const chunkItems = chunkSnap.data()?.items || [];
                    allProducts = allProducts.concat(chunkItems);
                  }
                }
                lastSavedHashes['products'] = computeHash(allProducts);
                return { name: 'products', data: allProducts };
              }
            }
          }

          const snap = await getDoc(doc(db, DZPOS_COLLECTION, name));
          if (snap.exists()) {
            const val = snap.data()?.items ?? snap.data();
            lastSavedHashes[name] = computeHash(val);
            return { name, data: val };
          }
        } catch (e: any) {
          if (e?.message?.includes('RESOURCE_EXHAUSTED') || e?.code === 'resource-exhausted') {
            quotaExhaustedUntil = Date.now() + 30 * 60 * 1000; // 30 mins cooldown
          }
        }
        return { name, data: null };
      })
    );

    const modularState: Record<string, any> = {};
    let hasModularData = false;

    for (const res of results) {
      if (res.data !== null && res.data !== undefined) {
        modularState[res.name] = res.data;
        if (Array.isArray(res.data) && res.data.length > 0) {
          hasModularData = true;
        } else if (res.name === 'settings' && typeof res.data === 'object' && Object.keys(res.data).length > 0) {
          hasModularData = true;
        }
      }
    }

    if (hasModularData) {
      console.log('☁️ Successfully fetched modular state from Cloud Firestore');
      return modularState;
    }

    // 2. Fallback to main_state document if modular documents don't exist yet
    const mainDocRef = doc(db, DZPOS_COLLECTION, 'main_state');
    const mainSnap = await getDoc(mainDocRef);
    if (mainSnap.exists()) {
      console.log('☁️ Successfully fetched legacy main_state from Cloud Firestore');
      return mainSnap.data();
    }
  } catch (err: any) {
    if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.code === 'resource-exhausted') {
      quotaExhaustedUntil = Date.now() + 30 * 60 * 1000;
      console.warn('⚠️ Cloud Firestore free quota limit reached. Using local database storage.');
    } else {
      console.warn('⚠️ Error reading remote Firestore state:', err?.message || err);
    }
  }
  return null;
}

/**
 * Execute actual write with dirty-checking and error-isolation
 */
async function executeSave(state: any): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  // Circuit breaker: skip remote writes if quota was recently exceeded
  if (Date.now() < quotaExhaustedUntil) {
    if (!quotaWarningLogged) {
      console.warn('ℹ️ Notice: Firestore free write quota limit is active. Changes are safely saved locally on disk.');
      quotaWarningLogged = true;
    }
    return false;
  }

  try {
    const clean = sanitizeForFirestore(state);
    const now = new Date().toISOString();

    const modules: Record<string, any> = {
      customers: clean.customers || [],
      licenses: clean.licenses || [],
      license_requests: clean.license_requests || [],
      activities: clean.activities || [],
      product_packs: clean.product_packs || [],
      product_pack_versions: clean.product_pack_versions || [],
      products: clean.products || [],
      admin_users: clean.admin_users || [],
      audit_logs: (clean.audit_logs || []).slice(0, 100), // Keep latest 100 logs
      settings: clean.settings || {},
      purchases: clean.purchases || [],
      suppliers: clean.suppliers || [],
      ai_usage_events: (clean.ai_usage_events || []).slice(0, 150),
      restaurant_menus: clean.restaurant_menus || [],
      menu_tables: clean.menu_tables || [],
      table_orders: (clean.table_orders || []).slice(0, 500) // Keep latest 500 orders
    };

    let writtenCount = 0;

    const savePromises = Object.entries(modules).map(async ([colName, data]) => {
      const currentHash = computeHash(data);
      // Dirty check: only write if this specific module actually changed
      if (lastSavedHashes[colName] === currentHash) {
        return;
      }

      try {
        // Special chunked saving for products to never exceed 1MB per document
        if (colName === 'products' && Array.isArray(data) && data.length > 200) {
          const CHUNK_SIZE = 200;
          const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
          const chunkWrites = [];

          for (let i = 0; i < totalChunks; i++) {
            const chunkItems = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const chunkRef = doc(db, DZPOS_COLLECTION, `products_chunk_${i}`);
            chunkWrites.push(setDoc(chunkRef, { items: chunkItems, _updated_at: now }, { merge: false }));
          }

          // Meta document tracking total chunks
          const metaRef = doc(db, DZPOS_COLLECTION, 'products_meta');
          chunkWrites.push(setDoc(metaRef, { total_chunks: totalChunks, total_count: data.length, _updated_at: now }, { merge: false }));

          await Promise.all(chunkWrites);
          lastSavedHashes[colName] = currentHash;
          writtenCount++;
          return;
        }

        const docRef = doc(db, DZPOS_COLLECTION, colName);
        const payload = Array.isArray(data) ? { items: data, _updated_at: now } : { ...data, _updated_at: now };
        await setDoc(docRef, payload, { merge: false });
        lastSavedHashes[colName] = currentHash;
        writtenCount++;
      } catch (err: any) {
        if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.code === 'resource-exhausted') {
          quotaExhaustedUntil = Date.now() + 30 * 60 * 1000;
          console.warn(`ℹ️ Firestore daily write quota limit reached on module ${colName}. Local disk storage is actively serving all requests.`);
        } else {
          console.warn(`⚠️ Warning saving modular doc ${colName} to Firestore:`, err?.message || err);
        }
      }
    });

    await Promise.all(savePromises);

    if (writtenCount > 0) {
      console.log(`✅ State synced to Cloud Firestore (${writtenCount} modules updated)`);
    }
    return true;
  } catch (err: any) {
    if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.code === 'resource-exhausted') {
      quotaExhaustedUntil = Date.now() + 30 * 60 * 1000;
      console.warn('ℹ️ Firestore write quota exhausted. Backing off cloud sync; local database operating normally.');
    } else {
      console.error('⚠️ Firestore save warning:', err?.message || err);
    }
    return false;
  }
}

/**
 * Debounced save function to prevent exhausting Firestore quotas during rapid mutations
 */
export async function saveRemoteState(state: any): Promise<boolean> {
  pendingStateToSave = state;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  return new Promise((resolve) => {
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      if (pendingStateToSave) {
        const toSave = pendingStateToSave;
        pendingStateToSave = null;
        const res = await executeSave(toSave);
        resolve(res);
      } else {
        resolve(true);
      }
    }, 5000); // 5 seconds debounce
  });
}

