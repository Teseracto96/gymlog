/* ============================================================
   core/db.js — persistencia local (IndexedDB, con respaldo en localStorage)
   Guarda cada colección como un valor bajo una llave.
   ============================================================ */
App.db = (() => {
  const DB_NAME = 'gymlog', STORE = 'kv', VERSION = 1;
  let dbp = null, useLS = false;

  const open = () => {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      if (!('indexedDB' in window)) { useLS = true; return resolve(null); }
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { console.warn('IndexedDB no disponible, uso localStorage'); useLS = true; resolve(null); };
    });
    return dbp;
  };

  const get = async (key) => {
    const db = await open();
    if (useLS || !db) { try { return JSON.parse(localStorage.getItem('gymlog:' + key)); } catch { return null; } }
    return new Promise((res, rej) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result ?? null); r.onerror = () => rej(r.error);
    });
  };

  const set = async (key, value) => {
    const db = await open();
    if (useLS || !db) { localStorage.setItem('gymlog:' + key, JSON.stringify(value)); return; }
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  };

  /** Pide al navegador que no borre los datos (importante en iOS) */
  const persist = async () => {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { }
    return false;
  };

  return { get, set, persist };
})();
