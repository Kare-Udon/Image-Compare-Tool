import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { PERSISTED_STATE_KEY, loadPersistedState, savePersistedState } from './storage'
import type { PersistedState } from '../types'

type StorageRecord = Record<string, string>

function createMockStorage(initial: StorageRecord = {}): Storage {
  let store: StorageRecord = { ...initial }

  return {
    get length() {
      return Object.keys(store).length
    },
    clear: () => {
      store = {}
    },
    getItem: (key: string) => store[key] ?? null,
    key: (index: number) => Object.keys(store)[index] ?? null,
    removeItem: (key: string) => {
      delete store[key]
    },
    setItem: (key: string, value: string) => {
      store[key] = value
    },
  }
}

const sampleState: PersistedState = {
  groups: [
    { id: 'g1', name: '组 1', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
  ],
  images: [],
  comparisons: [{ groupId: 'g1', imageAId: null, imageBId: null }],
  lastActiveGroupId: 'g1',
}

describe('storage helpers', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('返回 null 当未提供 localStorage 时', () => {
    expect(loadPersistedState()).toBeNull()
  })

  it('可以持久化并恢复状态', () => {
    const mockStorage = createMockStorage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).localStorage = mockStorage

    savePersistedState(sampleState)
    expect(mockStorage.getItem(PERSISTED_STATE_KEY)).toEqual(JSON.stringify(sampleState))

    const restored = loadPersistedState()
    expect(restored).toEqual(sampleState)
  })

  it('遇到非法 JSON 时返回 null', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mockStorage = createMockStorage({
      [PERSISTED_STATE_KEY]: '{bad json',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).localStorage = mockStorage

    expect(loadPersistedState()).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })
})
