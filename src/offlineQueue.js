// IndexedDB offline queue — gracefully handles environments without IndexedDB
// ── Offline Queue — IndexedDB-backed sync queue ───────────────
// Stores POS operations when offline, replays when back online

const DB_NAME    = 'biteerp-offline'
const DB_VERSION = 1
const STORE      = 'queue'

let db = null

async function getDB() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB not available')
  if (db) return db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const d = e.target.result
      if (!d.objectStoreNames.contains(STORE)) {
        const store = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('status', 'status')
        store.createIndex('created_at', 'created_at')
      }
    }
    req.onsuccess = e => { db = e.target.result; resolve(db) }
    req.onerror   = () => reject(req.error)
  })
}

export async function enqueue(type, payload) {
  const d = await getDB()
  return new Promise((resolve, reject) => {
    const tx   = d.transaction(STORE, 'readwrite')
    const item = { type, payload, status: 'pending', created_at: Date.now(), retries: 0 }
    const req  = tx.objectStore(STORE).add(item)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function getPending() {
  const d = await getDB()
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readonly')
    const idx = tx.objectStore(STORE).index('status')
    const req = idx.getAll('pending')
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function markDone(id) {
  const d = await getDB()
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => {
      const item = req.result
      if (item) { item.status = 'synced'; item.synced_at = Date.now(); tx.objectStore(STORE).put(item) }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function markFailed(id, error) {
  const d = await getDB()
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => {
      const item = req.result
      if (item) {
        item.retries = (item.retries || 0) + 1
        item.status  = item.retries >= 3 ? 'failed' : 'pending'
        item.last_error = error
        tx.objectStore(STORE).put(item)
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingCount() {
  try {
    const pending = await getPending()
    return pending.length
  } catch { return 0 }
}

export async function clearSynced() {
  const d = await getDB()
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readwrite')
    const idx = tx.objectStore(STORE).index('status')
    const req = idx.openCursor('synced')
    req.onsuccess = e => {
      const cursor = e.target.result
      if (cursor) { cursor.delete(); cursor.continue() }
      else resolve()
    }
    req.onerror = () => reject(req.error)
  })
}
