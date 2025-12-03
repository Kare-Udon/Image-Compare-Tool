import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type { PersistedState } from '../../types'
import { loadPersistedState, savePersistedState } from '../../lib/storage'
import { appReducer, createDefaultState, ensureStateConsistency } from './appState'
import type { AppAction } from './appState'

type AppStateContextValue = {
  state: PersistedState
  dispatch: Dispatch<AppAction>
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

type AppStateProviderProps = {
  children: ReactNode
}

function initializeState(): PersistedState {
  const persisted = loadPersistedState()
  if (persisted) {
    return ensureStateConsistency(persisted)
  }
  return createDefaultState()
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, undefined, initializeState)

  useEffect(() => {
    savePersistedState(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState 必须在 AppStateProvider 内使用')
  }
  return context
}
