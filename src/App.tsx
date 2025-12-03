import AppShell from './components/layout/AppShell'
import CompareView from './features/compare/CompareView'
import GroupSidebar from './features/groups/GroupSidebar'
import ImageList from './features/images/ImageList'
import './App.css'

function App() {
  return (
    <AppShell
      headerTitle="本地照片对比工具"
      sidebar={<GroupSidebar />}
      gallery={<ImageList />}
      compare={<CompareView />}
    />
  )
}

export default App
