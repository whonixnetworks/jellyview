import { Clock, Calendar, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Session } from '@/api/sessions';
import { getUserInitials } from '@/api/users';
import TranscodeIndicator from './TranscodeIndicator';
import StreamQuality from './StreamQuality';
import SessionControls from './SessionControls';
import { cn } from '@/lib/utils';

interface LiveSessionCardProps {
  session: Session;
  onStop?: () => void;
  onPause?: () => void;
  onUnpause?: () => void;
  onSendMessage?: () => void;
  className?: string;
}

export default function LiveSessionCard({
  session,
  onStop,
  onPause,
  onUnpause,
  onSendMessage,
  className,
}: LiveSessionCardProps) {
  const { user, item, state, progress_pct, client, device, ip_address, started_at, last_updated } = session;
  const isPlaying = state === 'playing';
  const progressPercent = Math.round(progress_pct * 100);

  const formatDuration = (dateStr: string): string => {
    const date = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return '< 1m';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return remainingMins > 0 ? `${diffHours}h ${remainingMins}m` : `${diffHours}h`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header with user and controls */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-12 w-12 shrink-0">
              {user.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user.username} />
              ) : (
                <AvatarFallback className="text-lg">{getUserInitials(user.username)}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">{user.username}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{client}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{device}</span>
                {ip_address && (
                  <>
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground font-mono text-xs">{ip_address}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={isPlaying ? 'default' : state === 'paused' ? 'secondary' : 'outline'}
              className="gap-1"
            >
              {state}
            </Badge>
            <SessionControls
              session={session}
              onStop={onStop}
              onPause={onPause}
              onUnpause={onUnpause}
              onSendMessage={onSendMessage}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Media info with poster */}
        <div className="flex gap-4">
          {item.poster_url && (
            <img
              src={item.poster_url}
              alt={item.name}
              className="w-24 h-36 object-cover rounded-md shrink-0"
            />
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h4 className="font-semibold text-base truncate">{item.name}</h4>
              {session.series_name && (
                <p className="text-sm text-muted-foreground">
                  {session.series_name}
                  {session.season_number !== undefined && session.episode_number !== undefined && (
                    <> · S{session.season_number.toString().padStart(2, '0')}E{session.episode_number.toString().padStart(2, '0')}</>
                  )}
                </p>
              )}
              {item.year && (
                <p className="text-sm text-muted-foreground">{item.year}</p>
              )}
            </div>

            {/* Stream quality */}
            <StreamQuality session={session} />

            {/* Transcode indicator */}
            <div className="flex items-center gap-2">
              <TranscodeIndicator session={session} />
              {session.transcode_reason && (
                <span className="text-xs text-muted-foreground truncate">{session.transcode_reason}</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Started {formatDuration(started_at)} ago
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        {/* Footer with timestamps */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>Started: {formatDate(started_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-3 w-3" />
            <span>Last activity: {formatDate(last_updated)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
