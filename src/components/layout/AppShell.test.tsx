import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import AppShell from './AppShell'

const setup = () =>
  render(
    <AppShell
      headerTitle="测试布局"
      sidebar={<div data-testid="sidebar-content">sidebar</div>}
      gallery={<div data-testid="gallery-content">gallery</div>}
      compare={<div data-testid="compare-content">compare</div>}
    />,
  )

afterEach(() => {
  cleanup()
})

describe('AppShell 折叠与拖拽布局', () => {
  it('折叠组列表时隐藏内容并出现展开按钮', () => {
    setup()
    const body = screen.getByTestId('app-shell-body')

    fireEvent.click(screen.getByTestId('collapse-sidebar'))

    expect(getComputedStyle(body).getPropertyValue('--sidebar-column').trim()).toBe('0px')
    expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('collapse-sidebar')).toBeInTheDocument()
  })

  it('折叠图片列表时隐藏内容并支持再次展开', () => {
    setup()
    const body = screen.getByTestId('app-shell-body')

    fireEvent.click(screen.getByTestId('collapse-gallery'))

    expect(screen.queryByTestId('gallery-content')).not.toBeInTheDocument()
    expect(getComputedStyle(body).getPropertyValue('--gallery-column').trim()).toBe('0px')

    fireEvent.click(screen.getByTestId('collapse-gallery'))

    expect(screen.getByTestId('gallery-content')).toBeInTheDocument()
    expect(getComputedStyle(body).getPropertyValue('--gallery-column').trim()).not.toBe('0px')
  })
})
