import { useEffect, useMemo, useState } from 'react'
import type { GroupComparisonState, ImageEntry } from '../../types'
import { readFileFromHandle } from '../../lib/fsAccess'

type GroupImageGridProps = {
  images: ImageEntry[]
  comparison?: GroupComparisonState
  onSetA: (imageId: string) => void
  onSetB: (imageId: string) => void
  onRemove: (imageId: string) => void
}

type PreviewState = {
  url: string | null
  loading: boolean
  error: boolean
}

function useImagePreview(handleKey: string): PreviewState {
  const [state, setState] = useState<PreviewState>({ url: null, loading: true, error: false })

  useEffect(() => {
    let revokedUrl: string | null = null
    let cancelled = false

    async function load() {
      setState({ url: null, loading: true, error: false })
      const file = await readFileFromHandle(handleKey)
      if (cancelled) return

      if (!file) {
        setState({ url: null, loading: false, error: true })
        return
      }

      const url = URL.createObjectURL(file)
      revokedUrl = url
      setState({ url, loading: false, error: false })
    }

    load()

    return () => {
      cancelled = true
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [handleKey])

  return state
}

type ImageCardProps = {
  image: ImageEntry
  isA: boolean
  isB: boolean
  onSetA: () => void
  onSetB: () => void
  onRemove: () => void
}

function ImageCard({ image, isA, isB, onSetA, onSetB, onRemove }: ImageCardProps) {
  const preview = useImagePreview(image.handleKey)

  const badges = useMemo(() => {
    const list = [] as string[]
    if (isA) list.push('A')
    if (isB) list.push('B')
    return list.join('/')
  }, [isA, isB])

  return (
    <div className="image-card">
      <div className="image-card__thumb">
        {preview.loading && <div className="image-card__placeholder">加载中...</div>}
        {!preview.loading && preview.error && (
          <div className="image-card__placeholder">文件不可访问，请检查权限或路径</div>
        )}
        {!preview.loading && !preview.error && preview.url && (
          <img src={preview.url} alt={image.fileName} />
        )}
        {badges && <span className="image-card__badge">{badges}</span>}
      </div>
      <div className="image-card__info">
        <p className="image-card__name" title={image.fileName}>
          {image.fileName}
        </p>
        <p className="image-card__meta">导入于 {new Date(image.addedAt).toLocaleString()}</p>
      </div>
      <div className="image-card__actions">
        <button className={isA ? 'solid' : ''} onClick={onSetA}>
          {isA ? '已设为 A' : '设为 A'}
        </button>
        <button className={isB ? 'solid' : ''} onClick={onSetB}>
          {isB ? '已设为 B' : '设为 B'}
        </button>
        <button className="danger" onClick={onRemove}>
          删除
        </button>
      </div>
    </div>
  )
}

function sortByAddedAt(images: ImageEntry[]): ImageEntry[] {
  return [...images].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

function GroupImageGrid({ images, comparison, onSetA, onSetB, onRemove }: GroupImageGridProps) {
  if (images.length === 0) {
    return <div className="panel__placeholder">当前组暂无图片，请先导入。</div>
  }

  const sorted = useMemo(() => sortByAddedAt(images), [images])

  return (
    <div className="image-grid">
      {sorted.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          isA={comparison?.imageAId === image.id}
          isB={comparison?.imageBId === image.id}
          onSetA={() => onSetA(image.id)}
          onSetB={() => onSetB(image.id)}
          onRemove={() => onRemove(image.id)}
        />
      ))}
    </div>
  )
}

export default GroupImageGrid
