import { X, Filter, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import { User } from '@/api/users';
import { Library } from '@/api/libraries';

export interface HistoryFilters {
  user_id?: number;
  library_id?: number;
  media_type?: 'Video' | 'Audio';
  start_date?: string;
  end_date?: string;
  client?: string;
  device?: string;
  transcode?: boolean;
}

interface HistoryFiltersProps {
  filters: HistoryFilters;
  users: User[];
  libraries: Library[];
  availableClients: string[];
  availableDevices: string[];
  onFiltersChange: (filters: HistoryFilters) => void;
  onReset: () => void;
}

export function HistoryFilters({
  filters,
  users,
  libraries,
  availableClients,
  availableDevices,
  onFiltersChange,
  onReset,
}: HistoryFiltersProps) {
  const updateFilter = (key: keyof HistoryFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value === 'all' ? undefined : value });
  };

  const updateDateRange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      onFiltersChange({ ...filters, start_date: value || undefined });
    } else {
      onFiltersChange({ ...filters, end_date: value || undefined });
    }
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== null
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* User Filter */}
        <div className="space-y-2">
          <Label htmlFor="user-filter">User</Label>
          <Select
            value={filters.user_id?.toString() || 'all'}
            onValueChange={(value) => updateFilter('user_id', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger id="user-filter">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  {user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Library Filter */}
        <div className="space-y-2">
          <Label htmlFor="library-filter">Library</Label>
          <Select
            value={filters.library_id?.toString() || 'all'}
            onValueChange={(value) => updateFilter('library_id', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger id="library-filter">
              <SelectValue placeholder="All Libraries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Libraries</SelectItem>
              {libraries.map((library) => (
                <SelectItem key={library.id} value={library.id.toString()}>
                  {library.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Media Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="media-type-filter">Media Type</Label>
          <Select
            value={filters.media_type || 'all'}
            onValueChange={(value) => updateFilter('media_type', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="media-type-filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Video">Video</SelectItem>
              <SelectItem value="Audio">Audio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Start Date Filter */}
        <div className="space-y-2">
          <Label htmlFor="start-date-filter">Start Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="start-date-filter"
              type="date"
              className="pl-9"
              value={filters.start_date || ''}
              onChange={(e) => updateDateRange('start', e.target.value)}
            />
          </div>
        </div>

        {/* End Date Filter */}
        <div className="space-y-2">
          <Label htmlFor="end-date-filter">End Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="end-date-filter"
              type="date"
              className="pl-9"
              value={filters.end_date || ''}
              onChange={(e) => updateDateRange('end', e.target.value)}
            />
          </div>
        </div>

        {/* Client Filter */}
        <div className="space-y-2">
          <Label htmlFor="client-filter">Client</Label>
          <Select
            value={filters.client || 'all'}
            onValueChange={(value) => updateFilter('client', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="client-filter">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {availableClients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Device Filter */}
        <div className="space-y-2">
          <Label htmlFor="device-filter">Device</Label>
          <Select
            value={filters.device || 'all'}
            onValueChange={(value) => updateFilter('device', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="device-filter">
              <SelectValue placeholder="All Devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {availableDevices.map((device) => (
                <SelectItem key={device} value={device}>
                  {device}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transcode Filter */}
        <div className="space-y-2">
          <Label htmlFor="transcode-filter">Stream Type</Label>
          <Select
            value={filters.transcode === true ? 'transcode' : filters.transcode === false ? 'direct' : 'all'}
            onValueChange={(value) => {
              if (value === 'transcode') updateFilter('transcode', true);
              else if (value === 'direct') updateFilter('transcode', false);
              else updateFilter('transcode', undefined);
            }}
          >
            <SelectTrigger id="transcode-filter">
              <SelectValue placeholder="All Stream Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stream Types</SelectItem>
              <SelectItem value="direct">Direct Play Only</SelectItem>
              <SelectItem value="transcode">Transcode Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
