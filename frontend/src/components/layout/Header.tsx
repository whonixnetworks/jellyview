import { Activity, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title?: string
  connectionStatus?: 'connected' | 'disconnected' | 'connecting'
  className?: string
}

export default function Header({
  title = 'Jellyview',
  connectionStatus = 'connected',
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        'h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800',
        'flex items-center justify-between px-6',
        className
      )}
    >
      {/* Logo and title - shown on mobile when sidebar is closed */}
      <div className="flex items-center space-x-3">
        <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>

      {/* Right side content */}
      <div className="flex items-center space-x-4">
        {/* Connection status */}
        <div
          className={cn(
            'flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium',
            connectionStatus === 'connected'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : connectionStatus === 'disconnected'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          )}
        >
          {connectionStatus === 'connected' ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Connected</span>
            </>
          ) : connectionStatus === 'disconnected' ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Disconnected</span>
            </>
          ) : (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
            </>
          )}
        </div>

        {/* User info placeholder */}
        <div className="hidden sm:flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              U
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Admin
          </span>
        </div>
      </div>
    </header>
  )
}
