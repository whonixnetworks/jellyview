import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { listLibraries } from '@/api/libraries'
import { Library } from '@/api/libraries'
import LibraryCard from '@/components/library/LibraryCard'
import MediaGrid from '@/components/library/MediaGrid'
import { Button } from '@/components/ui/button'

export default function Libraries() {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadLibraries() {
      try {
        setLoading(true)
        const data = await listLibraries()
        setLibraries(data)
      } catch (err) {
        setError('Failed to load libraries')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadLibraries()
  }, [])

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Libraries</h1>
        <p className="text-muted-foreground">
          Browse your {libraries.length} media librar{libraries.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {libraries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No libraries found</p>
        </div>
      ) : (
        <MediaGrid>
          {libraries.map((library) => (
            <LibraryCard key={library.id} library={library} />
          ))}
        </MediaGrid>
      )}
    </div>
  )
}
