import { describe, expect, it } from 'vitest'
import { appReducer, createDefaultState, ensureStateConsistency } from './appState'
import type { PersistedState } from '../../types'

describe('appState helpers', () => {
  it('创建默认状态时包含初始组与比较项', () => {
    const frozenNow = new Date('2024-01-01T00:00:00.000Z')
    const state = createDefaultState(frozenNow)

    expect(state.groups).toHaveLength(1)
    expect(state.comparisons).toHaveLength(1)
    expect(state.lastActiveGroupId).toEqual(state.groups[0].id)
    expect(state.groups[0].createdAt).toEqual(frozenNow.toISOString())
  })

  it('保证比较状态与激活组有效', () => {
    const state: PersistedState = {
      groups: [
        { id: 'g1', name: '组 1', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
        { id: 'g2', name: '组 2', createdAt: '2024-01-02T00:00:00.000Z', order: 1 },
      ],
      images: [],
      comparisons: [],
      lastActiveGroupId: 'not-exist',
    }

    const normalized = ensureStateConsistency(state)
    expect(normalized.comparisons).toHaveLength(2)
    expect(normalized.lastActiveGroupId).toBe('g1')
  })

  it('当持久化数据为空组时回退到默认状态', () => {
    const state: PersistedState = {
      groups: [],
      images: [],
      comparisons: [],
      lastActiveGroupId: null,
    }

    const normalized = ensureStateConsistency(state)
    expect(normalized.groups).toHaveLength(1)
    expect(normalized.comparisons).toHaveLength(1)
  })

  it('reducer 可以更新激活组', () => {
    const state = createDefaultState()
    const next = appReducer(state, { type: 'setActiveGroup', payload: null })

    expect(next.lastActiveGroupId).toEqual(state.groups[0].id)
  })

  it('可以创建新组并自动激活与补齐比较项', () => {
    const state = createDefaultState(new Date('2024-01-01T00:00:00.000Z'))
    const next = appReducer(state, {
      type: 'createGroup',
      payload: { name: '新组', now: new Date('2024-02-01T00:00:00.000Z') },
    })

    expect(next.groups).toHaveLength(2)
    const created = next.groups.find((group) => group.name === '新组')
    expect(created).toBeDefined()
    expect(created?.order).toBe(1)
    expect(next.lastActiveGroupId).toBe(created?.id)

    const comparison = next.comparisons.find((item) => item.groupId === created?.id)
    expect(comparison).toBeDefined()
    expect(comparison?.imageAId).toBeNull()
    expect(comparison?.imageBId).toBeNull()
  })

  it('可以重命名组且忽略空名称', () => {
    const state = createDefaultState()
    const groupId = state.groups[0].id

    const renamed = appReducer(state, {
      type: 'renameGroup',
      payload: { id: groupId, name: '新名字' },
    })
    expect(renamed.groups[0].name).toBe('新名字')

    const unchanged = appReducer(renamed, {
      type: 'renameGroup',
      payload: { id: groupId, name: '   ' },
    })
    expect(unchanged.groups[0].name).toBe('新名字')
  })

  it('删除组时清理关联的图片与比较状态，并重新选择激活组', () => {
    const state: PersistedState = {
      groups: [
        { id: 'g1', name: '组 1', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
        { id: 'g2', name: '组 2', createdAt: '2024-01-02T00:00:00.000Z', order: 1 },
      ],
      images: [
        {
          id: 'img-1',
          groupId: 'g1',
          fileName: 'a.png',
          handleKey: 'h1',
          addedAt: '2024-01-03T00:00:00.000Z',
        },
        {
          id: 'img-2',
          groupId: 'g2',
          fileName: 'b.png',
          handleKey: 'h2',
          addedAt: '2024-01-04T00:00:00.000Z',
        },
      ],
      comparisons: [
        { groupId: 'g1', imageAId: null, imageBId: null },
        { groupId: 'g2', imageAId: 'img-2', imageBId: null },
      ],
      lastActiveGroupId: 'g2',
    }

    const next = appReducer(state, { type: 'deleteGroup', payload: { id: 'g2' } })
    expect(next.groups.find((group) => group.id === 'g2')).toBeUndefined()
    expect(next.images.some((image) => image.groupId === 'g2')).toBe(false)
    expect(next.comparisons.some((comparison) => comparison.groupId === 'g2')).toBe(false)
    expect(next.lastActiveGroupId).toBe('g1')
  })

  it('当删除最后一个组时回退创建新的默认组', () => {
    const state = createDefaultState()
    const groupId = state.groups[0].id

    const next = appReducer(state, { type: 'deleteGroup', payload: { id: groupId } })
    expect(next.groups).toHaveLength(1)
    expect(next.lastActiveGroupId).toBe(next.groups[0].id)
  })

  it('可以向组内添加图片并忽略重复或跨组数据', () => {
    const state = createDefaultState()
    const groupId = state.groups[0].id

    const next = appReducer(state, {
      type: 'addImages',
      payload: {
        groupId,
        images: [
          {
            id: 'image-1',
            groupId,
            fileName: 'a.png',
            handleKey: 'handle-1',
            addedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'image-1',
            groupId,
            fileName: 'a.png',
            handleKey: 'handle-1',
            addedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'image-2',
            groupId: 'other-group',
            fileName: 'b.png',
            handleKey: 'handle-2',
            addedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
      },
    })

    expect(next.images).toHaveLength(1)
    expect(next.images[0].id).toBe('image-1')
  })

  it('删除图片时清空比较状态中的对应引用', () => {
    const state: PersistedState = {
      groups: [
        { id: 'g1', name: '组 1', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
      ],
      images: [
        {
          id: 'img-1',
          groupId: 'g1',
          fileName: 'a.png',
          handleKey: 'h1',
          addedAt: '2024-01-03T00:00:00.000Z',
        },
      ],
      comparisons: [{ groupId: 'g1', imageAId: 'img-1', imageBId: 'img-1' }],
      lastActiveGroupId: 'g1',
    }

    const next = appReducer(state, { type: 'removeImage', payload: { imageId: 'img-1' } })
    expect(next.images).toHaveLength(0)
    expect(next.comparisons[0].imageAId).toBeNull()
    expect(next.comparisons[0].imageBId).toBeNull()
  })

  it('设置 A/B 图片时只接受同组且存在的图片', () => {
    const state: PersistedState = {
      groups: [
        { id: 'g1', name: '组 1', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
        { id: 'g2', name: '组 2', createdAt: '2024-01-02T00:00:00.000Z', order: 1 },
      ],
      images: [
        {
          id: 'img-1',
          groupId: 'g1',
          fileName: 'a.png',
          handleKey: 'h1',
          addedAt: '2024-01-03T00:00:00.000Z',
        },
      ],
      comparisons: [
        { groupId: 'g1', imageAId: null, imageBId: null },
        { groupId: 'g2', imageAId: null, imageBId: null },
      ],
      lastActiveGroupId: 'g1',
    }

    const valid = appReducer(state, {
      type: 'setImageA',
      payload: { groupId: 'g1', imageId: 'img-1' },
    })
    expect(valid.comparisons[0].imageAId).toBe('img-1')

    const invalid = appReducer(valid, {
      type: 'setImageB',
      payload: { groupId: 'g2', imageId: 'img-1' },
    })
    expect(invalid.comparisons[1].imageBId).toBeNull()

    const cleared = appReducer(valid, {
      type: 'setImageA',
      payload: { groupId: 'g1', imageId: null },
    })
    expect(cleared.comparisons[0].imageAId).toBeNull()
  })

  it('状态校验会清理指向不存在图片的比较引用', () => {
    const state: PersistedState = {
      groups: [
        { id: 'g1', name: '组 1', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
      ],
      images: [],
      comparisons: [{ groupId: 'g1', imageAId: 'missing', imageBId: null }],
      lastActiveGroupId: 'g1',
    }

    const normalized = ensureStateConsistency(state)
    expect(normalized.comparisons[0].imageAId).toBeNull()
  })

  it('状态校验会移除失效组的图片并回退激活组', () => {
    const state: PersistedState = {
      groups: [
        { id: 'g1', name: '组 1', createdAt: '2024-01-01T00:00:00.000Z', order: 0 },
      ],
      images: [
        {
          id: 'img-1',
          groupId: 'g1',
          fileName: 'a.png',
          handleKey: 'h1',
          addedAt: '2024-01-03T00:00:00.000Z',
        },
        {
          id: 'img-orphan',
          groupId: 'missing',
          fileName: 'orphan.png',
          handleKey: 'h-missing',
          addedAt: '2024-01-04T00:00:00.000Z',
        },
      ],
      comparisons: [
        { groupId: 'g1', imageAId: 'img-orphan', imageBId: 'img-1' },
        { groupId: 'missing', imageAId: 'img-orphan', imageBId: null },
      ],
      lastActiveGroupId: 'missing',
    }

    const normalized = ensureStateConsistency(state)
    expect(normalized.images.map((image) => image.id)).toEqual(['img-1'])
    expect(normalized.comparisons).toHaveLength(1)
    expect(normalized.comparisons[0].imageAId).toBeNull()
    expect(normalized.comparisons[0].imageBId).toBe('img-1')
    expect(normalized.lastActiveGroupId).toBe('g1')
  })
})
