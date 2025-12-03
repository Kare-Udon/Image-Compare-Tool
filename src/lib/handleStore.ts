const DB_NAME = 'image-compare-tool-handles'
const STORE_NAME = 'file-handles'
const DB_VERSION = 1

type DatabaseResult = IDBDatabase | null

let dbPromise: Promise<DatabaseResult> | null = null

function getIndexedDB(): IDBFactory | null {
  if (typeof indexedDB === 'undefined') return null
  return indexedDB
}

function openDatabase(): Promise<DatabaseResult> {
  if (dbPromise) return dbPromise

  const factory = getIndexedDB()
  if (!factory) {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }

  dbPromise = new Promise((resolve) => {
    const request = factory.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      console.warn('初始化 IndexedDB 失败，句柄存储不可用。', request.error)
      resolve(null)
    }

    request.onblocked = () => {
      console.warn('IndexedDB 升级被阻塞，句柄存储可能不可用。')
    }
  })

  return dbPromise
}

export async function saveHandle(
  handleKey: string,
  handle: FileSystemFileHandle | Blob,
): Promise<boolean> {
  const db = await openDatabase()
  if (!db) return false

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    store.put(handle, handleKey)

    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => {
      console.warn('保存句柄到 IndexedDB 失败。', transaction.error)
      resolve(false)
    }
    transaction.onabort = () => {
      console.warn('保存句柄的事务已中止。', transaction.error)
      resolve(false)
    }
  })
}

export async function getHandle(handleKey: string): Promise<FileSystemFileHandle | Blob | null> {
  const db = await openDatabase()
  if (!db) return null

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(handleKey)

    request.onsuccess = () => {
      const handle = request.result as FileSystemFileHandle | undefined
      resolve(handle ?? null)
    }

    const handleError = () => {
      console.warn('读取句柄失败，返回 null。', request.error ?? transaction.error)
      resolve(null)
    }

    request.onerror = handleError
    transaction.onerror = handleError
    transaction.onabort = handleError
  })
}
