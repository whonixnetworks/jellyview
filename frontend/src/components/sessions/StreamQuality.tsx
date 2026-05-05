import { Tv, Cpu, Activity } from 'lucide-react';
import { Session } from '@/api/sessions';
import { getQualityLabel } from '@/api/sessions';
import { cn } from '@/lib/utils';

interface StreamQualityProps {
  session: Session;
  className?: string;
}

export default function StreamQuality({ session, className }: StreamQualityProps) {
  const quality = getQualityLabel(session);
  const bitrate = session.bitrate ? Math.round(session.bitrate / 1000) : 0;
  const isHD = session.height && session.height >= 720;
  const isFullHD = session.height && session.height >= 1080;
  const is4K = session.height && session.height >= 2160;

  return (
    <div className={cn('flex items-center gap-3 text-sm text-muted-foreground', className)}>
      {/* Resolution */}
      <div className="flex items-center gap-1.5">
        {is4K ? (
          <Tv className="h-4 w-4 text-green-500" />
        ) : isFullHD ? (
          <Tv className="h-4 w-4 text-blue-500" />
        ) : isHD ? (
          <Tv className="h-4 w-4 text-blue-500" />
        ) : (
          <Tv className="h-4 w-4" />
        )}
        <span className="font-medium">{quality}</span>
      </div>

      {/* Bitrate */}
      {bitrate > 0 && (
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          <span>{bitrate} Mbps</span>
        </div>
      )}

      {/* Codec info */}
      {session.video_codec && (
        <div className="flex items-center gap-1.5">
          <Cpu className="h-4 w-4" />
          <span>{session.video_codec}</span>
          {session.container && <span className="text-xs opacity-75">({session.container})</span>}
        </div>
      )}

      {session.audio_codec && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{session.audio_codec}</span>
        </div>
      )}
    </div>
  );
}
