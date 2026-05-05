import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Activity,
  Users,
  Library,
  History,
  PlusCircle,
  Bell,
  Settings,
  Database,
  X,
  ChevronLeft
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Live Sessions', href: '/sessions', icon: Activity },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Libraries', href: '/libraries', icon: Library },
  { name: 'History', href: '/history', icon: History },
  { name: 'Recently Added', href: '/recently-added', icon: PlusCircle },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Backup/Restore', href: '/backup-restore', icon: Database },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  isMobileOpen: boolean
  onMobileToggle: () => void
}

export default function Sidebar({
  isCollapsed,
  onToggle,
  isMobileOpen,
  onMobileToggle,
}: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out',
          'w-64',
          isCollapsed && 'lg:w-20',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo/Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Jellyview
              </span>
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center justify-center w-full">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          )}
          <div className="lg:hidden">
            <button
              onClick={onMobileToggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Toggle button (desktop only) */}
        <div className="hidden lg:flex justify-end p-2">
          <button
            onClick={onToggle}
            className={cn(
              'p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
              'absolute left-1/2 -translate-x-1/2',
              isCollapsed && 'rotate-180'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href ||
                            (item.href !== '/' && location.pathname.startsWith(item.href))

            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={onMobileToggle}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  'hover:bg-gray-100 dark:hover:bg-gray-800',
                  'group relative',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0',
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                  )}
                />
                {!isCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-14 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800">
          {!isCollapsed && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Jellyview v1.0.0
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
