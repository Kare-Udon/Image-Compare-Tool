import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TwentyTwenty from 'react-twentytwenty'
import { useAppState } from '../appState/AppStateProvider'
import type { ImageEntry } from '../../types'
import { readFileFromHandle } from '../../lib/fsAccess'

type SourceState = {
  url: string | null
  loading: boolean
  error: boolean
}

type NaturalSize = {
  width: number
  height: number
}

const MIN_CANVAS_HEIGHT = 360
const DEFAULT_CANVAS_HEIGHT = 720
const BOARD_VERTICAL_PADDING = 24
const BOARD_STACK_GAP = 12

const getFallbackHeight = () => {
  if (typeof window === 'undefined') return DEFAULT_CANVAS_HEIGHT

  const target = Number.isFinite(window.innerHeight) ? window.innerHeight * 0.82 : DEFAULT_CANVAS_HEIGHT
  return Math.max(MIN_CANVAS_HEIGHT, Math.round(target))
}

function useImageSource(entry: ImageEntry | null): SourceState {
  const [state, setState] = useState<SourceState>({
    url: null,
    loading: Boolean(entry),
    error: false,
  })

  useEffect(() => {
    let cancelled = false
    let revokedUrl: string | null = null

    async function load() {
      if (!entry) {
        setState({ url: null, loading: false, error: false })
        return
      }

      setState({ url: null, loading: true, error: false })

      try {
        const file = await readFileFromHandle(entry.handleKey)
        if (cancelled) return

        if (!file) {
          setState({ url: null, loading: false, error: true })
          return
        }

        const url = URL.createObjectURL(file)
        revokedUrl = url
        setState({ url, loading: false, error: false })
      } catch (error) {
        console.warn('读取图片时出现异常。', error)
        if (cancelled) return
        setState({ url: null, loading: false, error: true })
      }
    }

    load()

    return () => {
      cancelled = true
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [entry?.id, entry?.handleKey])

  return state
}

type CompareBoardProps = {
  imageA: ImageEntry
  imageB: ImageEntry
  urlA: string
  urlB: string
}

function CompareBoard({ imageA, imageB, urlA, urlB }: CompareBoardProps) {
  const [ratio, setRatio] = useState(0.5)
  const [imageSizes, setImageSizes] = useState<{ a?: NaturalSize; b?: NaturalSize }>({})
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null)
  const [boardHeight, setBoardHeight] = useState<number | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const controlsRef = useRef<HTMLLabelElement | null>(null)
  const legendRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setRatio(0.5)
  }, [imageA.id, imageB.id])

  useEffect(() => {
    setImageSizes({})
    setCanvasHeight(null)
  }, [imageA.id, imageB.id])

  const aspectRatio = useMemo(() => {
    const ratios = [imageSizes.a, imageSizes.b]
      .filter((item): item is NaturalSize => Boolean(item))
      .map((item) => item.height / item.width)

    if (!ratios.length) return null
    return Math.max(...ratios)
  }, [imageSizes])

  const updateHeight = useCallback(
    (widthOverride?: number) => {
      const fallbackHeight = getFallbackHeight()
      const width = widthOverride ?? canvasRef.current?.clientWidth ?? 0

      if (!width) {
        setCanvasHeight((prev) => (prev ?? fallbackHeight))
        return
      }

      const desiredHeight = aspectRatio ? Math.round(width * aspectRatio) : fallbackHeight
      const nextHeight = Math.max(desiredHeight, MIN_CANVAS_HEIGHT)

      setCanvasHeight((prev) => (prev === nextHeight ? prev : nextHeight))
    },
    [aspectRatio],
  )

  useEffect(() => {
    updateHeight()
    if (!canvasRef.current) return

    const handleResize = () => updateHeight()

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            const entryWidth = entries[0]?.contentRect?.width
            updateHeight(entryWidth)
          })
        : null

    observer?.observe(canvasRef.current)
    window.addEventListener('resize', handleResize)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [updateHeight])

  useEffect(() => {
    if (!canvasHeight) return

    const measureBoard = () => {
      const controlsHeight = controlsRef.current?.offsetHeight ?? 0
      const legendHeight = legendRef.current?.offsetHeight ?? 0
      const extra = BOARD_VERTICAL_PADDING + BOARD_STACK_GAP * 2
      const nextBoardHeight = canvasHeight + controlsHeight + legendHeight + extra
      setBoardHeight(nextBoardHeight)
    }

    measureBoard()
    window.addEventListener('resize', measureBoard)

    return () => window.removeEventListener('resize', measureBoard)
  }, [canvasHeight])

  const handleImageLoad = useCallback(
    (key: 'a' | 'b') =>
      (event: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = event.currentTarget
        if (!naturalWidth || !naturalHeight) return

        setImageSizes((prev) => ({
          ...prev,
          [key]: {
            width: naturalWidth,
            height: naturalHeight,
          },
        }))
      },
    [],
  )

  const percent = Math.round(ratio * 100)

  return (
    <div
      className="compare-board"
      ref={boardRef}
      style={boardHeight ? { minHeight: `${boardHeight}px` } : undefined}
    >
      <div
        className="compare-board__canvas"
        ref={canvasRef}
        style={canvasHeight ? { height: `${canvasHeight}px` } : undefined}
        data-testid="compare-canvas"
      >
        <div className="compare-board__twenty">
          <TwentyTwenty
            left={(
              <img
                className="compare-board__image"
                src={urlA}
                alt={`${imageA.fileName}（A）`}
                onLoad={handleImageLoad('a')}
              />
            )}
            right={(
              <img
                className="compare-board__image"
                src={urlB}
                alt={`${imageB.fileName}（B）`}
                onLoad={handleImageLoad('b')}
              />
            )}
            slider={(
              <div className="compare-board__divider" data-testid="twenty-slider">
                <span className="compare-board__handle" />
              </div>
            )}
            position={ratio}
            onChange={setRatio}
            defaultPosition={0.5}
            minDistanceToBeginInteraction={5}
            maxAngleToBeginInteraction={60}
          />
        </div>
      </div>
      <label className="compare-board__controls" ref={controlsRef}>
        <span className="compare-board__slider-label">拖动图中滑块或使用滑杆微调</span>
        <input
          aria-label="对比滑杆"
          className="compare-board__slider"
          type="range"
          min={0}
          max={100}
          value={percent}
          onChange={(event) => setRatio(Number(event.target.value) / 100)}
        />
        <span className="compare-board__percent">{percent}%</span>
      </label>
      <div className="compare-board__legend" ref={legendRef}>
        <div className="compare-label compare-label--a">
          <span className="compare-label__flag">A</span>
          <div className="compare-label__text">
            <p className="compare-label__title">{imageA.fileName}</p>
            <p className="compare-label__hint">左侧区域，随滑杆移动</p>
          </div>
        </div>
        <div className="compare-label compare-label--b">
          <span className="compare-label__flag">B</span>
          <div className="compare-label__text">
            <p className="compare-label__title">{imageB.fileName}</p>
            <p className="compare-label__hint">右侧区域，随滑杆移动</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompareView() {
  const { state } = useAppState()

  const activeGroup = useMemo(
    () => state.groups.find((group) => group.id === state.lastActiveGroupId) ?? null,
    [state.groups, state.lastActiveGroupId],
  )

  const comparison = useMemo(
    () => state.comparisons.find((item) => item.groupId === activeGroup?.id) ?? null,
    [state.comparisons, activeGroup?.id],
  )

  const groupImages = useMemo(
    () => state.images.filter((image) => image.groupId === activeGroup?.id),
    [state.images, activeGroup?.id],
  )

  const imageA = useMemo(
    () => groupImages.find((image) => image.id === comparison?.imageAId) ?? null,
    [groupImages, comparison?.imageAId],
  )

  const imageB = useMemo(
    () => groupImages.find((image) => image.id === comparison?.imageBId) ?? null,
    [groupImages, comparison?.imageBId],
  )

  const sourceA = useImageSource(imageA)
  const sourceB = useImageSource(imageB)

  const loading = (imageA ? sourceA.loading : false) || (imageB ? sourceB.loading : false)
  const hasError = (imageA ? sourceA.error : false) || (imageB ? sourceB.error : false)
  const ready = imageA && imageB && sourceA.url && sourceB.url && !loading && !hasError

  const placeholder = (text: string) => <div className="panel__placeholder">{text}</div>

  let content: JSX.Element | null = null

  if (!activeGroup) {
    content = placeholder('暂无可用组，请先创建或选择一个组。')
  } else if (!imageA || !imageB) {
    content = placeholder('请在当前组的图片列表中分别设为 A 和 B 后开始对比。')
  } else if (loading) {
    content = placeholder('正在读取 A/B 图片，请稍候...')
  } else if (hasError) {
    content = placeholder('无法读取所选图片（文件不可访问），可能是权限被撤销或文件已移动，请重新选择或移除后再试。')
  } else if (ready && imageA && imageB && sourceA.url && sourceB.url) {
    content = <CompareBoard imageA={imageA} imageB={imageB} urlA={sourceA.url} urlB={sourceB.url} />
  } else {
    content = placeholder('图片尚未就绪，请重试或重新选择。')
  }

  return (
    <div className="panel__content">
      <div className="panel__header">
        <div>
          <h2 className="panel__title">对比视图</h2>
          <p className="panel__desc">选择同一组内的 A / B 图片后，在此处查看滑杆重叠效果。</p>
        </div>
        {activeGroup && (
          <p className="panel__meta">
            当前组：{activeGroup.name}
          </p>
        )}
      </div>
      {content}
    </div>
  )
}

export default CompareView
