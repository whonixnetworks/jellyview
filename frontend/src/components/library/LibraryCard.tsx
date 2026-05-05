import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Library, getLibraryIcon, getLibraryTypeLabel, formatLibrarySize } from '@/api/libraries'

interface LibraryCardProps {
  library: Library & { total_plays?: number }
}

export default function LibraryCard({ library }: LibraryCardProps) {
  return (
    <Link to={`/libraries/${library.id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="text-4xl">{getLibraryIcon(library.item_type)}</div>
            <Badge variant="secondary" className="shrink-0">
              {getLibraryTypeLabel(library.item_type)}
            </Badge>
          </div>
          <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
            {library.name}
          </h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">{library.total_items}</span>
              <span>item{library.total_items !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              <span>{library.total_plays ?? 0} plays</span>
            </div>
            <div className="text-xs">
              {formatLibrarySize(library.total_size)}
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-6 pb-6 pt-0 text-xs text-muted-foreground">
          Updated {new Date(library.updated_at).toLocaleDateString()}
        </CardFooter>
      </Card>
    </Link>
  )
}
