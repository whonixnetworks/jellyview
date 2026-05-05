import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  getLibraryDetail,
  getLibraryRecentlyAdded,
  getLibraryMostPlayed,
  getLibraryItems,
  getLibraryStats,
  LibraryItem,
  LibraryStats as LibraryStatsType,
} from '@/api/libraries'
import LibraryStats from '@/components/library/LibraryStats'
import MediaGrid from '@/components/library/MediaGrid'
import MediaCard from '@/components/library/MediaCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#6366f1'
]

export default function LibraryDetail() {
  const { id } = useParams<{ id: string }>()
  const libraryId = parseInt(id || '0', 10)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getLibraryDetail>> | null>(null)
  const [stats, setStats] = useState<LibraryStatsType | null>(null)
  const [recentlyAdded, setRecentlyAdded] = useState<LibraryItem[]>([])
  const [mostPlayed, setMostPlayed] = useState<any[]>([])
  const [items, setItems] = useState<LibraryItem[]>([])
  const [itemsTotal, setItemsTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(24)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'date_added' | 'rating' | 'year'>('date_added')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('browse')

  // Load library detail, stats, recently added, and most played
  useEffect(() => {
    async function loadLibraryData() {
      if (!libraryId) return

      try {
        setLoading(true)
        const [detailData, statsData, recentData, playedData] = await Promise.all([
          getLibraryDetail(libraryId),
          getLibraryStats(libraryId),
          getLibraryRecentlyAdded(libraryId, { limit: 12 }),
          getLibraryMostPlayed(libraryId, { limit: 12 }),
        ])
        setDetail(detailData)
        setStats(statsData)
        setRecentlyAdded(recentData)
        setMostPlayed(playedData)
      } catch (err) {
        setError('Failed to load library')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadLibraryData()
  }, [libraryId])

  // Load items for browsing
  useEffect(() => {
    async function loadItems() {
      if (!libraryId || activeTab !== 'browse') return

      try {
        const params: any = {
          page,
          limit: pageSize,
          sort_by: sortBy,
          sort_order: sortOrder,
        }

        if (search) params.search = search
        if (genreFilter !== 'all') params.genre = genreFilter

        const response = await getLibraryItems(libraryId, params)
        setItems(response.items)
        setItemsTotal(response.total)
      } catch (err) {
        console.error('Failed to load items:', err)
      }
    }

    loadItems()
  }, [libraryId, page, pageSize, search, sortBy, sortOrder, genreFilter, activeTab])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, sortBy, sortOrder, genreFilter])

  // Get unique genres from library detail
  const genres = useMemo(() => {
    if (!stats?.plays_by_genre) return []
    return stats.plays_by_genre.map((g) => g.genre)
  }, [stats])

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

  if (!detail) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Library not found
      </div>
    )
  }

  const totalPages = Math.ceil(itemsTotal / pageSize)

  // Prepare genre chart data
  const genreChartData = stats?.plays_by_genre?.slice(0, 10) || []

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{detail.name}</h1>
        <p className="text-muted-foreground">
          {detail.total_items.toLocaleString()} items • {detail.total_plays.toLocaleString()} plays
        </p>
      </div>

      {/* Stats */}
      <LibraryStats stats={detail} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList className="mb-6 grid grid-cols-2 lg:grid-cols-4 w-full h-auto">
          <TabsTrigger value="overview" className="min-h-[44px]">Overview</TabsTrigger>
          <TabsTrigger value="recently-added" className="min-h-[44px]">Recently Added</TabsTrigger>
          <TabsTrigger value="most-played" className="min-h-[44px]">Most Played</TabsTrigger>
          <TabsTrigger value="browse" className="min-h-[44px]">Browse</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
           {/* Genre Distribution */}
           {genreChartData.length > 0 && (
             <Card>
               <CardHeader>
                 <CardTitle>Items by Genre</CardTitle>
               </CardHeader>
               <CardContent>
                 <ResponsiveContainer width="100%" height={250} className="h-[200px] sm:h-[225px] md:h-[250px]">
                   <BarChart data={genreChartData}>
                     <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                     <XAxis
                       dataKey="genre"
                       className="text-xs"
                       tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                       angle={-45}
                       textAnchor="end"
                       height={60}
                     />
                     <YAxis
                       className="text-xs"
                       tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                     />
                     <Tooltip
                       contentStyle={{
                         backgroundColor: 'hsl(var(--card))',
                         border: '1px solid hsl(var(--border))',
                         borderRadius: '8px',
                       }}
                       itemStyle={{ color: 'hsl(var(--foreground))' }}
                     />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {genreChartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </CardContent>
             </Card>
           )}

          {/* Quick Previews */}
          <div className="grid md:grid-cols-2 gap-6">
            {recentlyAdded.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recently Added</CardTitle>
                </CardHeader>
                <CardContent>
                  <MediaGrid>
                    {recentlyAdded.slice(0, 6).map((item) => (
                      <MediaCard key={item.id} item={item} />
                    ))}
                  </MediaGrid>
                </CardContent>
              </Card>
            )}

            {mostPlayed.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Most Played</CardTitle>
                </CardHeader>
                <CardContent>
                  <MediaGrid>
                    {mostPlayed.slice(0, 6).map((item) => (
                      <MediaCard key={item.id} item={item} />
                    ))}
                  </MediaGrid>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Recently Added Tab */}
        <TabsContent value="recently-added">
          {recentlyAdded.length > 0 ? (
            <MediaGrid>
              {recentlyAdded.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </MediaGrid>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No recently added items
            </div>
          )}
        </TabsContent>

        {/* Most Played Tab */}
        <TabsContent value="most-played">
          {mostPlayed.length > 0 ? (
            <MediaGrid>
              {mostPlayed.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </MediaGrid>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No play data available
            </div>
          )}
        </TabsContent>

        {/* Browse Tab */}
        <TabsContent value="browse">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 min-h-[44px]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="w-full sm:w-[140px] min-h-[44px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="date_added">Date Added</SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={genreFilter} onValueChange={setGenreFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] min-h-[44px]">
                      <SelectValue placeholder="Genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {genres.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    title="Toggle sort order"
                  >
                    {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results count */}
          <div className="mb-4 text-sm text-muted-foreground">
            {itemsTotal.toLocaleString()} item{itemsTotal !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
            {genreFilter !== 'all' && ` in genre "${genreFilter}"`}
          </div>

          {/* Items Grid */}
          {items.length > 0 ? (
            <>
              <MediaGrid>
                {items.map((item) => (
                  <MediaCard key={item.id} item={item} />
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
              No items found
              {(search || genreFilter !== 'all') && (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearch('')
                    setGenreFilter('all')
                  }}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
