import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BackupJob, getStatusLabel, getStatusBadgeColor, formatETA } from '@/api/backup';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface BackupProgressProps {
  job: BackupJob;
  showETA?: boolean;
}

export default function BackupProgress({ job, showETA = true }: BackupProgressProps) {
  const statusLabel = getStatusLabel(job.status);
  const statusColor = getStatusBadgeColor(job.status);
  const eta = showETA ? formatETA((job as any).eta_seconds ?? null) : null;

  const getStatusIcon = () => {
    switch (job.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <Badge variant="outline" className={statusColor}>
            {statusLabel}
          </Badge>
          {job.dry_run && (
            <Badge variant="secondary">Dry Run</Badge>
          )}
        </div>
        {eta && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            {eta}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <Progress value={job.progress} />

      {/* Status text */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {job.current_step || 'Processing...'}
        </span>
        <span className="font-medium">{Math.round(job.progress)}%</span>
      </div>

      {/* Progress details */}
      {job.total_users > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Users:</span>
            <span className="ml-1 font-medium">
              {job.processed} / {job.total_users}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Items:</span>
            <span className="ml-1 font-medium">
              {job.processed} / {job.total_items}
            </span>
          </div>
          {job.job_type === 'import' && (
            <>
              <div>
                <span className="text-muted-foreground">Matched:</span>
                <span className="ml-1 font-medium text-green-600">{job.matched}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unmatched:</span>
                <span className="ml-1 font-medium text-amber-600">{job.unmatched}</span>
              </div>
            </>
          )}
          {job.errors > 0 && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Errors:</span>
              <span className="ml-1 font-medium text-red-600">{job.errors}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
