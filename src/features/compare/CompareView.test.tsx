import '@testing-library/jest-dom/vitest'
import { useEffect } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CompareView from './CompareView'
import { AppStateProvider, useAppState } from '../appState/AppStateProvider'
import type { PersistedState } from '../../types'
import { readFileFromHandle } from '../../lib/fsAccess'

vi.mock('../../lib/storage', () => ({
  loadPersistedState: vi.fn(() => null),
  savePersistedState: vi.fn(),
}))

vi.mock('../../lib/fsAccess', () => ({
  readFileFromHandle: vi.fn(),
}))

const mockReadFileFromHandle = vi.mocked(readFileFromHandle)
const originalInnerHeight = window.innerHeight
const resizeObservers: ResizeObserverCallback[] = []

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    resizeObservers.push(callback)
  }

  observe() {}

  unobserve() {}

  disconnect() {}

  static trigger(width: number) {
    resizeObservers.forEach((callback) => {
      callback(
        [
          {
            contentRect: { width, height: 0, x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0 },
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      )
    })
  }
}

const baseState: PersistedState = {
  groups: [{ id: 'g1', name: '测试组', createdAt: '2024-01-01T00:00:00.000Z', order: 0 }],
  images: [],
  comparisons: [{ groupId: 'g1', imageAId: null, imageBId: null }],
  lastActiveGroupId: 'g1',
}

type WithStateProps = {
  snapshot: PersistedState
}

function WithState({ snapshot }: WithStateProps) {
  const { dispatch } = useAppState()

  useEffect(() => {
    dispatch({ type: 'replaceState', payload: snapshot })
  }, [dispatch, snapshot])

  return <CompareView />
}

function renderWithState(snapshot: PersistedState) {
  return render(
    <AppStateProvider>
      <WithState snapshot={snapshot} />
    </AppStateProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resizeObservers.length = 0
  // @ts-expect-error jsdom 缺少 ResizeObserver，测试中用轻量 mock
  global.ResizeObserver = ResizeObserverMock

  if (!('createObjectURL' in URL)) {
    // @ts-expect-error
    URL.createObjectURL = vi.fn(() => 'blob:mock')
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  }

  if (!('revokeObjectURL' in URL)) {
    // @ts-expect-error
    URL.revokeObjectURL = vi.fn()
  } else {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  }
})

afterEach(() => {
  Object.defineProperty(window, 'innerHeight', {
    value: originalInnerHeight,
    writable: true,
    configurable: true,
  })
  cleanup()
})

describe('CompareView', () => {
  it('未选择 A/B 时展示提示', () => {
    renderWithState(baseState)
    expect(
      screen.getByText(/请在当前组的图片列表中分别设为 A 和 B 后开始对比。/),
    ).toBeInTheDocument()
  })

  it('读取失败时给出错误提示', async () => {
    mockReadFileFromHandle.mockResolvedValue(null)

    const snapshot: PersistedState = {
      ...baseState,
      images: [
        {
          id: 'img-a',
          groupId: 'g1',
          fileName: 'a.png',
          handleKey: 'ha',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'img-b',
          groupId: 'g1',
          fileName: 'b.png',
          handleKey: 'hb',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      comparisons: [{ groupId: 'g1', imageAId: 'img-a', imageBId: 'img-b' }],
    }

    renderWithState(snapshot)

    await waitFor(() => {
      expect(screen.getByText(/文件不可访问/)).toBeInTheDocument()
    })
  })

  it('读取异常时也能提示错误，不会卡在加载状态', async () => {
    mockReadFileFromHandle.mockRejectedValue(new Error('boom'))

    const snapshot: PersistedState = {
      ...baseState,
      images: [
        {
          id: 'img-a',
          groupId: 'g1',
          fileName: 'before.png',
          handleKey: 'ha',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'img-b',
          groupId: 'g1',
          fileName: 'after.png',
          handleKey: 'hb',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      comparisons: [{ groupId: 'g1', imageAId: 'img-a', imageBId: 'img-b' }],
    }

    renderWithState(snapshot)

    await waitFor(() => {
      expect(screen.getByText(/文件不可访问/)).toBeInTheDocument()
    })
  })

  it('成功读取后展示对比视图与滑杆', async () => {
    mockReadFileFromHandle.mockResolvedValue(new Blob(['ok'], { type: 'image/png' }))

    const snapshot: PersistedState = {
      ...baseState,
      images: [
        {
          id: 'img-a',
          groupId: 'g1',
          fileName: 'before.png',
          handleKey: 'ha',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'img-b',
          groupId: 'g1',
          fileName: 'after.png',
          handleKey: 'hb',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      comparisons: [{ groupId: 'g1', imageAId: 'img-a', imageBId: 'img-b' }],
    }

    renderWithState(snapshot)

    await waitFor(() => {
      expect(screen.getByText('before.png')).toBeInTheDocument()
      expect(screen.getByText('after.png')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('对比滑杆')).toBeInTheDocument()
  })

  it('滑杆移动时左右分别展示 A/B 可见范围', async () => {
    mockReadFileFromHandle.mockResolvedValue(new Blob(['ok'], { type: 'image/png' }))

    const snapshot: PersistedState = {
      ...baseState,
      images: [
        {
          id: 'img-a',
          groupId: 'g1',
          fileName: 'before.png',
          handleKey: 'ha',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'img-b',
          groupId: 'g1',
          fileName: 'after.png',
          handleKey: 'hb',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      comparisons: [{ groupId: 'g1', imageAId: 'img-a', imageBId: 'img-b' }],
    }

    renderWithState(snapshot)

    const slider = await screen.findByLabelText('对比滑杆')
    const handle = screen.getByTestId('twenty-slider')
    const track = handle.parentElement as HTMLElement

    expect(track.style.left).toBe('50%')

    fireEvent.input(slider, { target: { value: '30' } })

    await waitFor(() => {
      expect(screen.getByTestId('twenty-slider').parentElement).toHaveStyle({ left: '30%' })
    })
  })

  it('画布高度会随着图片比例和宽度调整，避免折叠后被截断', async () => {
    mockReadFileFromHandle.mockResolvedValue(new Blob(['ok'], { type: 'image/png' }))
    Object.defineProperty(window, 'innerHeight', { value: 1000, writable: true, configurable: true })

    const snapshot: PersistedState = {
      ...baseState,
      images: [
        {
          id: 'img-a',
          groupId: 'g1',
          fileName: 'before.png',
          handleKey: 'ha',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'img-b',
          groupId: 'g1',
          fileName: 'after.png',
          handleKey: 'hb',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      comparisons: [{ groupId: 'g1', imageAId: 'img-a', imageBId: 'img-b' }],
    }

    renderWithState(snapshot)

    const canvas = await screen.findByTestId('compare-canvas')
    const [imgA, imgB] = await screen.findAllByRole('img')
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({
        width: 1200,
        height: 0,
        top: 96,
        right: 0,
        bottom: 0,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      configurable: true,
    })

    Object.defineProperty(imgA, 'naturalWidth', { value: 1600, configurable: true })
    Object.defineProperty(imgA, 'naturalHeight', { value: 900, configurable: true })
    Object.defineProperty(imgB, 'naturalWidth', { value: 900, configurable: true })
    Object.defineProperty(imgB, 'naturalHeight', { value: 1600, configurable: true })

    fireEvent.load(imgA)
    fireEvent.load(imgB)

    ResizeObserverMock.trigger(1200)

    await waitFor(() => {
      expect(canvas).toHaveStyle({ height: '2133px' })
    })
  })
})
