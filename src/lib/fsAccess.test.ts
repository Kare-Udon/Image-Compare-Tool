import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importDroppedImagesForGroup, pickImagesForGroup, readFileFromHandle } from './fsAccess'
import { getHandle, saveHandle } from './handleStore'

vi.mock('./handleStore', () => ({
  saveHandle: vi.fn(),
  getHandle: vi.fn(),
}))

const mockedSaveHandle = vi.mocked(saveHandle)
const mockedGetHandle = vi.mocked(getHandle)

function createMockHandle(name: string, permission: PermissionState = 'granted') {
  const getFile = vi.fn().mockResolvedValue(new Blob(['content']))
  const queryPermission = vi.fn().mockResolvedValue(permission)
  const requestPermission = vi.fn().mockResolvedValue(permission)

  return {
    kind: 'file',
    name,
    getFile,
    queryPermission,
    requestPermission,
  } as unknown as FileSystemFileHandle
}

function createDataTransfer(items: DataTransferItem[], files?: File[]): DataTransfer {
  const list = {
    length: items.length,
    item: (index: number) => items[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* items
    },
  } as unknown as DataTransferItemList

  const fileList =
    files && files.length > 0
      ? ({
          length: files.length,
          item: (index: number) => files[index] ?? null,
          [Symbol.iterator]: function* () {
            yield* files
          },
          0: files[0],
        } as unknown as FileList)
      : ([] as unknown as FileList)

  return {
    items: list,
    files: fileList,
    types: [],
    dropEffect: 'copy',
    effectAllowed: 'all',
    clearData: vi.fn(),
    getData: vi.fn(),
    setData: vi.fn(),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer
}

describe('pickImagesForGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).showOpenFilePicker
  })

  it('缺少文件选择 API 时使用 input 选择器导入文件', async () => {
    mockedSaveHandle.mockResolvedValue(true)

    const promise = pickImagesForGroup('group-1')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null

    expect(input).not.toBeNull()
    expect(input?.multiple).toBe(true)
    expect(input?.accept).toContain('png')

    if (!input) throw new Error('file input not found')

    const file = new File(['demo'], 'fallback.png', { type: 'image/png' })
    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: fileList,
    })

    input.dispatchEvent(new Event('change'))

    const result = await promise
    expect(result).toHaveLength(1)
    expect(result[0].fileName).toBe('fallback.png')
    expect(mockedSaveHandle).toHaveBeenCalledTimes(1)
  })

  it('input 选择被取消时返回空数组', async () => {
    vi.useFakeTimers()

    try {
      const promise = pickImagesForGroup('group-cancel')
      expect(document.querySelector('input[type="file"]')).not.toBeNull()

      window.dispatchEvent(new Event('focus'))
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result).toEqual([])
      expect(mockedSaveHandle).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('可以在选择文件后生成 ImageEntry 并保存句柄', async () => {
    const handle = createMockHandle('demo.png')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).showOpenFilePicker = vi.fn().mockResolvedValue([handle])
    mockedSaveHandle.mockResolvedValue(true)

    const result = await pickImagesForGroup('group-2')

    expect(result).toHaveLength(1)
    expect(result[0].groupId).toBe('group-2')
    expect(result[0].fileName).toBe('demo.png')
    expect(result[0].handleKey).toContain('handle-group-2')
    expect(mockedSaveHandle).toHaveBeenCalledTimes(1)
  })

  it('保存句柄失败时跳过对应文件', async () => {
    const handle = createMockHandle('skip.png')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).showOpenFilePicker = vi.fn().mockResolvedValue([handle])
    mockedSaveHandle.mockResolvedValue(false)

    const result = await pickImagesForGroup('group-3')
    expect(result).toEqual([])
  })
})

describe('importDroppedImagesForGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSaveHandle.mockResolvedValue(true)
  })

  it('支持通过拖拽的文件句柄导入图片', async () => {
    const handle = createMockHandle('drop.png')
    const item = {
      kind: 'file',
      type: 'image/png',
      getAsFileSystemHandle: vi.fn().mockResolvedValue(handle),
      getAsFile: vi.fn(),
    } as unknown as DataTransferItem

    const dataTransfer = createDataTransfer([item])
    const entries = await importDroppedImagesForGroup('group-drop', dataTransfer)

    expect(entries).toHaveLength(1)
    expect(entries[0].fileName).toBe('drop.png')
    expect(mockedSaveHandle).toHaveBeenCalledWith(expect.stringContaining('handle-group-drop'), handle)
  })

  it('在缺少文件句柄时会退化使用 File 对象', async () => {
    const file = new File(['demo'], 'drag.jpg', { type: 'image/jpeg' })
    const item = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFile: vi.fn().mockReturnValue(file),
    } as unknown as DataTransferItem

    const dataTransfer = createDataTransfer([item])
    const entries = await importDroppedImagesForGroup('group-fallback', dataTransfer)

    expect(entries).toHaveLength(1)
    expect(entries[0].fileName).toBe('drag.jpg')
    expect(mockedSaveHandle).toHaveBeenCalledWith(
      expect.stringContaining('handle-group-fallback'),
      file,
    )
  })

  it('非图片文件会被跳过', async () => {
    const file = new File(['text'], 'note.txt', { type: 'text/plain' })
    const item = {
      kind: 'file',
      type: 'text/plain',
      getAsFile: vi.fn().mockReturnValue(file),
    } as unknown as DataTransferItem

    const dataTransfer = createDataTransfer([item])
    const entries = await importDroppedImagesForGroup('group-ignore', dataTransfer)

    expect(entries).toEqual([])
    expect(mockedSaveHandle).not.toHaveBeenCalled()
  })

  it('items 为空时会回退使用 files 列表导入', async () => {
    const file = new File(['raw'], 'only-files.png', { type: 'image/png' })
    const dataTransfer = createDataTransfer([], [file])

    const entries = await importDroppedImagesForGroup('group-files', dataTransfer)

    expect(entries).toHaveLength(1)
    expect(entries[0].fileName).toBe('only-files.png')
    expect(mockedSaveHandle).toHaveBeenCalledWith(
      expect.stringContaining('handle-group-files'),
      file,
    )
  })
})

describe('readFileFromHandle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('当句柄不存在时返回 null', async () => {
    mockedGetHandle.mockResolvedValue(null)
    const result = await readFileFromHandle('missing')
    expect(result).toBeNull()
  })

  it('权限被拒绝时返回 null 且不读取文件', async () => {
    const handle = createMockHandle('blocked.png', 'denied')
    mockedGetHandle.mockResolvedValue(handle)

    const result = await readFileFromHandle('denied')

    expect(result).toBeNull()
    expect((handle as { getFile: () => Promise<Blob> }).getFile).not.toHaveBeenCalled()
  })

  it('权限允许时可以返回文件 Blob', async () => {
    const handle = createMockHandle('ok.png', 'granted')
    mockedGetHandle.mockResolvedValue(handle)

    const result = await readFileFromHandle('ok-key')

    expect(result).toBeInstanceOf(Blob)
    expect((result as Blob).size).toBeGreaterThan(0)
  })

  it('直接存储的 Blob 可以原样返回', async () => {
    const blob = new Blob(['inline'], { type: 'image/png' })
    mockedGetHandle.mockResolvedValue(blob)

    const result = await readFileFromHandle('blob-key')

    expect(result).toBe(blob)
  })
})
