import { useMemo, useState } from 'react'
import type { Group } from '../../types'
import { useAppState } from '../appState/AppStateProvider'

function GroupSidebar() {
  const { state, dispatch } = useAppState()
  const [groupName, setGroupName] = useState('')

  const sortedGroups = useMemo(
    () =>
      [...state.groups].sort(
        (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt),
      ),
    [state.groups],
  )

  const imageCountMap = useMemo(() => {
    const map = new Map<string, number>()
    state.images.forEach((image) => {
      map.set(image.groupId, (map.get(image.groupId) ?? 0) + 1)
    })
    return map
  }, [state.images])

  const activeGroupName = useMemo(() => {
    const active = state.groups.find((group) => group.id === state.lastActiveGroupId)
    return active?.name ?? '未选择'
  }, [state.groups, state.lastActiveGroupId])

  const handleCreate = () => {
    dispatch({ type: 'createGroup', payload: { name: groupName } })
    setGroupName('')
  }

  const handleRename = (group: Group) => {
    const nextName = window.prompt('请输入新的组名', group.name)
    if (!nextName) return
    dispatch({ type: 'renameGroup', payload: { id: group.id, name: nextName } })
  }

  const handleDelete = (group: Group) => {
    const confirmed = window.confirm(`确认删除组「${group.name}」及其图片记录吗？`)
    if (!confirmed) return
    dispatch({ type: 'deleteGroup', payload: { id: group.id } })
  }

  const handleSelect = (groupId: string) => {
    dispatch({ type: 'setActiveGroup', payload: groupId })
  }

  return (
    <div className="panel__content">
      <div className="group-sidebar__header">
        <div>
          <h2 className="panel__title">组列表</h2>
          <p className="panel__desc">创建、切换、重命名或删除组，管理图片分组。</p>
          <p className="panel__meta">当前组：{activeGroupName}</p>
        </div>
        <div className="group-sidebar__form">
          <input
            className="group-sidebar__input"
            placeholder="输入组名"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
          <button className="group-sidebar__button" onClick={handleCreate}>
            新建组
          </button>
        </div>
      </div>

      <ul className="group-list">
        {sortedGroups.map((group) => {
          const isActive = group.id === state.lastActiveGroupId
          const imageCount = imageCountMap.get(group.id) ?? 0
          return (
            <li
              key={group.id}
              className={`group-list__item ${isActive ? 'group-list__item--active' : ''}`}
            >
              <button className="group-list__main" onClick={() => handleSelect(group.id)}>
                <div>
                  <p className="group-list__name">{group.name}</p>
                  <p className="group-list__meta">
                    {imageCount} 张图片 · 创建于 {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
              <div className="group-list__actions">
                <button onClick={() => handleRename(group)}>重命名</button>
                <button className="danger" onClick={() => handleDelete(group)}>
                  删除
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {sortedGroups.length === 0 && (
        <div className="panel__placeholder">暂无组，请创建第一个组开始导入图片。</div>
      )}
    </div>
  )
}

export default GroupSidebar
