import type { DragEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { importDroppedImagesForGroup, pickImagesForGroup } from '../../lib/fsAccess'
import type { ImageEntry } from '../../types'
import { useAppState } from '../appState/AppStateProvider'
import GroupImageGrid from './GroupImageGrid'

function ImageList() {
  const { state, dispatch } = useAppState()
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepthRef = useRef(0)

  const activeGroup = useMemo(
    () => state.groups.find((group) => group.id === state.lastActiveGroupId) ?? null,
    [state.groups, state.lastActiveGroupId],
  )

  const activeComparison = useMemo(
    () => state.comparisons.find((item) => item.groupId === activeGroup?.id),
    [state.comparisons, activeGroup?.id],
  )

  const groupImages = useMemo(
    () => state.images.filter((image) => image.groupId === activeGroup?.id),
    [state.images, activeGroup?.id],
  )

  const importImages = async (loader: () => Promise<ImageEntry[]>) => {
    if (!activeGroup || isImporting) return
    setIsImporting(true)
    try {
      const entries = await loader()
      if (entries.length > 0) {
        dispatch({ type: 'addImages', payload: { groupId: activeGroup.id, images: entries } })
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleAddImages = () => {
    if (!activeGroup) return
    importImages(() => pickImagesForGroup(activeGroup.id))
  }

  const hasFilePayload = (event: DragEvent<HTMLElement>) => {
    const dataTransfer = event.dataTransfer
    if (!dataTransfer) return false

    const hasItems = Array.from(dataTransfer.items ?? []).some((item) => item.kind === 'file')
    if (hasItems) return true

    if (dataTransfer.files && dataTransfer.files.length > 0) return true

    return Array.from(dataTransfer.types ?? []).includes('Files')
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilePayload(event)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilePayload(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilePayload(event)) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    setIsDragging(dragDepthRef.current > 0)
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilePayload(event) || !activeGroup || !event.dataTransfer) return
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    await importImages(() => importDroppedImagesForGroup(activeGroup.id, event.dataTransfer as DataTransfer))
  }

  const handleRemove = (imageId: string) => {
    const confirmed = window.confirm('确定要删除这张图片吗？此操作不会影响本地文件。')
    if (!confirmed) return
    dispatch({ type: 'removeImage', payload: { imageId } })
  }

  if (!activeGroup) {
    return (
      <div className="panel__content">
        <h2 className="panel__title">图片列表</h2>
        <div className="panel__placeholder">暂无可用组，请先创建一个组。</div>
      </div>
    )
  }

  return (
    <div
      className={`panel__content image-drop-area${isDragging ? ' image-drop-area--active' : ''}`}
      data-testid="image-drop-area"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="panel__header">
        <div>
          <h2 className="panel__title">图片列表</h2>
          <p className="panel__desc">
            当前组：{activeGroup.name}（{groupImages.length} 张）
          </p>
        </div>
        <button className="primary" onClick={handleAddImages} disabled={isImporting}>
          {isImporting ? '导入中...' : '添加图片'}
        </button>
      </div>
      <p className="panel__meta">拖拽图片到此区域或点击上方按钮即可导入。</p>
      {isDragging && (
        <div className="image-drop-area__overlay">
          将图片释放到此处以添加到「{activeGroup.name}」
        </div>
      )}
      <GroupImageGrid
        images={groupImages}
        comparison={activeComparison}
        onSetA={(imageId) =>
          dispatch({ type: 'setImageA', payload: { groupId: activeGroup.id, imageId } })
        }
        onSetB={(imageId) =>
          dispatch({ type: 'setImageB', payload: { groupId: activeGroup.id, imageId } })
        }
        onRemove={handleRemove}
      />
    </div>
  )
}

export default ImageList
