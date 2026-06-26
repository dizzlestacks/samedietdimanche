const DB_NAME = "yardees-offline";
const DB_VERSION = 1;
const LISTINGS_STORE = "listings";
const META_STORE = "meta";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LISTINGS_STORE)) {
        db.createObjectStore(LISTINGS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheListings(listings: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(LISTINGS_STORE, "readwrite");
    const store = tx.objectStore(LISTINGS_STORE);
    for (const listing of listings) {
      store.put(listing);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const metaTx = db.transaction(META_STORE, "readwrite");
    metaTx.objectStore(META_STORE).put({ key: "lastCached", value: Date.now() });
    db.close();
  } catch {
    // IndexedDB unavailable
  }
}

export async function getCachedListings(): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(LISTINGS_STORE, "readonly");
    const store = tx.objectStore(LISTINGS_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const results = request.result || [];
        results.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        resolve(results);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return [];
  }
}

export async function getCachedListing(id: number): Promise<any | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(LISTINGS_STORE, "readonly");
    const store = tx.objectStore(LISTINGS_STORE);
    const request = store.get(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return null;
  }
}

export async function getLastCachedTime(): Promise<number | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, "readonly");
    const request = tx.objectStore(META_STORE).get("lastCached");
    return new Promise((resolve) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result?.value || null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function getCachedListingCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(LISTINGS_STORE, "readonly");
    const request = tx.objectStore(LISTINGS_STORE).count();
    return new Promise((resolve) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => {
        db.close();
        resolve(0);
      };
    });
  } catch {
    return 0;
  }
}
