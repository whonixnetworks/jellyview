import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BackupJob } from '@/api/backup';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  FileText,
  Users,
  Database
} from 'lucide-react';

interface ImportReportProps {
  job: BackupJob;
  dryRun?: boolean;
}

export default function ImportReport({ job, dryRun = false }: ImportReportProps) {
  const successRate = job.total_items > 0
    ? Math.round((job.matched / job.total_items) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Import Report</CardTitle>
            <CardDescription>
              {dryRun ? 'Dry run results' : 'Import results'}
            </CardDescription>
          </div>
          <Badge variant={dryRun ? 'secondary' : 'default'}>
            {dryRun ? 'Dry Run' : 'Completed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/10 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{job.matched}</p>
              <p className="text-xs text-muted-foreground">Matched</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <SkipForward className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{job.unmatched}</p>
              <p className="text-xs text-muted-foreground">Unmatched</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{job.total_users}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
          </div>

          {job.errors > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{job.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          )}
        </div>

        {/* Success Rate */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Success Rate</span>
            <span className="text-2xl font-bold">{successRate}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Breakdown
          </h4>

          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-muted-foreground">Total Items</span>
              <span className="font-medium">{job.total_items}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-muted-foreground">Items Restored</span>
              <span className="font-medium text-green-600">{job.matched}</span>
            </div>

            {job.unmatched > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-muted-foreground">Items Unmatched</span>
                <span className="font-medium text-amber-600">{job.unmatched}</span>
              </div>
            )}

            {job.processed > job.matched + job.unmatched && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-muted-foreground">Items Skipped</span>
                <span className="font-medium">
                  {job.processed - job.matched - job.unmatched}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Log */}
        {job.errors > 0 && job.error_log.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Error Log
            </h4>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20">
              <div className="p-3 space-y-2">
                {job.error_log.map((error, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400"
                  >
                    <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dry Run Notice */}
        {dryRun && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-lg text-amber-700 dark:text-amber-400">
            <SkipForward className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Dry Run Complete</p>
              <p className="text-sm opacity-90">
                This was a preview. No changes have been made to your data.
                Run the import again without dry run to apply these changes.
              </p>
            </div>
          </div>
        )}

        {/* Completion Message */}
        {!dryRun && job.errors === 0 && (
          <div className="flex items-start gap-3 p-4 bg-green-500/5 border border-green-500/10 rounded-lg text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Import Successful</p>
              <p className="text-sm opacity-90">
                All watch statistics have been successfully imported from the backup file.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
