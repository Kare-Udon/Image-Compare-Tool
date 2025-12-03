import type {
  Group,
  GroupComparisonState,
  GroupId,
  ImageEntry,
  ImageId,
  PersistedState,
} from '../../types'

export type AppAction =
  | { type: 'hydrate'; payload: PersistedState }
  | { type: 'setActiveGroup'; payload: GroupId | null }
  | { type: 'replaceState'; payload: PersistedState }
  | { type: 'createGroup'; payload: { name?: string; now?: Date } }
  | { type: 'renameGroup'; payload: { id: GroupId; name: string } }
  | { type: 'deleteGroup'; payload: { id: GroupId } }
  | { type: 'addImages'; payload: { groupId: GroupId; images: ImageEntry[] } }
  | { type: 'removeImage'; payload: { imageId: ImageId } }
  | { type: 'setImageA'; payload: { groupId: GroupId; imageId: ImageId | null } }
  | { type: 'setImageB'; payload: { groupId: GroupId; imageId: ImageId | null } }

const DEFAULT_GROUP_NAME = '默认组'
const UNTITLED_GROUP_NAME = '未命名组'

export function generateId(prefix = 'id'): string {
  const fallback = Math.random().toString(36).slice(2, 10)
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${fallback}`

  return `${prefix}-${unique}`
}

export function createDefaultState(now = new Date()): PersistedState {
  const defaultGroup: Group = {
    id: generateId('group'),
    name: DEFAULT_GROUP_NAME,
    createdAt: now.toISOString(),
    order: 0,
  }

  const defaultComparison: GroupComparisonState = {
    groupId: defaultGroup.id,
    imageAId: null,
    imageBId: null,
  }

  return {
    groups: [defaultGroup],
    images: [],
    comparisons: [defaultComparison],
    lastActiveGroupId: defaultGroup.id,
  }
}

export function ensureStateConsistency(state: PersistedState): PersistedState {
  const groups = state.groups ?? []
  if (groups.length === 0) {
    return createDefaultState()
  }

  const validGroupIds = new Set(groups.map((group) => group.id))
  const normalizedImages = (state.images ?? []).filter((image) => validGroupIds.has(image.groupId))

  const normalizedComparisons = ensureComparisonImages(
    ensureComparisons(groups, state.comparisons ?? []),
    normalizedImages,
  )
  const activeGroupId = pickActiveGroupId(state.lastActiveGroupId, groups)

  return {
    ...state,
    groups,
    images: normalizedImages,
    comparisons: normalizedComparisons,
    lastActiveGroupId: activeGroupId,
  }
}

export function appReducer(state: PersistedState, action: AppAction): PersistedState {
  switch (action.type) {
    case 'hydrate':
      return ensureStateConsistency(action.payload)
    case 'replaceState':
      return ensureStateConsistency(action.payload)
    case 'createGroup':
      return createGroup(state, action.payload)
    case 'renameGroup':
      return renameGroup(state, action.payload)
    case 'deleteGroup':
      return deleteGroup(state, action.payload)
    case 'addImages':
      return addImages(state, action.payload)
    case 'removeImage':
      return removeImage(state, action.payload)
    case 'setImageA':
      return setImageSlot(state, action.payload.groupId, 'imageAId', action.payload.imageId)
    case 'setImageB':
      return setImageSlot(state, action.payload.groupId, 'imageBId', action.payload.imageId)
    case 'setActiveGroup': {
      const activeGroupId = pickActiveGroupId(action.payload, state.groups)
      if (activeGroupId === state.lastActiveGroupId) {
        return state
      }
      return { ...state, lastActiveGroupId: activeGroupId }
    }
    default:
      return state
  }
}

function ensureComparisons(
  groups: Group[],
  comparisons: GroupComparisonState[],
): GroupComparisonState[] {
  const existing = new Map<string, GroupComparisonState>()
  comparisons?.forEach((item) => existing.set(item.groupId, item))

  return groups.map((group) => {
    const found = existing.get(group.id)
    return (
      found ?? {
        groupId: group.id,
        imageAId: null,
        imageBId: null,
      }
    )
  })
}

function ensureComparisonImages(
  comparisons: GroupComparisonState[],
  images: ImageEntry[],
): GroupComparisonState[] {
  const imageById = new Map<ImageId, ImageEntry>()
  images.forEach((image) => imageById.set(image.id, image))

  return comparisons.map((item) => {
    const imageA = item.imageAId ? imageById.get(item.imageAId) : null
    const imageB = item.imageBId ? imageById.get(item.imageBId) : null
    const validImageA = imageA && imageA.groupId === item.groupId ? item.imageAId : null
    const validImageB = imageB && imageB.groupId === item.groupId ? item.imageBId : null

    if (validImageA === item.imageAId && validImageB === item.imageBId) {
      return item
    }

    return {
      ...item,
      imageAId: validImageA,
      imageBId: validImageB,
    }
  })
}

function pickActiveGroupId(candidate: GroupId | null, groups: Group[]): GroupId | null {
  if (candidate && groups.some((group) => group.id === candidate)) {
    return candidate
  }
  return groups[0]?.id ?? null
}

function createGroup(
  state: PersistedState,
  payload: { name?: string; now?: Date },
): PersistedState {
  const now = payload.now ?? new Date()
  const trimmedName = (payload.name ?? '').trim()
  const name = trimmedName || UNTITLED_GROUP_NAME
  const nextOrder = Math.max(0, ...state.groups.map((group) => group.order + 1))
  const newGroup: Group = {
    id: generateId('group'),
    name,
    createdAt: now.toISOString(),
    order: nextOrder,
  }

  const nextState: PersistedState = {
    ...state,
    groups: [...state.groups, newGroup],
    comparisons: [
      ...state.comparisons,
      {
        groupId: newGroup.id,
        imageAId: null,
        imageBId: null,
      },
    ],
    lastActiveGroupId: newGroup.id,
  }

  return ensureStateConsistency(nextState)
}

function renameGroup(
  state: PersistedState,
  payload: { id: GroupId; name: string },
): PersistedState {
  const trimmedName = payload.name.trim()
  if (!trimmedName) return state

  let changed = false
  const groups = state.groups.map((group) => {
    if (group.id !== payload.id) return group
    changed = true
    return { ...group, name: trimmedName }
  })

  if (!changed) return state
  return { ...state, groups }
}

function deleteGroup(
  state: PersistedState,
  payload: { id: GroupId },
): PersistedState {
  const remainingGroups = state.groups.filter((group) => group.id !== payload.id)
  if (remainingGroups.length === state.groups.length) return state

  const remainingImages = state.images.filter((image) => image.groupId !== payload.id)
  const remainingComparisons = state.comparisons.filter(
    (comparison) => comparison.groupId !== payload.id,
  )

  const nextActiveGroupId =
    state.lastActiveGroupId === payload.id
      ? pickActiveGroupId(remainingGroups[0]?.id ?? null, remainingGroups)
      : state.lastActiveGroupId

  const nextState: PersistedState = {
    ...state,
    groups: remainingGroups,
    images: remainingImages,
    comparisons: remainingComparisons,
    lastActiveGroupId: nextActiveGroupId,
  }

  return ensureStateConsistency(nextState)
}

function addImages(
  state: PersistedState,
  payload: { groupId: GroupId; images: ImageEntry[] },
): PersistedState {
  const groupExists = state.groups.some((group) => group.id === payload.groupId)
  if (!groupExists || payload.images.length === 0) return state

  const knownIds = new Set(state.images.map((image) => image.id))
  const validImages: ImageEntry[] = []

  payload.images.forEach((image) => {
    const isSameGroup = image.groupId === payload.groupId
    if (!isSameGroup || knownIds.has(image.id)) return

    validImages.push(image)
    knownIds.add(image.id)
  })

  if (validImages.length === 0) return state

  const nextState: PersistedState = {
    ...state,
    images: [...state.images, ...validImages],
  }

  return ensureStateConsistency(nextState)
}

function removeImage(state: PersistedState, payload: { imageId: ImageId }): PersistedState {
  const target = state.images.find((image) => image.id === payload.imageId)
  if (!target) return state

  const images = state.images.filter((image) => image.id !== payload.imageId)
  const comparisons = state.comparisons.map((comparison) => {
    if (comparison.groupId !== target.groupId) return comparison

    const shouldClearA = comparison.imageAId === payload.imageId
    const shouldClearB = comparison.imageBId === payload.imageId

    if (!shouldClearA && !shouldClearB) return comparison

    return {
      ...comparison,
      imageAId: shouldClearA ? null : comparison.imageAId,
      imageBId: shouldClearB ? null : comparison.imageBId,
    }
  })

  return ensureStateConsistency({ ...state, images, comparisons })
}

type ComparisonSlot = 'imageAId' | 'imageBId'

function setImageSlot(
  state: PersistedState,
  groupId: GroupId,
  slot: ComparisonSlot,
  imageId: ImageId | null,
): PersistedState {
  const comparisonIndex = state.comparisons.findIndex((item) => item.groupId === groupId)
  if (comparisonIndex === -1) return state

  if (imageId) {
    const image = state.images.find((img) => img.id === imageId)
    if (!image || image.groupId !== groupId) return state
  }

  const comparisons = state.comparisons.map((item, index) => {
    if (index !== comparisonIndex) return item

    if (item[slot] === imageId) return item

    return {
      ...item,
      [slot]: imageId,
    }
  })

  return { ...state, comparisons }
}
