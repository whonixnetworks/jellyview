import { Link } from 'react-router-dom'
import { Star, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LibraryItem, formatRuntime, getRatingColor, getEpisodeLabel } from '@/api/libraries'
import { cn } from '@/lib/utils'

interface MediaCardProps {
  item: LibraryItem
  className?: string
}

export default function MediaCard({ item, className }: MediaCardProps) {
  const episodeLabel = getEpisodeLabel(item)

  return (
    <Link to={`/items/${item.id}`}>
      <Card className={cn('h-full overflow-hidden group hover:shadow-lg transition-shadow cursor-pointer', className)}>
        <div className="aspect-[2/3] bg-muted relative overflow-hidden">
          {item.poster_url ? (
            <img
              src={item.poster_url}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              📽️
            </div>
          )}
          {item.rating && (
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className={cn('text-xs font-semibold', getRatingColor(item.rating).replace('text-', 'text-white/90'))}>
                {item.rating.toFixed(1)}
              </span>
            </div>
          )}
          {item.official_rating && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-xs">
              {item.official_rating}
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          <h4 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
            {item.name}
          </h4>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.year}</span>
            {item.runtime_ticks && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRuntime(item.runtime_ticks)}
              </span>
            )}
          </div>
          {episodeLabel && (
            <div className="mt-1 text-xs text-muted-foreground">
              {item.series_name && <span className="block truncate">{item.series_name}</span>}
              <span className="font-medium">{episodeLabel}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
