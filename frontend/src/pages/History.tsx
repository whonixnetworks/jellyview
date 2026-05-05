import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorAlert } from '@/components/ui/Alerts';
import { HistoryTable } from '@/components/history/HistoryTable';
import { HistoryFilters, type HistoryFilters as FiltersType } from '@/components/history/HistoryFilters';
import { WatchStatsChart } from '@/components/history/WatchStatsChart';

import {
  listHistory,
  getHistoryStatsByDay,
  exportHistory,
  type HistoryRecord,
  type HistoryListParams,
  type HistoryStatsByDay,
} from '@/api/history';
import { listUsers, type User } from '@/api/users';
import { listLibraries, type Library } from '@/api/libraries';
import { formatDuration, getQualityLabel, getBitrateLabel, getStreamTypeLabel } from '@/api/history';

export default function History() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [stats, setStats] = useState<HistoryStatsByDay[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [availableDevices, setAvailableDevices] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [librariesError, setLibrariesError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize] = useState(25);

  const [filters, setFilters] = useState<FiltersType>({});
  const [sortColumn, setSortColumn] = useState<string>('started_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    loadUsers();
    loadLibraries();
  }, []);

  // Load records when filters, sort, or page change
  useEffect(() => {
    loadRecords();
  }, [filters, sortColumn, sortOrder, page]);

  // Load stats when filters change
  useEffect(() => {
    loadStats();
  }, [filters]);

  const loadUsers = async () => {
    try {
      const data = await listUsers();
      setUsers(data);
      setUsersError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load users';
      setUsersError(errorMessage);
      console.error('Failed to load users:', error);
    }
  };

  const loadLibraries = async () => {
    try {
      const data = await listLibraries();
      setLibraries(data);
      setLibrariesError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load libraries';
      setLibrariesError(errorMessage);
      console.error('Failed to load libraries:', error);
    }
  };

  const loadRecords = async () => {
    setIsLoading(true);
    setRecordsError(null);
    try {
      const params: HistoryListParams = {
        page,
        limit: pageSize,
        sort_by: sortColumn as HistoryListParams['sort_by'],
        sort_order: sortOrder,
        ...filters,
      };

      const response = await listHistory(params);
      setRecords(response.items);
      setTotalRecords(response.total);
      setTotalPages(Math.ceil(response.total / pageSize));

      // Extract unique clients and devices from records
      if (response.items.length > 0) {
        const clients = Array.from(new Set(response.items.map((r) => r.client).filter(Boolean)));
        const devices = Array.from(new Set(response.items.map((r) => r.device).filter(Boolean)));
        setAvailableClients(clients);
        setAvailableDevices(devices);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load history records';
      setRecordsError(errorMessage);
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    setIsStatsLoading(true);
    setStatsError(null);
    try {
      const params = {
        user_id: filters.user_id,
        library_id: filters.library_id,
        start_date: filters.start_date,
        end_date: filters.end_date,
        days: 30,
      };
      const data = await getHistoryStatsByDay(params);
      setStats(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load history statistics';
      setStatsError(errorMessage);
      console.error('Failed to load stats:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handleFiltersChange = useCallback((newFilters: FiltersType) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const handleResetFilters = () => {
    setFilters({});
    setPage(1);
    setSortColumn('started_at');
    setSortOrder('desc');
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc'); // Default to desc when changing columns
    }
  };

  const handleRowClick = (record: HistoryRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportHistory({
        format: 'csv',
        user_id: filters.user_id,
        library_id: filters.library_id,
        start_date: filters.start_date,
        end_date: filters.end_date,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export history';
      setRecordsError(`Export failed: ${errorMessage}`);
      console.error('Failed to export history:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    loadRecords();
    loadStats();
  };

  const formatRecordDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Watch History</h1>
          <p className="text-muted-foreground">
            View and analyze playback history across all users
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Error Alerts */}
      {usersError && (
        <ErrorAlert
          title="Error loading users"
          message={usersError}
          onRetry={loadUsers}
          onDismiss={() => setUsersError(null)}
        />
      )}
      {librariesError && (
        <ErrorAlert
          title="Error loading libraries"
          message={librariesError}
          onRetry={loadLibraries}
          onDismiss={() => setLibrariesError(null)}
        />
      )}
      {recordsError && (
        <ErrorAlert
          title="Error loading history"
          message={recordsError}
          onRetry={loadRecords}
          onDismiss={() => setRecordsError(null)}
        />
      )}
      {statsError && (
        <ErrorAlert
          title="Error loading statistics"
          message={statsError}
          onRetry={loadStats}
          onDismiss={() => setStatsError(null)}
        />
      )}

      {/* Stats Chart */}
      <WatchStatsChart stats={stats} isLoading={isStatsLoading} />

      {/* Filters */}
      <HistoryFilters
        filters={filters}
        users={users}
        libraries={libraries}
        availableClients={availableClients}
        availableDevices={availableDevices}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {/* Table */}
      <div className="border rounded-lg">
        <HistoryTable
          records={records}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          sortColumn={sortColumn}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalRecords)} of {totalRecords} records
          </div>
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="min-h-[44px] touch-target"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="w-9 h-9 min-h-[36px] touch-target"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="min-h-[44px] touch-target"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stream Details</DialogTitle>
            <DialogDescription>
              Full information about this playback session
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              {/* User & Item Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">User</div>
                  <div className="font-semibold">{selectedRecord.user.username}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Item</div>
                  <div className="font-semibold">{selectedRecord.item.name}</div>
                  {selectedRecord.series_name && (
                    <div className="text-sm text-muted-foreground">
                      {selectedRecord.series_name} S{selectedRecord.season_number ?? '?'}E{selectedRecord.episode_number ?? '?'}
                    </div>
                  )}
                </div>
              </div>

              {/* Library & Media Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Library</div>
                  <div>{selectedRecord.library.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Media Type</div>
                  <div>{selectedRecord.media_type}</div>
                </div>
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Started At</div>
                  <div>{formatRecordDate(selectedRecord.started_at)}</div>
                </div>
                {selectedRecord.stopped_at && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Stopped At</div>
                    <div>{formatRecordDate(selectedRecord.stopped_at)}</div>
                  </div>
                )}
              </div>

              {/* Duration & Playback */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Duration</div>
                  <div>{formatDuration(selectedRecord.duration)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Paused Time</div>
                  <div>{formatDuration(selectedRecord.paused_duration)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Completion</div>
                  <div className="font-semibold">{selectedRecord.completion_pct.toFixed(1)}%</div>
                </div>
              </div>

              {/* Client & Device */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Client</div>
                  <div>{selectedRecord.client}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Device</div>
                  <div>{selectedRecord.device}</div>
                </div>
              </div>

              {/* Stream Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Stream Type</div>
                  <div>{getStreamTypeLabel(selectedRecord)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Quality</div>
                  <div>
                    {getQualityLabel(selectedRecord)} {selectedRecord.bitrate && `(${getBitrateLabel(selectedRecord.bitrate)})`}
                  </div>
                </div>
              </div>

              {/* Codecs */}
              {(selectedRecord.video_codec || selectedRecord.audio_codec) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedRecord.video_codec && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Video Codec</div>
                      <div>{selectedRecord.video_codec}</div>
                    </div>
                  )}
                  {selectedRecord.audio_codec && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Audio Codec</div>
                      <div>{selectedRecord.audio_codec}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Resolution */}
              {selectedRecord.width && selectedRecord.height && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Resolution</div>
                  <div>
                    {selectedRecord.width} x {selectedRecord.height} {selectedRecord.container && `(${selectedRecord.container})`}
                  </div>
                </div>
              )}

              {/* Transcode Details */}
              {selectedRecord.transcode && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <div className="font-semibold">Transcode Details</div>
                  {selectedRecord.transcode_reason && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Reason</div>
                      <div>{selectedRecord.transcode_reason}</div>
                    </div>
                  )}
                  {selectedRecord.transcode_hw && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Hardware Acceleration</div>
                      <div>{selectedRecord.transcode_hw}</div>
                    </div>
                  )}
                </div>
              )}

              {/* IP Address */}
              {selectedRecord.ip_address && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">IP Address</div>
                  <div>{selectedRecord.ip_address}</div>
                </div>
              )}

              {/* Play Count */}
              <div>
                <div className="text-sm font-medium text-muted-foreground">Play Count</div>
                <div>{selectedRecord.play_count} time{selectedRecord.play_count !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
