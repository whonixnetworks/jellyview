import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useState } from 'react';
import { RefreshCw, RotateCcw, Search, Trash2, Download } from 'lucide-react';

export type NotificationStatus = 'sent' | 'failed' | 'pending' | 'retrying';

export interface NotificationLogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  notifierId: string;
  notifierName: string;
  notifierType: string;
  eventType: string;
  status: NotificationStatus;
  timestamp: string;
  errorMessage?: string;
  retryCount?: number;
  payload?: string;
}

interface NotificationLogProps {
  logs: NotificationLogEntry[];
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onExport?: () => void;
  loading?: boolean;
}

export default function NotificationLog({
  logs,
  onRetry,
  onDelete,
  onRefresh,
  onExport,
  loading = false,
}: NotificationLogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'all'>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.ruleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.notifierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.eventType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: NotificationStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'sent':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'retrying':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const getRelativeTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatTimestamp(timestamp);
    } catch {
      return timestamp;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Notification Log</CardTitle>
            <CardDescription>
              View history of sent notifications and their status
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onExport && (
              <Button variant="outline" onClick={onExport} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            <Button variant="outline" onClick={onRefresh} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by rule, notifier, or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as NotificationStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="retrying">Retrying</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Notifier</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                      Loading logs...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all'
                        ? 'No logs match your filters'
                        : 'No notification logs yet'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{getRelativeTime(log.timestamp)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{log.ruleName}</span>
                        {log.retryCount && log.retryCount > 0 && (
                          <Badge variant="outline" className="w-fit text-xs mt-1">
                            Retry #{log.retryCount}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{log.notifierName}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {log.notifierType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.eventType.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(log.status)} className="capitalize">
                        {log.status}
                      </Badge>
                      {log.errorMessage && (
                        <p className="text-xs text-destructive mt-1 truncate max-w-[200px]">
                          {log.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(log.status === 'failed' || log.status === 'retrying') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRetry(log.id)}
                            className="h-8 w-8"
                            title="Retry"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(log.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filteredLogs.length > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Showing {filteredLogs.length} of {logs.length} entries</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
