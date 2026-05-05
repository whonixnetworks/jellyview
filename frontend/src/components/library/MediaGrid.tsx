import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MediaGridProps {
  children: ReactNode
  className?: string
}

export default function MediaGrid({ children, className }: MediaGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
        className
      )}
    >
      {children}
    </div>
  )
}
