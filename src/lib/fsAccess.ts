import type { GroupId, ImageEntry } from '../types'
import { getHandle, saveHandle } from './handleStore'

type FilePermissionDescriptor = {
  mode?: 'read' | 'readwrite'
}

type FileSystemFileHandleWithPermission = FileSystemFileHandle & {
  queryPermission?: (descriptor?: FilePermissionDescriptor) => Promise<PermissionState>
  requestPermission?: (descriptor?: FilePermissionDescriptor) => Promise<PermissionState>
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const IMAGE_ACCEPT = IMAGE_EXTENSIONS.join(',')

type FileSource = FileSystemFileHandle | File

async function pickWithFallbackInput(): Promise<File[]> {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !document.body) {
    console.warn('缺少 DOM 环境，无法打开文件选择对话框，返回空列表。')
    return []
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = IMAGE_ACCEPT
  input.multiple = true
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  input.style.top = '0'
  input.style.opacity = '0'

  return new Promise((resolve) => {
    const cleanup = () => {
      input.removeEventListener('change', handleChange)
      window.removeEventListener('focus', handleFocus)
      input.remove()
    }

    const handleChange = () => {
      const files = Array.from(input.files ?? [])
      cleanup()
      resolve(files)
    }

    const handleFocus = () => {
      setTimeout(() => {
        if (input.files && input.files.length > 0) return
        cleanup()
        resolve([])
      }, 200)
    }

    input.addEventListener('change', handleChange, { once: true })
    window.addEventListener('focus', handleFocus, { once: true })
    document.body.appendChild(input)

    try {
      input.click()
    } catch (error) {
      console.warn('触发文件选择对话框失败。', error)
      cleanup()
      resolve([])
    }
  })
}

function createId(prefix: string): string {
  const randomChunk = Math.random().toString(36).slice(2, 8)
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${randomChunk}`
  return `${prefix}-${uuid}`
}

async function ensureReadPermission(handle: FileSystemFileHandle): Promise<boolean> {
  const withPermission = handle as FileSystemFileHandleWithPermission
  const queryPermission = withPermission.queryPermission?.bind(withPermission)
  const requestPermission = withPermission.requestPermission?.bind(withPermission)

  if (!queryPermission || !requestPermission) return true

  try {
    const status = await queryPermission({ mode: 'read' })
    if (status === 'granted') return true
    if (status === 'denied') return false

    const next = await requestPermission({ mode: 'read' })
    return next === 'granted'
  } catch (error) {
    console.warn('查询或请求文件权限失败。', error)
    return false
  }
}

export async function pickImagesForGroup(groupId: GroupId): Promise<ImageEntry[]> {
  // 强制使用传统的 input 方式选择文件，不再尝试使用 File System Access API
  const sources = await pickWithFallbackInput()
  return createEntriesFromSources(groupId, sources)
}

export async function readFileFromHandle(handleKey: string): Promise<Blob | null> {
  const handle = await getHandle(handleKey)
  if (!handle) return null

  if (handle instanceof Blob) {
    return handle
  }

  // 虽然现在主要路径是 Blob (File)，但如果 DB 中有旧的 FileSystemHandle，
  // 仍然尝试读取（如果浏览器支持），否则可能需要用户重新添加。
  // 这里保留对旧数据的兼容逻辑，但不再主动请求权限。
  try {
    const granted = await ensureReadPermission(handle)
    if (!granted) {
      console.warn('未获得文件读取权限，返回 null。')
      return null
    }
    const file = await handle.getFile()
    return file
  } catch (error) {
    console.warn('从句柄读取文件失败。', error)
    return null
  }
}

function isImageName(name: string): boolean {
  const lower = name.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function isSupportedImage(source: FileSource): boolean {
  if (!source.name) return false
  if (source instanceof File && source.type.startsWith('image/')) return true
  return isImageName(source.name)
}

async function createEntriesFromSources(
  groupId: GroupId,
  sources: FileSource[],
): Promise<ImageEntry[]> {
  const now = new Date().toISOString()
  const entries: ImageEntry[] = []

  for (const source of sources) {
    if (!isSupportedImage(source)) continue

    const handleKey = createId(`handle-${groupId}`)
    const saved = await saveHandle(handleKey, source)
    if (!saved) {
      console.warn(`句柄 ${source.name} 保存失败，已跳过。`)
      continue
    }

    entries.push({
      id: createId('image'),
      groupId,
      fileName: source.name,
      handleKey,
      addedAt: now,
    })
  }

  return entries
}

async function resolveDataTransferSources(dataTransfer: DataTransfer): Promise<FileSource[]> {
  const items = Array.from(dataTransfer.items ?? []).filter((item) => item.kind === 'file')
  const sources: FileSource[] = []
  const seen = new Set<string>()

  const track = (source: FileSource | null | undefined) => {
    if (!source || !source.name) return
    const key = `${source.name}-${source instanceof File ? source.size : 'handle'}`
    if (seen.has(key)) return
    seen.add(key)
    sources.push(source)
  }

  for (const item of items) {
    // 移除对 getAsFileSystemHandle 的尝试，只使用标准的 getAsFile
    const file = item.getAsFile?.()
    track(file ?? undefined)
  }

  if (sources.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
    Array.from(dataTransfer.files).forEach((file) => track(file))
  }

  return sources
}

export async function importDroppedImagesForGroup(
  groupId: GroupId,
  dataTransfer: DataTransfer,
): Promise<ImageEntry[]> {
  const sources = await resolveDataTransferSources(dataTransfer)
  if (sources.length === 0) return []
  return createEntriesFromSources(groupId, sources)
}
