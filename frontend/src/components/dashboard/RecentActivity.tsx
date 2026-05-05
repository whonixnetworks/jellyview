import { Play, Clock, Monitor, Smartphone, Tv } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { HistoryRecord } from '@/api/history';
import { getUserInitials } from '@/api/users';
import { formatDurationShort, getStreamTypeLabel, getEpisodeLabel } from '@/api/history';

interface RecentActivityProps {
  activities: HistoryRecord[];
  isLoading?: boolean;
  maxItems?: number;
  className?: string;
}

export default function RecentActivity({
  activities,
  isLoading = false,
  maxItems = 10,
  className,
}: RecentActivityProps) {
  const displayActivities = activities.slice(0, maxItems);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity
          </p>
        ) : (
          <div className="space-y-4">
            {displayActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActivityItemProps {
  activity: HistoryRecord;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ActivityItem({ activity }: ActivityItemProps) {
  const { user, item, device, duration, started_at, completion_pct } = activity;
  const episodeLabel = getEpisodeLabel(activity);
  const streamType = getStreamTypeLabel(activity);
  const timeAgo = formatRelativeTime(started_at);

  return (
    <div className="flex items-start gap-3 group">
      <Avatar className="h-10 w-10 shrink-0">
        {user.avatar_url ? (
          <AvatarImage src={user.avatar_url} alt={user.username} />
        ) : (
          <AvatarFallback>{getUserInitials(user.username)}</AvatarFallback>
        )}
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user.username}</p>
            <p className="text-sm text-muted-foreground truncate flex items-center gap-2">
              <Play className="h-3 w-3" />
              <span className="truncate">{item.name}</span>
              {episodeLabel && (
                <Badge variant="outline" className="text-xs ml-1 shrink-0">
                  {episodeLabel}
                </Badge>
              )}
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDurationShort(duration)}
          </span>
          <span className="flex items-center gap-1">
            <DeviceIcon device={device} className="h-3 w-3" />
            {device}
          </span>
          <Badge
            variant={activity.transcode ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {streamType}
          </Badge>
          <span className={cn(
            'font-medium',
            completion_pct >= 90 ? 'text-green-600 dark:text-green-400' :
            completion_pct >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-orange-600 dark:text-orange-400'
          )}>
            {Math.round(completion_pct)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function DeviceIcon({ device, className }: { device: string; className?: string }) {
  const lowerDevice = device.toLowerCase();
  if (lowerDevice.includes('mobile') || lowerDevice.includes('phone') || lowerDevice.includes('android') || lowerDevice.includes('ios')) {
    return <Smartphone className={className} />;
  }
  if (lowerDevice.includes('tv') || lowerDevice.includes('chromecast') || lowerDevice.includes('roku') || lowerDevice.includes('fire')) {
    return <Tv className={className} />;
  }
  return <Monitor className={className} />;
}
