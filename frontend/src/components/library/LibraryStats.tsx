import { Film, Play, Clock, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { LibraryDetail } from '@/api/libraries'
import { cn } from '@/lib/utils'

interface LibraryStatsProps {
  stats: LibraryDetail
}

export default function LibraryStats({ stats }: LibraryStatsProps) {
  const watchTimeHours = Math.round(stats.total_watch_time / 3600)
  const watchTimeDisplay = watchTimeHours >= 24
    ? `${(watchTimeHours / 24).toFixed(1)} days`
    : `${watchTimeHours} hours`

  const statItems = [
    {
      label: 'Total Items',
      value: stats.total_items.toLocaleString(),
      icon: Film,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Total Plays',
      value: stats.total_plays.toLocaleString(),
      icon: Play,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Watch Time',
      value: watchTimeDisplay,
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Newest Item',
      value: stats.newest_item_date
        ? new Date(stats.newest_item_date).toLocaleDateString()
        : 'N/A',
      icon: Calendar,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('w-5 h-5', stat.color)} />
                </div>
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
