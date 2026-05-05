import { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, Activity, Gauge, VolumeX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ErrorAlert } from '@/components/ui/Alerts';
import { useSSE } from '@/hooks/useSSE';
import { LiveSessionCard } from '@/components/sessions';
import { Session, SessionStats, listSessions, getSessionStats, stopSession, pauseSession, unpauseSession, sendSessionMessage } from '@/api/sessions';

export default function LiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconnecting, _] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadSessionsData();
  }, []);

  // SSE connection for real-time updates
  useSSE({
    eventTypes: ['sessions'],
  });

  const loadSessionsData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [sessionsData, statsData] = await Promise.all([
        listSessions(),
        getSessionStats(),
      ]);
      setSessions(sessionsData || []);
      setStats(statsData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load live sessions';
      setError(errorMessage);
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await stopSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setStopError(null);
      // Reload stats
      const statsData = await getSessionStats();
      setStats(statsData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop session';
      setStopError(errorMessage);
      console.error('Failed to stop session:', error);
    }
  };

  const handlePauseSession = async (sessionId: string) => {
    try {
      await pauseSession(sessionId);
      setPauseError(null);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, state: 'paused' as const } : s))
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pause session';
      setPauseError(errorMessage);
      console.error('Failed to pause session:', error);
    }
  };

  const handleUnpauseSession = async (sessionId: string) => {
    try {
      await unpauseSession(sessionId);
      setPauseError(null);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, state: 'playing' as const } : s))
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unpause session';
      setPauseError(errorMessage);
      console.error('Failed to unpause session:', error);
    }
  };

  const handleSendMessage = async (session: Session) => {
    if (!messageText.trim()) return;

    try {
      setIsSendingMessage(true);
      await sendSessionMessage(session.id, { text: messageText });
      setMessageText('');
      setSelectedSession(null);
      setStopError(null);
      // Show success toast
      // toast.success('Message sent successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setStopError(errorMessage);
      console.error('Failed to send message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const formatBandwidth = (bytesPerSecond?: number): string => {
    if (!bytesPerSecond) return '0 Mbps';
    const mbps = bytesPerSecond / 1000000;
    if (mbps < 1) return `${Math.round(mbps * 1000) / 1000} Mbps`;
    return `${Math.round(mbps * 100) / 100} Mbps`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Sessions</h1>
          <p className="text-muted-foreground">
            Real-time active streaming sessions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSessionsData}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Alerts */}
      {error && (
        <ErrorAlert
          title="Unable to load sessions"
          message={error}
          onRetry={loadSessionsData}
          onDismiss={() => setError(null)}
        />
      )}
      {stopError && (
        <ErrorAlert
          title="Session action failed"
          message={stopError}
          onDismiss={() => setStopError(null)}
        />
      )}
      {pauseError && (
        <ErrorAlert
          title="Session action failed"
          message={pauseError}
          onDismiss={() => setPauseError(null)}
        />
      )}

      {/* Aggregate Stats Bar */}
      {stats && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8">
              {/* Total Sessions */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Total Streams</span>
                </div>
                <span className="text-2xl sm:text-3xl font-bold">{stats.total_sessions}</span>
              </div>

              {/* Playing vs Paused vs Buffering */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Playing</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-green-600">{stats.playing_sessions}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Pause className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Paused</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-blue-600">{stats.paused_sessions}</span>
                </div>

                {stats.buffering_sessions > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Buffering</span>
                    </div>
                    <span className="text-xl sm:text-2xl font-semibold text-yellow-600">{stats.buffering_sessions}</span>
                  </div>
                )}
              </div>

              {/* Direct Play vs Transcode */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Badge variant="secondary" className="gap-1 mb-1 text-xs">
                    Direct Play
                  </Badge>
                  <span className="text-xl sm:text-2xl font-semibold text-blue-600">{stats.direct_play_count}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Badge variant="default" className="gap-1 mb-1 text-xs">
                    Transcoding
                  </Badge>
                  <span className="text-xl sm:text-2xl font-semibold text-orange-600">{stats.transcode_count}</span>
                </div>
              </div>

              {/* Total Bandwidth */}
              {stats.total_bandwidth !== undefined && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Gauge className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Total Bandwidth</span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-bold">{formatBandwidth(stats.total_bandwidth)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      {isLoading && !sessions.length ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading sessions...</p>
            </div>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <VolumeX className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No Active Sessions</p>
              <p className="text-muted-foreground text-sm">
                There are currently no active streaming sessions.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <LiveSessionCard
              key={session.id}
              session={session}
              onStop={() => handleStopSession(session.id)}
              onPause={() => handlePauseSession(session.id)}
              onUnpause={() => handleUnpauseSession(session.id)}
              onSendMessage={() => setSelectedSession(session)}
            />
          ))}
        </div>
      )}

      {/* Send Message Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message to Session</DialogTitle>
            {selectedSession && (
              <p className="text-sm text-muted-foreground">
                Send a message to {selectedSession.user.username} on {selectedSession.client}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedSession) {
                  handleSendMessage(selectedSession);
                }
              }}
              disabled={isSendingMessage}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedSession(null)}
                disabled={isSendingMessage}
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedSession && handleSendMessage(selectedSession)}
                disabled={!messageText.trim() || isSendingMessage}
              >
                Send Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SSE Reconnection Indicator */}
      {isReconnecting && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-yellow-700">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Reconnecting to live updates...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
