import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { HistoryRecord } from '@/api/history';
import { formatDuration, getQualityLabel, getBitrateLabel, getStreamTypeLabel } from '@/api/history';
import { getUserInitials } from '@/api/users';

interface HistoryTableProps {
  records: HistoryRecord[];
  isLoading?: boolean;
  onRowClick?: (record: HistoryRecord) => void;
  sortColumn?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

const columns = [
  { key: 'user', label: 'User', sortable: true },
  { key: 'media', label: 'Media', sortable: false },
  { key: 'library', label: 'Library', sortable: true },
  { key: 'client', label: 'Client', sortable: true },
  { key: 'device', label: 'Device', sortable: true },
  { key: 'quality', label: 'Quality', sortable: false },
  { key: 'duration', label: 'Duration', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
];

export function HistoryTable({
  records,
  isLoading = false,
  onRowClick,
  sortColumn,
  sortOrder,
  onSort,
}: HistoryTableProps) {
  const handleSort = (columnKey: string) => {
    if (!onSort) return;
    
    const column = columns.find((c) => c.key === columnKey);
    if (!column || !column.sortable) return;
    
    if (sortColumn === columnKey) {
      onSort(columnKey);
    } else {
      onSort(columnKey);
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="ml-2 h-4 w-4 text-muted-foreground" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4 text-muted-foreground" />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMediaTypeBadge = (record: HistoryRecord) => {
    if (record.media_type === 'Video') {
      return <Badge variant="secondary" className="text-xs">Video</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Audio</Badge>;
  };

  const getTranscodeBadge = (record: HistoryRecord) => {
    if (record.transcode) {
      return (
        <Badge variant="destructive" className="text-xs">
          {getStreamTypeLabel(record)}
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
        Direct
      </Badge>
    );
  };

  const getCompletionClass = (completionPct: number) => {
    if (completionPct >= 90) return 'text-green-600';
    if (completionPct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading history...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">No history records found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={column.sortable && onSort ? 'cursor-pointer hover:bg-muted/50 whitespace-nowrap' : 'whitespace-nowrap'}
                onClick={() => handleSort(column.key)}
              >
                <div className="flex items-center">
                  {column.label}
                  {column.sortable && onSort && getSortIcon(column.key)}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow
              key={record.id}
              className={onRowClick ? 'cursor-pointer' : ''}
              onClick={() => onRowClick?.(record)}
            >
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={record.user.avatar_url} alt={record.user.username} />
                    <AvatarFallback>{getUserInitials(record.user.username)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{record.user.username}</div>
                    <div className="text-xs text-muted-foreground">{record.user.id}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="max-w-[200px]">
                  <div className="font-medium truncate">{record.item.name}</div>
                  {record.series_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {record.series_name} S{record.season_number ?? '?'}E{record.episode_number ?? '?'}
                    </div>
                  )}
                  {record.year && (
                    <div className="text-xs text-muted-foreground">{record.year}</div>
                  )}
                  <div className="flex gap-1 mt-1">
                    {getMediaTypeBadge(record)}
                    <span className={`text-xs font-medium ${getCompletionClass(record.completion_pct)}`}>
                      {Math.round(record.completion_pct)}%
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="text-sm">{record.library.name}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{record.client}</span>
                  {getTranscodeBadge(record)}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="text-sm">{record.device}</div>
                {record.ip_address && (
                  <div className="text-xs text-muted-foreground hidden sm:block">{record.ip_address}</div>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{getQualityLabel(record)}</span>
                  {record.bitrate && (
                    <span className="text-xs text-muted-foreground">{getBitrateLabel(record.bitrate)}</span>
                  )}
                  {record.video_codec && (
                    <span className="text-xs text-muted-foreground">{record.video_codec}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="text-sm">{formatDuration(record.duration)}</div>
                <div className="text-xs text-muted-foreground">
                  {record.play_count} play{record.play_count !== 1 ? 's' : ''}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span className="text-sm">{formatDate(record.started_at)}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{formatTime(record.started_at)}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
