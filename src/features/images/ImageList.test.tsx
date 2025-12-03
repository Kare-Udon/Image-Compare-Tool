import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImageList from './ImageList'
import { AppStateProvider, useAppState } from '../appState/AppStateProvider'
import type { PersistedState } from '../../types'
import {
  importDroppedImagesForGroup,
  pickImagesForGroup,
  readFileFromHandle,
} from '../../lib/fsAccess'

vi.mock('../../lib/storage', () => ({
  loadPersistedState: vi.fn(() => null),
  savePersistedState: vi.fn(),
}))

vi.mock('../../lib/fsAccess', () => ({
  pickImagesForGroup: vi.fn(),
  importDroppedImagesForGroup: vi.fn(),
  readFileFromHandle: vi.fn(),
}))

const mockImportDroppedImagesForGroup = vi.mocked(importDroppedImagesForGroup)
const mockPickImagesForGroup = vi.mocked(pickImagesForGroup)
const mockReadFileFromHandle = vi.mocked(readFileFromHandle)

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
  return <ImageList />
}

function renderWithState(snapshot: PersistedState) {
  return render(
    <AppStateProvider>
      <WithState snapshot={snapshot} />
    </AppStateProvider>,
  )
}

function createDataTransferWithFile(options?: { withItems?: boolean; fileName?: string }): DataTransfer {
  const file = new File(['png'], options?.fileName ?? 'dragged.png', { type: 'image/png' })

  const item = {
    kind: 'file',
    type: 'image/png',
    getAsFile: vi.fn().mockReturnValue(file),
  } as unknown as DataTransferItem

  const list =
    options?.withItems === false
      ? ({
          length: 0,
          item: () => null,
          [Symbol.iterator]: function* () {
            return
          },
        } as unknown as DataTransferItemList)
      : ({
          length: 1,
          item: (index: number) => (index === 0 ? item : null),
          [Symbol.iterator]: function* () {
            yield item
          },
        } as unknown as DataTransferItemList)

  const files = {
    0: file,
    length: 1,
    item: (index: number) => (index === 0 ? file : null),
    [Symbol.iterator]: function* () {
      yield file
    },
  } as unknown as FileList

  return {
    items: list,
    files,
    types: ['Files'],
    dropEffect: 'copy',
    effectAllowed: 'all',
    clearData: vi.fn(),
    getData: vi.fn(),
    setData: vi.fn(),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReadFileFromHandle.mockResolvedValue(new Blob(['img'], { type: 'image/png' }))
  mockImportDroppedImagesForGroup.mockResolvedValue([])
  mockPickImagesForGroup.mockResolvedValue([])

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
  cleanup()
})

describe('ImageList 拖拽导入', () => {
  it('拖拽进入时显示提示遮罩', () => {
    renderWithState(baseState)
    const dropArea = screen.getByTestId('image-drop-area')
    const dataTransfer = createDataTransferWithFile()

    fireEvent.dragEnter(dropArea, { dataTransfer })

    expect(screen.getByText(/释放到此处/)).toBeInTheDocument()
  })

  it('拖拽图片后会触发导入并渲染文件名', async () => {
    mockImportDroppedImagesForGroup.mockResolvedValue([
      {
        id: 'img-1',
        groupId: 'g1',
        fileName: 'dragged.png',
        handleKey: 'handle-g1',
        addedAt: '2024-01-02T00:00:00.000Z',
      },
    ])

    renderWithState(baseState)
    const dropArea = screen.getByTestId('image-drop-area')
    const dataTransfer = createDataTransferWithFile()

    fireEvent.drop(dropArea, { dataTransfer })

    await waitFor(() => {
      expect(mockImportDroppedImagesForGroup).toHaveBeenCalledWith('g1', dataTransfer)
    })

    expect(await screen.findByText('dragged.png')).toBeInTheDocument()
  })

  it('仅包含 files 列表时也能触发拖拽导入', async () => {
    mockImportDroppedImagesForGroup.mockResolvedValue([
      {
        id: 'img-2',
        groupId: 'g1',
        fileName: 'drag-files.png',
        handleKey: 'handle-g1-2',
        addedAt: '2024-01-03T00:00:00.000Z',
      },
    ])

    renderWithState(baseState)
    const dropArea = screen.getByTestId('image-drop-area')
    const dataTransfer = createDataTransferWithFile({ withItems: false, fileName: 'drag-files.png' })

    fireEvent.dragEnter(dropArea, { dataTransfer })
    expect(screen.getByText(/释放到此处/)).toBeInTheDocument()

    fireEvent.drop(dropArea, { dataTransfer })

    await waitFor(() => {
      expect(mockImportDroppedImagesForGroup).toHaveBeenCalledWith('g1', dataTransfer)
    })

    expect(await screen.findByText('drag-files.png')).toBeInTheDocument()
  })

  it('句柄不可访问时在缩略图显示不可访问提示', async () => {
    const snapshot: PersistedState = {
      ...baseState,
      images: [
        {
          id: 'img-unreadable',
          groupId: 'g1',
          fileName: 'lost.png',
          handleKey: 'hk-lost',
          addedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
    }
    mockReadFileFromHandle.mockResolvedValue(null)

    renderWithState(snapshot)

    expect(await screen.findByText(/文件不可访问/)).toBeInTheDocument()
  })
})
