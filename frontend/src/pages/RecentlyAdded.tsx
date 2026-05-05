import { useEffect, useState, useMemo } from 'react'
import { Loader2, ChevronLeft, ChevronRight, Filter, Calendar, Star, Clock, X, PlayCircle } from 'lucide-react'
import { listLibraries, getLibraryRecentlyAdded, Library, LibraryItem, formatRuntime } from '@/api/libraries'
import MediaGrid from '@/components/library/MediaGrid'
import MediaCard from '@/components/library/MediaCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { listHistory, HistoryRecord, formatDuration } from '@/api/history'

interface EnrichedLibraryItem extends LibraryItem {
  library_name: string
}

type MediaTypeFilter = 'all' | 'movies' | 'tvshows' | 'music' | 'books'
type LibraryFilter = 'all' | string

export default function RecentlyAdded() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [items, setItems] = useState<EnrichedLibraryItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(24)
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all')
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>('all')
  const [selectedItem, setSelectedItem] = useState<EnrichedLibraryItem | null>(null)
  const [itemHistory, setItemHistory] = useState<HistoryRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Load all libraries and their recently added items
  useEffect(() => {
    async function loadRecentlyAdded() {
      try {
        setLoading(true)
        const libs = await listLibraries()
        setLibraries(libs)

        // Fetch recently added items from each library
        const allItems: EnrichedLibraryItem[] = []
        const recentlyAddedPromises = libs.map(lib =>
          getLibraryRecentlyAdded(lib.id, { limit: 100 }).then(items =>
            items.map(item => ({ ...item, library_name: lib.name }))
          )
        )

        const results = await Promise.all(recentlyAddedPromises)
        results.forEach(libraryItems => allItems.push(...libraryItems))

        // Sort by date added (newest first)
        allItems.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())

        setItems(allItems)
      } catch (err) {
        setError('Failed to load recently added items')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadRecentlyAdded()
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [libraryFilter, mediaTypeFilter])

  // Filter and paginate items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Library filter
      if (libraryFilter !== 'all') {
        const library = libraries.find(lib => lib.name === libraryFilter)
        if (library && item.library_id !== library.id) return false
      }

      // Media type filter
      if (mediaTypeFilter !== 'all') {
        const library = libraries.find(lib => lib.id === item.library_id)
        if (library && library.item_type !== mediaTypeFilter) return false
      }

      return true
    })
  }, [items, libraryFilter, mediaTypeFilter, libraries])

  const totalPages = Math.ceil(filteredItems.length / pageSize)
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

  // Load item history for the modal
  useEffect(() => {
    async function loadItemHistory() {
      if (!selectedItem) return

      try {
        setLoadingHistory(true)
        const response = await listHistory({
          item_id: selectedItem.id,
          limit: 10,
          sort_by: 'started_at',
          sort_order: 'desc'
        })
        setItemHistory(response.items || [])
      } catch (err) {
        console.error('Failed to load item history:', err)
      } finally {
        setLoadingHistory(false)
      }
    }

    loadItemHistory()
  }, [selectedItem])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Recently Added</h1>
        <p className="text-muted-foreground">
          {filteredItems.length.toLocaleString()} item{filteredItems.length !== 1 ? 's' : ''}
          {libraryFilter !== 'all' && ` in ${libraryFilter}`}
          {mediaTypeFilter !== 'all' && ` (${mediaTypeFilter})`}
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex flex-wrap gap-2 flex-1">
              <Select value={libraryFilter} onValueChange={(value: LibraryFilter) => setLibraryFilter(value)}>
                <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
                  <SelectValue placeholder="All Libraries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Libraries</SelectItem>
                  {libraries.map((library) => (
                    <SelectItem key={library.id} value={library.name}>
                      {library.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mediaTypeFilter} onValueChange={(value: MediaTypeFilter) => setMediaTypeFilter(value)}>
                <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="movies">Movies</SelectItem>
                  <SelectItem value="tvshows">TV Shows</SelectItem>
                  <SelectItem value="music">Music</SelectItem>
                  <SelectItem value="books">Books</SelectItem>
                </SelectContent>
              </Select>
              {(libraryFilter !== 'all' || mediaTypeFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLibraryFilter('all')
                    setMediaTypeFilter('all')
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Grid */}
      {paginatedItems.length > 0 ? (
        <>
          <MediaGrid>
            {paginatedItems.map((item) => (
              <div key={item.id} onClick={() => setSelectedItem(item)} className="cursor-pointer">
                <MediaCard item={item} />
              </div>
            ))}
          </MediaGrid>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 overflow-x-auto pb-2 sm:pb-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="min-h-[44px] min-w-[44px] touch-target"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="icon"
                      className="w-9 h-9 min-h-[36px] min-w-[36px] touch-target"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="min-h-[44px] min-w-[44px] touch-target"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No recently added items found</p>
          {(libraryFilter !== 'all' || mediaTypeFilter !== 'all') && (
            <Button
              variant="link"
              onClick={() => {
                setLibraryFilter('all')
                setMediaTypeFilter('all')
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Item Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedItem.name}</DialogTitle>
                <DialogDescription className="text-base">
                  {selectedItem.year && <span>{selectedItem.year}</span>}
                  {selectedItem.series_name && selectedItem.year && <span> • </span>}
                  {selectedItem.series_name && <span>{selectedItem.series_name}</span>}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {/* Poster */}
                <div className="md:col-span-1">
                  <div className="aspect-[2/3] bg-muted rounded-lg overflow-hidden">
                    {selectedItem.poster_url ? (
                      <img
                        src={selectedItem.poster_url}
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        📽️
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="md:col-span-2 space-y-4">
                  {/* Rating and Info */}
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedItem.rating && (
                      <div className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-md">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{selectedItem.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {selectedItem.official_rating && (
                      <Badge variant="secondary">{selectedItem.official_rating}</Badge>
                    )}
                    {selectedItem.runtime_ticks && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{formatRuntime(selectedItem.runtime_ticks)}</span>
                      </div>
                    )}
                  </div>

                  {/* Library */}
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Library:</span> {selectedItem.library_name}
                  </div>

                  {/* Added Date */}
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Added:</span>{' '}
                    {new Date(selectedItem.added_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>

                  {/* Genres */}
                  {selectedItem.genres && selectedItem.genres.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Genres</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.genres.map((genre) => (
                          <Badge key={genre} variant="outline">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Studios */}
                  {selectedItem.studios && selectedItem.studios.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Studios</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.studios.map((studio) => (
                          <Badge key={studio} variant="secondary">
                            {studio}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Play History */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5" />
                  Play History
                </h3>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : itemHistory.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {itemHistory.map((record) => (
                      <div key={record.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{record.user.username}</span>
                            <Badge variant="outline" className="text-xs">
                              {record.completion_pct >= 90 ? 'Completed' : 'Partial'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDuration(record.duration)} watched •{' '}
                            {new Date(record.started_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No play history available</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
