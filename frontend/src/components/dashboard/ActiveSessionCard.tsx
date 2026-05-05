import { Play, Pause, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Session } from '@/api/sessions';
import { getUserInitials } from '@/api/users';

interface ActiveSessionCardProps {
  session: Session;
  onClick?: () => void;
  className?: string;
}

export default function ActiveSessionCard({
  session,
  onClick,
  className,
}: ActiveSessionCardProps) {
  const { user, item, state, progress_pct, client, device } = session;
  const isPlaying = state === 'playing';
  const progressPercent = Math.round(progress_pct * 100);

  return (
    <Card
      className={cn('cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {user.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user.username} />
              ) : (
                <AvatarFallback>{getUserInitials(user.username)}</AvatarFallback>
              )}
            </Avatar>
            <div>
              <p className="font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">
                {client} on {device}
              </p>
            </div>
          </div>
          <Badge
            variant={isPlaying ? 'default' : 'secondary'}
            className="gap-1"
          >
            {isPlaying ? (
              <>
                <Play className="h-3 w-3" />
                Playing
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" />
                Paused
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium text-sm truncate">{item.name}</p>
          {session.series_name && (
            <p className="text-xs text-muted-foreground">
              {session.series_name}
              {session.season_number !== undefined && session.episode_number !== undefined && (
                <> · S{session.season_number.toString().padStart(2, '0')}E{session.episode_number.toString().padStart(2, '0')}</>
              )}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatSessionDuration(session.started_at)}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isPlaying ? 'bg-primary animate-pulse' : 'bg-muted-foreground'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Transcode indicator */}
        {session.transcode && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              Transcoding
            </Badge>
            {session.transcode_reason && (
              <span className="truncate">{session.transcode_reason}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatSessionDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = new Date().getTime();
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return '< 1m';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return remainingMins > 0 ? `${diffHours}h ${remainingMins}m` : `${diffHours}h`;
}
