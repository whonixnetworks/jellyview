import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Bell, Send, TestTube, Trash2, Edit, Check, X } from 'lucide-react';

export type NotifierType = 'telegram' | 'discord' | 'email' | 'webhook' | 'pushover';

export interface NotifierConfig {
  id: string;
  name: string;
  type: NotifierType;
  enabled: boolean;
  config: {
    botToken?: string;
    chatId?: string;
    webhookUrl?: string;
    webhookMethod?: 'POST' | 'PUT' | 'PATCH';
    webhookHeaders?: string;
    toEmail?: string;
    fromEmail?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    userKey?: string;
    appToken?: string;
    device?: string;
    priority?: number;
    sound?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface NotifierCardProps {
  notifier: NotifierConfig;
  onToggle: (id: string) => void;
  onEdit: (notifier: NotifierConfig) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  isTesting?: boolean;
  isEditing?: boolean;
  onSave?: (notifier: NotifierConfig) => void;
  onCancel?: () => void;
}

const getTypeIcon = (type: NotifierType) => {
  switch (type) {
    case 'telegram':
      return <Bell className="h-4 w-4" />;
    case 'discord':
      return <Bell className="h-4 w-4" />;
    case 'email':
      return <Bell className="h-4 w-4" />;
    case 'webhook':
      return <Bell className="h-4 w-4" />;
    case 'pushover':
      return <Bell className="h-4 w-4" />;
  }
};

const getTypeColor = (type: NotifierType): string => {
  switch (type) {
    case 'telegram':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'discord':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'email':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'webhook':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'pushover':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  }
};

export default function NotifierCard({
  notifier,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  isTesting = false,
  isEditing = false,
  onSave,
  onCancel,
}: NotifierCardProps) {
  const [editedConfig, setEditedConfig] = useState<NotifierConfig>(notifier);

  const handleSave = () => {
    onSave?.(editedConfig);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getTypeColor(notifier.type)}`}>
              {getTypeIcon(notifier.type)}
            </div>
            <div>
              <CardTitle className="text-lg">{notifier.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize">
                  {notifier.type}
                </Badge>
                {notifier.enabled ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggle(notifier.id)}
              className="h-8 w-8"
            >
              {notifier.enabled ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {!isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(notifier)}
                  className="h-8 w-8"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(notifier.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notifier-name">Name</Label>
              <Input
                id="notifier-name"
                value={editedConfig.name}
                onChange={(e) =>
                  setEditedConfig({ ...editedConfig, name: e.target.value })
                }
              />
            </div>

            {editedConfig.type === 'telegram' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bot-token">Bot Token</Label>
                  <Input
                    id="bot-token"
                    type="password"
                    value={editedConfig.config.botToken || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, botToken: e.target.value },
                      })
                    }
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chat-id">Chat ID</Label>
                  <Input
                    id="chat-id"
                    value={editedConfig.config.chatId || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, chatId: e.target.value },
                      })
                    }
                    placeholder="-1001234567890"
                  />
                </div>
              </>
            )}

            {editedConfig.type === 'discord' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    value={editedConfig.config.webhookUrl || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, webhookUrl: e.target.value },
                      })
                    }
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>
              </>
            )}

            {editedConfig.type === 'email' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="to-email">To Email</Label>
                  <Input
                    id="to-email"
                    type="email"
                    value={editedConfig.config.toEmail || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, toEmail: e.target.value },
                      })
                    }
                    placeholder="recipient@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-email">From Email</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={editedConfig.config.fromEmail || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, fromEmail: e.target.value },
                      })
                    }
                    placeholder="jellyview@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    value={editedConfig.config.smtpHost || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, smtpHost: e.target.value },
                      })
                    }
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={editedConfig.config.smtpPort || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, smtpPort: parseInt(e.target.value) || 587 },
                      })
                    }
                    placeholder="587"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">SMTP User</Label>
                  <Input
                    id="smtp-user"
                    value={editedConfig.config.smtpUser || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, smtpUser: e.target.value },
                      })
                  }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-password">SMTP Password</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    value={editedConfig.config.smtpPassword || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, smtpPassword: e.target.value },
                      })
                  }
                  />
                </div>
              </>
            )}

{editedConfig.type === 'webhook' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    value={editedConfig.config.webhookUrl || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, webhookUrl: e.target.value },
                      })
                    }
                    placeholder="https://example.com/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-method">HTTP Method</Label>
                  <Select
                    value={editedConfig.config.webhookMethod || 'POST'}
                    onValueChange={(value: 'POST' | 'PUT' | 'PATCH') =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, webhookMethod: value },
                      })
                    }
                  >
                    <SelectTrigger id="webhook-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-headers">Headers (JSON)</Label>
                  <Input
                    id="webhook-headers"
                    value={editedConfig.config.webhookHeaders || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, webhookHeaders: e.target.value },
                      })
                    }
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>
              </>
            )}

            {editedConfig.type === 'pushover' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-key">User Key</Label>
                  <Input
                    id="user-key"
                    value={editedConfig.config.userKey || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, userKey: e.target.value },
                      })
                    }
                    placeholder="Your Pushover user key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-token">Application API Token</Label>
                  <Input
                    id="app-token"
                    type="password"
                    value={editedConfig.config.appToken || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, appToken: e.target.value },
                      })
                    }
                    placeholder="Your Pushover app API token"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pushover-device">Device (Optional)</Label>
                  <Input
                    id="pushover-device"
                    value={editedConfig.config.device || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, device: e.target.value },
                      })
                    }
                    placeholder="Leave blank for all devices"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pushover-priority">Priority</Label>
                  <Select
                    value={String(editedConfig.config.priority ?? 0)}
                    onValueChange={(value) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, priority: parseInt(value) },
                      })
                    }
                  >
                    <SelectTrigger id="pushover-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-2">Lowest Priority (-2)</SelectItem>
                      <SelectItem value="-1">Low Priority (-1)</SelectItem>
                      <SelectItem value="0">Normal Priority (0)</SelectItem>
                      <SelectItem value="1">High Priority (1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pushover-sound">Sound (Optional)</Label>
                  <Input
                    id="pushover-sound"
                    value={editedConfig.config.sound || ''}
                    onChange={(e) =>
                      setEditedConfig({
                        ...editedConfig,
                        config: { ...editedConfig.config, sound: e.target.value },
                      })
                    }
                    placeholder="e.g., pushover, bike, siren"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {notifier.type === 'telegram' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Chat ID:</span>
                  <span className="font-mono">{notifier.config.chatId || 'Not configured'}</span>
                </div>
              </>
            )}
            {notifier.type === 'discord' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Webhook:</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">
                    {notifier.config.webhookUrl || 'Not configured'}
                  </span>
                </div>
              </>
            )}
            {notifier.type === 'email' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">To:</span>
                  <span>{notifier.config.toEmail || 'Not configured'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">From:</span>
                  <span>{notifier.config.fromEmail || 'Not configured'}</span>
                </div>
              </>
            )}
            {notifier.type === 'webhook' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">URL:</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">
                    {notifier.config.webhookUrl || 'Not configured'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Method:</span>
                  <Badge variant="outline">{notifier.config.webhookMethod || 'POST'}</Badge>
                </div>
              </>
            )}
            {notifier.type === 'pushover' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">User Key:</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">
                    {notifier.config.userKey || 'Not configured'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">App Token:</span>
                  <span className="font-mono text-xs">
                    {notifier.config.appToken ? '••••••••' : 'Not configured'}
                  </span>
                </div>
                {notifier.config.device && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Device:</span>
                    <span>{notifier.config.device}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => onTest(notifier.id)}
            disabled={!notifier.enabled || isTesting}
          >
            {isTesting ? (
              <>
                <Send className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Test
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
