import type { PersistedState } from '../types'

export const PERSISTED_STATE_KEY = 'image-compare-tool:persisted-state'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function resolveStorage(): StorageLike | null {
  const candidate =
    typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage
      : null

  if (!candidate) return null

  try {
    const probeKey = '__image_compare_probe__'
    candidate.setItem(probeKey, '1')
    candidate.removeItem(probeKey)
    return candidate
  } catch (error) {
    console.warn('localStorage 不可用，跳过持久化。', error)
    return null
  }
}

export function loadPersistedState(): PersistedState | null {
  const storage = resolveStorage()
  if (!storage) return null

  const raw = storage.getItem(PERSISTED_STATE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as PersistedState
  } catch (error) {
    console.warn('读取持久化状态失败，数据格式异常。', error)
    return null
  }
}

export function savePersistedState(state: PersistedState): void {
  const storage = resolveStorage()
  if (!storage) return

  try {
    storage.setItem(PERSISTED_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('保存持久化状态失败。', error)
  }
}
