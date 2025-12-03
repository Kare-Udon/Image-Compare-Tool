import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'

type AppShellProps = {
  sidebar: ReactNode
  gallery: ReactNode
  compare: ReactNode
  headerTitle?: string
}

type DragTarget = 'sidebar' | 'gallery'

const SIDEBAR_MIN_WIDTH = 240
const GALLERY_MIN_WIDTH = 280
const COMPARE_MIN_WIDTH = 360
const GRID_GAP = 12
const HANDLE_WIDTH = 10

type CollapseIconProps = {
  collapsed: boolean
}

function CollapseIcon({ collapsed }: CollapseIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
    >
      {collapsed ? (
        <>
          <path
            d="M12 5v14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M5 12h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

function AppShell({ sidebar, gallery, compare, headerTitle }: AppShellProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [galleryWidth, setGalleryWidth] = useState(380)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [galleryCollapsed, setGalleryCollapsed] = useState(false)

  const sidebarHandleWidth = sidebarCollapsed ? 0 : HANDLE_WIDTH
  const galleryHandleWidth = galleryCollapsed ? 0 : HANDLE_WIDTH

  const layoutStyle = useMemo(
    () =>
      ({
        '--sidebar-column': sidebarCollapsed ? '0px' : `${sidebarWidth}px`,
        '--sidebar-handle': `${sidebarHandleWidth}px`,
        '--gallery-column': galleryCollapsed ? '0px' : `${galleryWidth}px`,
        '--gallery-handle': `${galleryHandleWidth}px`,
      }) as CSSProperties,
    [galleryCollapsed, galleryHandleWidth, galleryWidth, sidebarCollapsed, sidebarHandleWidth, sidebarWidth],
  )

  const clampWidth = (
    value: number,
    min: number,
    containerWidth: number,
    occupied: number,
  ) => {
    const max = Math.max(min, containerWidth - occupied)
    return Math.min(Math.max(value, min), max)
  }

  const startResize = (target: DragTarget, event: React.PointerEvent<HTMLDivElement>) => {
    if (target === 'sidebar' && sidebarCollapsed) return
    if (target === 'gallery' && galleryCollapsed) return
    if (!bodyRef.current) return

    event.preventDefault()
    const containerWidth = bodyRef.current.getBoundingClientRect().width
    const startX = event.clientX
    const startSidebarWidth = sidebarWidth
    const startGalleryWidth = galleryWidth

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX
      const gapSpace = GRID_GAP * 4
      const handleSpace = sidebarHandleWidth + galleryHandleWidth
      if (target === 'sidebar') {
        const occupied =
          gapSpace + handleSpace + (galleryCollapsed ? 0 : startGalleryWidth) + COMPARE_MIN_WIDTH
        const next = clampWidth(startSidebarWidth + delta, SIDEBAR_MIN_WIDTH, containerWidth, occupied)
        setSidebarWidth(next)
      } else {
        const occupied =
          gapSpace + handleSpace + (sidebarCollapsed ? 0 : startSidebarWidth) + COMPARE_MIN_WIDTH
        const next = clampWidth(startGalleryWidth + delta, GALLERY_MIN_WIDTH, containerWidth, occupied)
        setGalleryWidth(next)
      }
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev)
  const toggleGallery = () => setGalleryCollapsed((prev) => !prev)

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div>
          <p className="app-shell__eyebrow">Local-only image compare</p>
          <h1 className="app-shell__title">{headerTitle ?? 'Photo Compare'}</h1>
        </div>
      </header>
      <main
        className="app-shell__body"
        ref={bodyRef}
        style={layoutStyle}
        data-sidebar-collapsed={sidebarCollapsed}
        data-gallery-collapsed={galleryCollapsed}
        data-testid="app-shell-body"
      >
        <aside className={`panel panel--sidebar ${sidebarCollapsed ? 'panel--collapsed' : ''}`}>
          <button
            type="button"
            className="panel__collapse-toggle panel__collapse-toggle--sidebar"
            onClick={toggleSidebar}
            data-testid="collapse-sidebar"
            aria-label={sidebarCollapsed ? '展开组列表' : '折叠组列表'}
            title={sidebarCollapsed ? '展开组列表' : '折叠组列表'}
          >
            <CollapseIcon collapsed={sidebarCollapsed} />
          </button>
          {!sidebarCollapsed && sidebar}
        </aside>

        <div
          className={`resize-handle ${sidebarCollapsed ? 'resize-handle--hidden' : ''}`}
          role="separator"
          aria-label="调整组列表宽度"
          onPointerDown={(event) => startResize('sidebar', event)}
        />

        <section className={`panel panel--gallery ${galleryCollapsed ? 'panel--collapsed' : ''}`}>
          <button
            type="button"
            className="panel__collapse-toggle panel__collapse-toggle--gallery"
            onClick={toggleGallery}
            data-testid="collapse-gallery"
            aria-label={galleryCollapsed ? '展开图片列表' : '折叠图片列表'}
            title={galleryCollapsed ? '展开图片列表' : '折叠图片列表'}
          >
            <CollapseIcon collapsed={galleryCollapsed} />
          </button>
          {!galleryCollapsed && gallery}
        </section>

        <div
          className={`resize-handle ${galleryCollapsed ? 'resize-handle--hidden' : ''}`}
          role="separator"
          aria-label="调整图片列表宽度"
          onPointerDown={(event) => startResize('gallery', event)}
        />

        <section className="panel panel--compare">
          {compare}
        </section>
      </main>
    </div>
  )
}

export default AppShell
