import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageWrapperProps {
  children: React.ReactNode
  title?: string
  connectionStatus?: 'connected' | 'disconnected' | 'connecting'
  className?: string
}

export default function PageWrapper({
  children,
  title = 'Jellyview',
  connectionStatus = 'connected',
  className,
}: PageWrapperProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Close mobile sidebar when switching to desktop view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={mobileSidebarOpen}
        onMobileToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          'lg:ml-64',
          sidebarCollapsed && 'lg:ml-20'
        )}
      >
        {/* Top Header */}
        <Header
          title={title}
          connectionStatus={connectionStatus}
          className="sticky top-0 z-30"
        />

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 left-6 z-50 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Main content area */}
        <main
          className={cn(
            'min-h-[calc(100vh-4rem)]',
            'p-4 sm:p-6 lg:p-8',
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
