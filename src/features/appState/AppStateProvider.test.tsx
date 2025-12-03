import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider, useAppState } from './AppStateProvider'
import type { PersistedState } from '../../types'
import { loadPersistedState } from '../../lib/storage'

vi.mock('../../lib/storage', () => ({
  loadPersistedState: vi.fn(),
  savePersistedState: vi.fn(),
}))

const mockLoadPersistedState = vi.mocked(loadPersistedState)

function StateReader() {
  const { state } = useAppState()
  return (
    <div>
      <span data-testid="active-group">{state.lastActiveGroupId}</span>
      <span data-testid="image-count">{state.images.length}</span>
      <span data-testid="comparison-a">{state.comparisons[0]?.imageAId ?? 'null'}</span>
      <span data-testid="comparison-b">{state.comparisons[0]?.imageBId ?? 'null'}</span>
    </div>
  )
}

describe('AppStateProvider 初始化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('启动时使用持久化状态并进行基础校验', () => {
    const persisted: PersistedState = {
      groups: [
        { id: 'g1', name: '存档组', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
      ],
      images: [
        {
          id: 'img-valid',
          groupId: 'g1',
          fileName: 'ok.png',
          handleKey: 'hk-ok',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'img-orphan',
          groupId: 'missing',
          fileName: 'lost.png',
          handleKey: 'hk-lost',
          addedAt: '2024-01-03T00:00:00.000Z',
        },
      ],
      comparisons: [
        { groupId: 'g1', imageAId: 'img-orphan', imageBId: 'img-valid' },
        { groupId: 'missing', imageAId: 'img-orphan', imageBId: null },
      ],
      lastActiveGroupId: 'missing',
    }

    mockLoadPersistedState.mockReturnValue(persisted)

    render(
      <AppStateProvider>
        <StateReader />
      </AppStateProvider>,
    )

    expect(mockLoadPersistedState).toHaveBeenCalled()
    expect(screen.getByTestId('active-group').textContent).toBe('g1')
    expect(screen.getByTestId('image-count').textContent).toBe('1')
    expect(screen.getByTestId('comparison-a').textContent).toBe('null')
    expect(screen.getByTestId('comparison-b').textContent).toBe('img-valid')
  })
})
