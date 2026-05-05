import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { validateBackupFile } from '@/api/backup';
import { Upload, FileJson, Check, AlertCircle, Play, SkipForward } from 'lucide-react';

interface RestorePanelProps {
  isRestoring: boolean;
  hasActiveJob: boolean;
  onStartRestore: (file: File, dryRun?: boolean) => void;
}

export default function RestorePanel({ isRestoring, hasActiveJob, onStartRestore }: RestorePanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, []);

  const processFile = (file: File) => {
    const result = validateBackupFile(file);
    setValidation(result);

    if (result.valid) {
      setSelectedFile(file);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setValidation(null);
  };

  const disabled = isRestoring || hasActiveJob;

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!selectedFile ? (
        <Card>
          <CardHeader>
            <CardTitle>Import Backup File</CardTitle>
            <CardDescription>
              Upload a JSON backup file to restore watch stats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50 hover:bg-muted/50'}
              `}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={disabled}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {dragActive ? 'Drop file here' : 'Drag & drop backup file'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse (JSON files only, max 100MB)
                </p>
              </div>
            </div>

            {validation && !validation.valid && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {validation.error}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Selected File */
        <Card>
          <CardHeader>
            <CardTitle>Selected Backup File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <FileJson className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFile}
                disabled={disabled}
              >
                Change
              </Button>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <Check className="h-4 w-4 text-green-500" />
              <p className="text-sm text-green-600">
                File validated and ready to import
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {selectedFile && !disabled && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => onStartRestore(selectedFile, true)}
              >
                <SkipForward className="h-4 w-4" />
                Dry Run
              </Button>
              <Button
                className="gap-2"
                onClick={() => onStartRestore(selectedFile, false)}
              >
                <Play className="h-4 w-4" />
                Start Import
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <strong>Dry Run:</strong> Preview what would be restored without making changes.
            </p>
          </CardContent>
        </Card>
      )}

      {hasActiveJob && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">
                An import job is already in progress. Please wait for it to complete.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
