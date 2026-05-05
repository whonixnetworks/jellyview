import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import PageWrapper from './components/layout/PageWrapper'
import Dashboard from './pages/Dashboard'
import LiveSessions from './pages/LiveSessions'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import Libraries from './pages/Libraries'
import LibraryDetail from './pages/LibraryDetail'
import History from './pages/History'
import RecentlyAdded from './pages/RecentlyAdded'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import BackupRestore from './pages/BackupRestore'

function App() {
  // Initialize theme on app load
  useTheme()

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <PageWrapper title="Dashboard">
            <Dashboard />
          </PageWrapper>
        } />
        <Route path="/sessions" element={
          <PageWrapper title="Live Sessions">
            <LiveSessions />
          </PageWrapper>
        } />
        <Route path="/users" element={
          <PageWrapper title="Users">
            <Users />
          </PageWrapper>
        } />
        <Route path="/users/:id" element={
          <PageWrapper title="User Details">
            <UserDetail />
          </PageWrapper>
        } />
        <Route path="/libraries" element={
          <PageWrapper title="Libraries">
            <Libraries />
          </PageWrapper>
        } />
        <Route path="/libraries/:id" element={
          <PageWrapper title="Library Details">
            <LibraryDetail />
          </PageWrapper>
        } />
        <Route path="/history" element={
          <PageWrapper title="History">
            <History />
          </PageWrapper>
        } />
        <Route path="/recently-added" element={
          <PageWrapper title="Recently Added">
            <RecentlyAdded />
          </PageWrapper>
        } />
        <Route path="/notifications" element={
          <PageWrapper title="Notifications">
            <Notifications />
          </PageWrapper>
        } />
        <Route path="/settings" element={
          <PageWrapper title="Settings">
            <Settings />
          </PageWrapper>
        } />
        <Route path="/backup-restore" element={
          <PageWrapper title="Backup / Restore">
            <BackupRestore />
          </PageWrapper>
        } />
        <Route path="/404" element={
          <PageWrapper title="Page Not Found">
            <div className="flex flex-col items-center justify-center py-20">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">Page not found</p>
            </div>
          </PageWrapper>
        } />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Router>
  )
}

export default App
