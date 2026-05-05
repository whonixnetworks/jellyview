import { Monitor, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Session } from '@/api/sessions';

interface TranscodeIndicatorProps {
  session: Session;
}

export default function TranscodeIndicator({ session }: TranscodeIndicatorProps) {
  if (!session.transcode) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Monitor className="h-3 w-3" />
        Direct Play
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-1.5">
      <Cpu className="h-3 w-3" />
      Transcoding
      {session.transcode_hw && <span className="text-xs opacity-75">({session.transcode_hw})</span>}
    </Badge>
  );
}
