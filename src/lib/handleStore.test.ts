import { beforeEach, describe, expect, it, vi } from 'vitest'

type StoreValue = Map<string, unknown>

type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

type MutableRequest<T> = Mutable<IDBRequest<T>>
type MutableOpenRequest = Mutable<IDBOpenDBRequest>

function createFakeHandle(name: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getFile: async () => new Blob(),
  } as unknown as FileSystemFileHandle
}

class FakeTransaction {
  oncomplete: ((this: IDBTransaction, ev: Event) => void) | null = null
  onerror: ((this: IDBTransaction, ev: Event) => void) | null = null
  onabort: ((this: IDBTransaction, ev: Event) => void) | null = null

  private store: StoreValue

  constructor(store: StoreValue) {
    this.store = store
  }

  objectStore(): IDBObjectStore {
    return new FakeObjectStore(this.store, this) as unknown as IDBObjectStore
  }

  complete() {
    const tx = this as unknown as IDBTransaction
    this.oncomplete?.call(tx, new Event('complete'))
  }
}

function createRequest<T>() {
  const request = {
    onsuccess: null,
    onerror: null,
    result: undefined as unknown as T,
    readyState: 'pending' as IDBRequestReadyState,
    source: null,
    transaction: null,
    error: null,
  } as unknown as MutableRequest<T>
  return request
}

class FakeObjectStore {
  private store: StoreValue
  private tx: FakeTransaction

  constructor(store: StoreValue, tx: FakeTransaction) {
    this.store = store
    this.tx = tx
  }

  put(value: unknown, key?: IDBValidKey) {
    const request = createRequest<IDBValidKey>()

    queueMicrotask(() => {
      this.store.set(String(key), value)
      request.result = key as IDBValidKey
      request.onsuccess?.call(request as IDBRequest<IDBValidKey>, new Event('success'))
      this.tx.complete()
    })

    return request
  }

  get(key: IDBValidKey) {
    const request = createRequest<unknown>()

    queueMicrotask(() => {
      request.result = this.store.get(String(key))
      request.onsuccess?.call(request as IDBRequest<unknown>, new Event('success'))
      this.tx.complete()
    })

    return request
  }
}

class FakeDatabase {
  private stores = new Map<string, StoreValue>()

  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  } as unknown as DOMStringList

  createObjectStore(name: string) {
    const data: StoreValue = new Map()
    this.stores.set(name, data)
    return new FakeObjectStore(data, new FakeTransaction(data))
  }

  transaction(name: string): IDBTransaction {
    const store = this.stores.get(name) ?? new Map<string, unknown>()
    this.stores.set(name, store)
    return new FakeTransaction(store) as unknown as IDBTransaction
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close() {}
}

function installFakeIndexedDB() {
  const db = new FakeDatabase()
  const factory: IDBFactory = {
    open: () => {
      const request: MutableOpenRequest = {
        ...createRequest<IDBDatabase>(),
        onblocked: null,
        onupgradeneeded: null,
        result: db as unknown as IDBDatabase,
      } as MutableOpenRequest

      queueMicrotask(() => {
        request.onupgradeneeded?.call(
          request as IDBOpenDBRequest,
          new Event('upgradeneeded') as IDBVersionChangeEvent,
        )
        request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'))
      })

      return request as IDBOpenDBRequest
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    deleteDatabase: () => ({} as IDBOpenDBRequest),
    cmp: () => 0,
    databases: async () => [],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).indexedDB = factory
}

describe('handleStore', () => {
  beforeEach(() => {
    vi.resetModules()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).indexedDB
  })

  it('当环境缺失 indexedDB 时直接返回失败', async () => {
    const { getHandle, saveHandle } = await import('./handleStore')
    const saved = await saveHandle('key-1', createFakeHandle('a.png'))
    expect(saved).toBe(false)
    expect(await getHandle('key-1')).toBeNull()
  })

  it('可以保存并读取句柄', async () => {
    installFakeIndexedDB()
    const { getHandle, saveHandle } = await import('./handleStore')
    const handle = createFakeHandle('b.png')

    const saved = await saveHandle('key-2', handle)
    expect(saved).toBe(true)

    const restored = await getHandle('key-2')
    expect(restored).toBe(handle)
  })

  it('可以保存并读取 Blob 数据作为回退', async () => {
    installFakeIndexedDB()
    const { getHandle, saveHandle } = await import('./handleStore')
    const blob = new Blob(['demo'], { type: 'image/png' })

    const saved = await saveHandle('key-blob', blob)
    expect(saved).toBe(true)

    const restored = await getHandle('key-blob')
    expect(restored).toBeInstanceOf(Blob)
  })
})
