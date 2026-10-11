import localforage from "localforage";

const OLD_DATABASE = "json-tools";
const DATABASE = "datamorph";
const MIGRATION_STORE = "migrations";
const MARKER = "json-tools-v1";
const STORES = ["store", "workspace_v2", "wal"];
type Snapshot = Map<string, Map<IDBValidKey, unknown>>;
let migration: Promise<void> | undefined;

function openExisting(name: string): Promise<IDBDatabase | undefined> {
  return new Promise((resolve, reject) => {
    let missing = false;
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      missing ? resolve(undefined) : reject(request.error);
  });
}
async function readOldDatabase(): Promise<Snapshot> {
  const db = await openExisting(OLD_DATABASE);
  const snapshot: Snapshot = new Map();
  if (!db) return snapshot;
  try {
    const stores = STORES.filter((store) =>
      db.objectStoreNames.contains(store),
    );
    if (!stores.length) return snapshot;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, "readonly");
      for (const name of stores) {
        const entries = new Map<IDBValidKey, unknown>();
        snapshot.set(name, entries);
        const request = tx.objectStore(name).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            entries.set(cursor.key, cursor.value);
            cursor.continue();
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error("旧数据读取失败"));
    });
    return snapshot;
  } finally {
    db.close();
  }
}
async function migrate(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  // localforage creates its stores before the atomic import transaction starts.
  for (const storeName of [...STORES, MIGRATION_STORE])
    await localforage.createInstance({ name: DATABASE, storeName }).ready();
  const snapshot = await readOldDatabase();
  const db = await openExisting(DATABASE);
  if (!db) throw new Error("无法打开 datamorph 数据库");
  try {
    await new Promise<void>((resolve, reject) => {
      // A readwrite transaction serializes competing windows even without Web Locks.
      const tx = db.transaction([...STORES, MIGRATION_STORE], "readwrite");
      const markerStore = tx.objectStore(MIGRATION_STORE);
      const marker = markerStore.get(MARKER);
      marker.onsuccess = () => {
        if (marker.result) return;
        const targetStore = tx.objectStore("store");
        const existingStore = targetStore.getAllKeys();
        const workspace = tx.objectStore("workspace_v2").getAllKeys();
        let ready = 0;
        const copy = () => {
          if (++ready !== 2) return;
          for (const [name, entries] of snapshot) {
            // An existing workspace is a complete set; never merge an old tab order into it.
            if (name === "workspace_v2" && workspace.result.length) continue;
            // Replaying old WAL over an existing destination could overwrite newer settings.
            if (name === "wal" && existingStore.result.length) continue;
            const store = tx.objectStore(name);
            for (const [key, value] of entries) {
              const current = store.get(key);
              current.onsuccess = () => {
                if (current.result === undefined) store.put(value, key);
              };
            }
          }
          markerStore.put({ completedAt: Date.now() }, MARKER);
        };
        existingStore.onsuccess = copy;
        workspace.onsuccess = copy;
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(tx.error || new Error("数据迁移失败，旧数据已保留"));
    });
  } finally {
    db.close();
  }
}
export function ensureBrandMigration(): Promise<void> {
  if (!migration)
    migration = migrate().catch((error) => {
      migration = undefined;
      throw error;
    });
  return migration;
}
