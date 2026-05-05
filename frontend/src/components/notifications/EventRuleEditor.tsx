import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';

export type EventType =
  | 'stream_start'
  | 'stream_stop'
  | 'stream_pause'
  | 'stream_resume'
  | 'transcoding_start'
  | 'transcoding_hw'
  | 'item_added'
  | 'user_created'
  | 'server_update_available'
  | 'server_down'
  | 'server_up';

export interface EventRule {
  id: string;
  name: string;
  eventType: EventType;
  notifierId: string;
  enabled: boolean;
  filters?: {
    userId?: string;
    libraryId?: string;
    mediaType?: 'movie' | 'show' | 'music' | 'photo';
  };
  template?: string;
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  stream_start: 'Stream Start',
  stream_stop: 'Stream Stop',
  stream_pause: 'Stream Pause',
  stream_resume: 'Stream Resume',
  transcoding_start: 'Transcoding Start',
  transcoding_hw: 'Hardware Transcoding',
  item_added: 'Item Added',
  user_created: 'User Created',
  server_update_available: 'Update Available',
  server_down: 'Server Down',
  server_up: 'Server Up',
};

const AVAILABLE_VARIABLES = {
  stream_start: ['{{username}}', '{{item_title}}', '{{item_type}}', '{{library_name}}'],
  stream_stop: ['{{username}}', '{{item_title}}', '{{watch_duration}}', '{{library_name}}'],
  stream_pause: ['{{username}}', '{{item_title}}', '{{pause_position}}'],
  stream_resume: ['{{username}}', '{{item_title}}', '{{resume_position}}'],
  transcoding_start: ['{{username}}', '{{item_title}}', '{{transcode_codec}}'],
  transcoding_hw: ['{{username}}', '{{item_title}}', '{{hw_accel}}'],
  item_added: ['{{item_title}}', '{{item_type}}', '{{library_name}}'],
  user_created: ['{{username}}', '{{created_date}}'],
  server_update_available: ['{{current_version}}', '{{new_version}}'],
  server_down: ['{{down_time}}', '{{last_active}}'],
  server_up: ['{{up_time}}', '{{down_duration}}'],
};

interface EventRuleEditorProps {
  rule?: EventRule;
  notifiers: Array<{ id: string; name: string; type: string }>;
  onSave: (rule: Omit<EventRule, 'id'>) => void;
  onCancel: () => void;
  users?: Array<{ id: string; name: string }>;
  libraries?: Array<{ id: string; name: string }>;
}

export default function EventRuleEditor({
  rule,
  notifiers,
  onSave,
  onCancel,
  users = [],
  libraries = [],
}: EventRuleEditorProps) {
  const [name, setName] = useState(rule?.name || '');
  const [eventType, setEventType] = useState<EventType>(rule?.eventType || 'stream_start');
  const [notifierId, setNotifierId] = useState(rule?.notifierId || '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [filterUserId, setFilterUserId] = useState(rule?.filters?.userId || '');
  const [filterLibraryId, setFilterLibraryId] = useState(rule?.filters?.libraryId || '');
  const [filterMediaType, setFilterMediaType] = useState<'movie' | 'show' | 'music' | 'photo' | undefined>(
    rule?.filters?.mediaType
  );
  const [template, setTemplate] = useState(
    rule?.template ||
      `New {{item_type}} added: {{item_title}}\nLibrary: {{library_name}}\nAdded by: {{username}}`
  );

  const availableVars = AVAILABLE_VARIABLES[eventType] || [];

  const handleSave = () => {
    onSave({
      name,
      eventType,
      notifierId,
      enabled,
      filters: {
        userId: filterUserId && filterUserId !== '__all__' ? filterUserId : undefined,
        libraryId: filterLibraryId && filterLibraryId !== '__all__' ? filterLibraryId : undefined,
        mediaType: filterMediaType,
      },
      template: template || undefined,
    });
  };

  const insertVariable = (variable: string) => {
    setTemplate((prev) => (prev || '') + variable);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{rule ? 'Edit Event Rule' : 'Create Event Rule'}</CardTitle>
        <CardDescription>
          Configure when and how notifications are sent based on Jellyfin events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rule-name">Rule Name</Label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Notify on new movies"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="event-type">Event Type</Label>
            <Select value={eventType} onValueChange={(value) => setEventType(value as EventType)}>
              <SelectTrigger id="event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notifier">Notifier</Label>
            <Select value={notifierId} onValueChange={setNotifierId}>
              <SelectTrigger id="notifier">
                <SelectValue placeholder="Select a notifier" />
              </SelectTrigger>
              <SelectContent>
                {notifiers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No notifiers configured
                  </div>
                ) : (
                  notifiers.map((notifier) => (
                    <SelectItem key={notifier.id} value={notifier.id}>
                      {notifier.name} ({notifier.type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <Label>Filters (Optional)</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="space-y-2">
              <Label htmlFor="filter-user">User</Label>
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger id="filter-user">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-library">Library</Label>
              <Select value={filterLibraryId} onValueChange={setFilterLibraryId}>
                <SelectTrigger id="filter-library">
                  <SelectValue placeholder="All libraries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All libraries</SelectItem>
                  {libraries.map((library) => (
                    <SelectItem key={library.id} value={library.id}>
                      {library.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-media-type">Media Type</Label>
              <Select
                value={filterMediaType || '__all__'}
                onValueChange={(value) =>
                  setFilterMediaType(value === '__all__' ? undefined : value as 'movie' | 'show' | 'music' | 'photo')
                }
              >
                <SelectTrigger id="filter-media-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  <SelectItem value="movie">Movies</SelectItem>
                  <SelectItem value="show">TV Shows</SelectItem>
                  <SelectItem value="music">Music</SelectItem>
                  <SelectItem value="photo">Photos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="template">Message Template</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEnabled(!enabled);
              }}
            >
              {enabled ? (
                <span className="text-green-600">Rule enabled</span>
              ) : (
                <span className="text-muted-foreground">Rule disabled</span>
              )}
            </Button>
          </div>
          <div className="space-y-2">
            <textarea
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Enter your message template..."
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            />
            {availableVars.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Label className="text-xs text-muted-foreground">Available variables:</Label>
                {availableVars.map((variable) => (
                  <Badge
                    key={variable}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => insertVariable(variable)}
                  >
                    {variable}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Click on a variable to insert it into the template. Variables will be replaced with actual values when the notification is sent.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !notifierId}>
            <Save className="h-4 w-4 mr-2" />
            Save Rule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
