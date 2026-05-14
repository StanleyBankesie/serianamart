import { openDB } from "./db.js";

const POS_SALES_STORE = "pos_sales";

export async function ensurePosStore() {
  const db = await openDB();
  if (!db.objectStoreNames.contains(POS_SALES_STORE)) {
    db.close();
    // Re-open with upgraded schema
    const req = indexedDB.open("OmniSuiteOffline", db.version + 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(POS_SALES_STORE)) {
        const store = d.createObjectStore(POS_SALES_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return db;
}

async function withStore(mode, callback) {
  const db = await ensurePosStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(POS_SALES_STORE, mode);
    const store = tx.objectStore(POS_SALES_STORE);
    callback(store, resolve, reject);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLocalSale(sale) {
  return withStore("readwrite", (store, resolve, reject) => {
    const req = store.put({
      ...sale,
      updatedAt: Date.now(),
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalSale(id) {
  return withStore("readonly", (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLocalSales(status) {
  return withStore("readonly", (store, resolve, reject) => {
    if (status) {
      const idx = store.index("status");
      const req = idx.getAll(status);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } else {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }
  });
}

export async function deleteLocalSale(id) {
  return withStore("readwrite", (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getUnsyncedSales() {
  return getAllLocalSales("pending");
}

export async function getFailedSales() {
  return getAllLocalSales("failed");
}
