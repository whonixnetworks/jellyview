import { Trophy, Users, Library } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { User } from '@/api/users';
import { getUserInitials } from '@/api/users';
import { formatWatchTime } from '@/api/users';

interface TopItem {
  id: number;
  name: string;
  item_type: string;
  poster_url?: string;
  plays: number;
  watch_time: number;
  year?: number;
  series_name?: string;
  season_number?: number;
  episode_number?: number;
}

interface TopLibrary {
  id: number;
  name: string;
  item_type: string;
  total_plays: number;
  total_watch_time: number;
}

interface TopStatsProps {
  topUsers?: User[];
  topItems?: TopItem[];
  topLibraries?: TopLibrary[];
  isLoading?: boolean;
  className?: string;
}

export default function TopStats({
  topUsers = [],
  topItems = [],
  topLibraries = [],
  isLoading = false,
  className,
}: TopStatsProps) {
  return (
    <div className={cn('grid gap-6', className)}>
      {/* Top Users */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Top Users</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </CardContent>
        </Card>
      ) : topUsers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Users by Watch Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topUsers.map((user, index) => (
                <TopUserItem key={user.id} user={user} rank={index + 1} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Top Items */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Most Watched</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </CardContent>
        </Card>
      ) : topItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Most Watched Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topItems.map((item, index) => (
                <TopWidgetItem key={item.id} item={item} rank={index + 1} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Top Libraries */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Top Libraries</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </CardContent>
        </Card>
      ) : topLibraries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              Top Libraries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topLibraries.map((library, index) => (
                <TopLibraryItem key={library.id} library={library} rank={index + 1} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface TopUserItemProps {
  user: User;
  rank: number;
}

function TopUserItem({ user, rank }: TopUserItemProps) {
  const isTop3 = rank <= 3;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm',
          isTop3
            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isTop3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
      </div>
      <Avatar className="h-9 w-9">
        {user.avatar_url ? (
          <AvatarImage src={user.avatar_url} alt={user.username} />
        ) : (
          <AvatarFallback>{getUserInitials(user.username)}</AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{user.username}</p>
        <p className="text-xs text-muted-foreground">{user.total_plays} plays</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatWatchTime(user.total_watch_time)}</p>
      </div>
    </div>
  );
}

interface TopWidgetItemProps {
  item: TopItem;
  rank: number;
}

function TopWidgetItem({ item, rank }: TopWidgetItemProps) {
  const isTop3 = rank <= 3;
  const episodeLabel =
    item.season_number !== undefined && item.episode_number !== undefined
      ? `S${item.season_number.toString().padStart(2, '0')}E${item.episode_number.toString().padStart(2, '0')}`
      : null;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm',
          isTop3
            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isTop3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate flex items-center gap-2">
          <span className="truncate">{item.name}</span>
          {episodeLabel && (
            <Badge variant="outline" className="text-xs shrink-0">
              {episodeLabel}
            </Badge>
          )}
        </p>
        {item.series_name && (
          <p className="text-xs text-muted-foreground truncate">{item.series_name}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">{item.plays}</p>
        <p className="text-xs text-muted-foreground">
          {formatWatchTime(item.watch_time)}
        </p>
      </div>
    </div>
  );
}

interface TopLibraryItemProps {
  library: TopLibrary;
  rank: number;
}

function TopLibraryItem({ library, rank }: TopLibraryItemProps) {
  const isTop3 = rank <= 3;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm',
          isTop3
            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isTop3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
          {getLibraryIcon(library.item_type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{library.name}</p>
          <p className="text-xs text-muted-foreground">{getLibraryTypeLabel(library.item_type)}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">{library.total_plays}</p>
        <p className="text-xs text-muted-foreground">
          {formatWatchTime(library.total_watch_time)}
        </p>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
      <div className="h-9 w-9 bg-muted animate-pulse rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}

function getLibraryIcon(itemType: string): string {
  switch (itemType) {
    case 'movies':
      return '🎬';
    case 'tvshows':
      return '📺';
    case 'music':
      return '🎵';
    case 'books':
      return '📚';
    case 'photos':
      return '📷';
    default:
      return '📁';
  }
}

function getLibraryTypeLabel(itemType: string): string {
  switch (itemType) {
    case 'movies':
      return 'Movies';
    case 'tvshows':
      return 'TV Shows';
    case 'music':
      return 'Music';
    case 'books':
      return 'Books';
    case 'photos':
      return 'Photos';
    case 'mixed':
      return 'Mixed';
    default:
      return itemType.charAt(0).toUpperCase() + itemType.slice(1);
  }
}
