import { Square, Pause, Play, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Session } from '@/api/sessions';
import { useState } from 'react';

interface SessionControlsProps {
  session: Session;
  onStop?: () => void;
  onPause?: () => void;
  onUnpause?: () => void;
  onSendMessage?: () => void;
}

export default function SessionControls({
  session,
  onStop,
  onPause,
  onUnpause,
  onSendMessage,
}: SessionControlsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: () => void | Promise<void>) => {
    try {
      setIsLoading(true);
      await action();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction(() => onStop?.())}
        disabled={isLoading}
        title="Stop session"
        className="min-h-[44px] min-w-[44px] touch-target"
      >
        <Square className="h-4 w-4" />
      </Button>

      {session.state === 'playing' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction(() => onPause?.())}
          disabled={isLoading}
          title="Pause session"
          className="min-h-[44px] min-w-[44px] touch-target"
        >
          <Pause className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction(() => onUnpause?.())}
          disabled={isLoading}
          title="Resume session"
          className="min-h-[44px] min-w-[44px] touch-target"
        >
          <Play className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction(() => onSendMessage?.())}
        disabled={isLoading}
        title="Send message"
        className="min-h-[44px] min-w-[44px] touch-target"
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
    </div>
  );
}
