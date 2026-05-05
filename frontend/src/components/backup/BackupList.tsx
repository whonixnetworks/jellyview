import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackupFile, formatFileSize, getBackupFileAge } from '@/api/backup';
import { Download, Trash2, Calendar, HardDrive } from 'lucide-react';

interface BackupListProps {
  backups: BackupFile[];
  loading?: boolean;
  onDownload: (filename: string, jobId: number) => void;
  onDelete: (filename: string) => void;
}

export default function BackupList({ backups, loading, onDownload, onDelete }: BackupListProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading backups...</p>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No backups found</p>
          <p className="text-muted-foreground text-sm">
            Create your first backup to start exporting watch stats
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {backups.length} {backups.length === 1 ? 'backup' : 'backups'} available
        </h3>
      </div>

      <div className="grid gap-4">
        {backups.map((backup) => (
          <Card key={backup.filename}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="font-medium truncate">{backup.filename}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{getBackupFileAge(backup)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      <span>{formatFileSize(backup.size)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(backup.filename, backup.id)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(backup.filename)}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
