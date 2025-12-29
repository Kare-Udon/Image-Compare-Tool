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
  })

  async function simulateInputSelection(files: File[]) {
    // 等待 input 被挂载到 DOM
    await vi.waitFor(() => {
      expect(document.querySelector('input[type="file"]')).not.toBeNull()
    })
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    const fileList = {
      length: files.length,
      item: (index: number) => files[index] ?? null,
      [Symbol.iterator]: function* () {
        yield* files
      },
    } as unknown as FileList

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: fileList,
    })

    input.dispatchEvent(new Event('change'))
  }

  it('使用 input 选择器导入文件', async () => {
    mockedSaveHandle.mockResolvedValue(true)

    const promise = pickImagesForGroup('group-1')
    
    const file = new File(['demo'], 'fallback.png', { type: 'image/png' })
    await simulateInputSelection([file])

    const result = await promise
    expect(result).toHaveLength(1)
    expect(result[0].fileName).toBe('fallback.png')
    expect(mockedSaveHandle).toHaveBeenCalledTimes(1)
  })

  it('input 选择被取消时返回空数组', async () => {
    vi.useFakeTimers()

    try {
      const promise = pickImagesForGroup('group-cancel')
      
      // 等待 input 挂载
      await vi.waitUntil(() => document.querySelector('input[type="file"]') !== null)
      
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
    mockedSaveHandle.mockResolvedValue(true)
    const file = new File(['demo'], 'demo.png', { type: 'image/png' })

    const promise = pickImagesForGroup('group-2')
    await simulateInputSelection([file])
    const result = await promise

    expect(result).toHaveLength(1)
    expect(result[0].groupId).toBe('group-2')
    expect(result[0].fileName).toBe('demo.png')
    expect(result[0].handleKey).toContain('handle-group-2')
    expect(mockedSaveHandle).toHaveBeenCalledTimes(1)
    expect(mockedSaveHandle).toHaveBeenCalledWith(expect.any(String), file)
  })

  it('保存句柄失败时跳过对应文件', async () => {
    mockedSaveHandle.mockResolvedValue(false)
    const file = new File(['skip'], 'skip.png', { type: 'image/png' })

    const promise = pickImagesForGroup('group-3')
    await simulateInputSelection([file])
    const result = await promise
    
    expect(result).toEqual([])
  })
})

describe('importDroppedImagesForGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSaveHandle.mockResolvedValue(true)
  })

  // 已移除 "支持通过拖拽的文件句柄导入图片" 测试用例，因为不再支持该路径

  it('使用 File 对象导入拖拽的图片', async () => {
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
