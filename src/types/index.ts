export type GroupId = string
export type ImageId = string

export interface ImageEntry {
  id: ImageId
  groupId: GroupId
  fileName: string
  handleKey: string
  addedAt: string
}

export interface Group {
  id: GroupId
  name: string
  createdAt: string
  order: number
}

export interface GroupComparisonState {
  groupId: GroupId
  imageAId: ImageId | null
  imageBId: ImageId | null
}

export interface PersistedState {
  groups: Group[]
  images: ImageEntry[]
  comparisons: GroupComparisonState[]
  lastActiveGroupId: GroupId | null
}
