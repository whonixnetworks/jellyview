import { useState, useEffect, useRef } from 'react'
import { Copy, Download, Search, ChevronDown, ChevronRight, Filter, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type LogLevel = 'ALL' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  details?: string
  source?: string
}

interface LogViewerProps {
  logs: LogEntry[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onClear?: () => void
  className?: string
  maxHeight?: string
}

const LOG_LEVEL_COLORS: Record<LogLevel, {
  text: string;
  bg: string;
  border: string;
  badge: string;
}> = {
  ALL: {
    text: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-300 dark:border-gray-700',
    badge: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  },
  DEBUG: {
    text: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-300 dark:border-gray-700',
    badge: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  },
  INFO: {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  },
  WARN: {
    text: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  },
  ERROR: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  },
}

export function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return then.toLocaleDateString()
}

export default function LogViewer({
  logs,
  isLoading = false,
  error = null,
  onRetry,
  onClear,
  className,
  maxHeight = '400px',
}: LogViewerProps) {
  const [logLevel, setLogLevel] = useState<LogLevel>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const filteredLogs = logs.filter((log) => {
    if (logLevel !== 'ALL' && log.level !== logLevel) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        log.message.toLowerCase().includes(query) ||
        (log.details && log.details.toLowerCase().includes(query)) ||
        (log.source && log.source.toLowerCase().includes(query))
      )
    }
    return true
  })

  const handleCopy = (log: LogEntry) => {
    const logText = `[${log.timestamp}] [${log.level}]${log.source ? ` [${log.source}]` : ''} ${log.message}${log.details ? `\n${log.details}` : ''}`
    navigator.clipboard.writeText(logText)
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyAll = () => {
    const allLogsText = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level}]${log.source ? ` [${log.source}]` : ''} ${log.message}${log.details ? `\n${log.details}` : ''}`
      )
      .join('\n')
    navigator.clipboard.writeText(allLogsText)
  }

  const handleDownload = () => {
    const logsText = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level}]${log.source ? ` [${log.source}]` : ''} ${log.message}${log.details ? `\n${log.details}` : ''}`
      )
      .join('\n')
    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jellyview-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
    }
  }

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50
      setAutoScroll(isAtBottom)
    }
  }

  if (isLoading) {
    return (
      <div className={cn('border rounded-lg bg-muted/30', className)} style={{ maxHeight }}>
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading logs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('border rounded-lg bg-red-50 dark:bg-red-950/20', className)}>
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 p-8">
          <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          <div className="text-center">
            <p className="font-medium text-red-900 dark:text-red-100">Failed to load logs</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Controls Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {/* Filter Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn('gap-2 h-9', showFilters && 'bg-accent')}
        >
          <Filter className="h-4 w-4" />
          Filters
          <Badge variant="secondary" className="ml-1">
            {filteredLogs.length}
          </Badge>
        </Button>

        {/* Action Buttons */}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyAll}
            className="h-9 w-9"
            title="Copy all logs"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDownload}
            className="h-9 w-9"
            title="Download logs"
          >
            <Download className="h-4 w-4" />
          </Button>
          {onClear && (
            <Button
              variant="outline"
              size="icon"
              onClick={onClear}
              className="h-9 w-9"
              title="Clear logs"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={scrollToBottom}
            className="h-9 w-9"
            title="Scroll to bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Level Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
          <span className="text-sm font-medium text-muted-foreground mr-2 flex items-center">Level:</span>
          {(['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as LogLevel[]).map((level) => (
            <Button
              key={level}
              variant={logLevel === level ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLogLevel(level)}
              className="h-8"
            >
              {level}
            </Button>
          ))}
        </div>
      )}

      {/* Log Display */}
      <div
        ref={scrollRef}
        className="border rounded-lg bg-muted/30 overflow-y-auto font-mono text-sm"
        style={{ maxHeight }}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 p-8">
            <Search className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No logs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? 'Try adjusting your search or filters' : 'No logs available'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {filteredLogs.map((log) => {
              const colors = LOG_LEVEL_COLORS[log.level]
              const isExpanded = expandedIds.has(log.id)

              return (
                <div
                  key={log.id}
                  className={cn('group hover:bg-muted/50 transition-colors', colors.bg)}
                >
                  {/* Log Entry Header */}
                  <div className="p-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      {/* Expand/Collapse Button */}
                      {log.details && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(log.id)}
                          className="h-6 w-6 p-0 shrink-0 -mt-1"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {/* Timestamp */}
                      <span
                        className="text-xs text-muted-foreground font-mono min-w-[80px] shrink-0"
                        title={new Date(log.timestamp).toLocaleString()}
                      >
                        {getRelativeTime(log.timestamp)}
                      </span>

                      {/* Level Badge */}
                      <Badge variant="outline" className={cn('shrink-0', colors.badge)}>
                        {log.level}
                      </Badge>

                      {/* Source (if present) */}
                      {log.source && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          [{log.source}]
                        </span>
                      )}

                      {/* Message */}
                      <span className={cn('break-all', colors.text)}>{log.message}</span>

                      {/* Copy Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(log)}
                        className="h-6 w-6 p-0 shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy log entry"
                      >
                        {copiedId === log.id ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && log.details && (
                      <div className="mt-2 pl-4 pr-10">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                          {log.details}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
