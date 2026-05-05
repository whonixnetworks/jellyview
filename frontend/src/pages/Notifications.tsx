import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import NotifierCard, { NotifierConfig, NotifierType } from '@/components/notifications/NotifierCard';
import EventRuleEditor, { EventRule } from '@/components/notifications/EventRuleEditor';
import NotificationLog, { NotificationLogEntry } from '@/components/notifications/NotificationLog';
import { listNotifiers, createNotifier as apiCreateNotifier, updateNotifier as apiUpdateNotifier, deleteNotifier as apiDeleteNotifier, testNotifier as apiTestNotifier } from '@/api/notifications';
import { listRules, createRule as apiCreateRule, updateRule as apiUpdateRule, deleteRule as apiDeleteRule, NotificationRule } from '@/api/notifications';
import { Plus, Bell, Settings, History } from 'lucide-react';

export default function Notifications() {
  // Notifiers state
  const [notifiers, setNotifiers] = useState<NotifierConfig[]>([]);

  const [addingNotifier, setAddingNotifier] = useState(false);
  const [newNotifierType, setNewNotifierType] = useState<NotifierType>('telegram');
  const [editingNotifier, setEditingNotifier] = useState<string | null>(null);
  const [testingNotifier, setTestingNotifier] = useState<string | null>(null);

  // Rules state
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [addingRule, setAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [testingRule, setTestingRule] = useState<number | null>(null);

  // Logs state
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);

  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch notifiers from backend on mount
  useEffect(() => {
    async function fetchNotifiers() {
      try {
        const data = await listNotifiers();
        setNotifiers(data.map((n: any) => ({
          id: n.id?.toString() || '',
          name: n.name || 'Unnamed',
          type: (n.notifier_type || n.type) as NotifierType,
          enabled: n.is_enabled ?? n.enabled ?? true,
          config: n.config || {},
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        })));
      } catch (error) {
        console.error('Failed to fetch notifiers:', error);
      }
    }
    fetchNotifiers();
  }, []);

  // Fetch rules from backend on mount (and when notifiers change, to resolve names)
  useEffect(() => {
    async function fetchRules() {
      try {
        const data = await listRules();
        setRules(data);
      } catch (error) {
        console.error('Failed to fetch rules:', error);
      }
    }
    fetchRules();
  }, []);

  // Mock data for select dropdowns
  const mockUsers = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
  ];

  const mockLibraries = [
    { id: '1', name: 'Movies' },
    { id: '2', name: 'TV Shows' },
    { id: '3', name: 'Music' },
  ];

  // Notifier handlers
  const handleAddNotifier = async () => {
    try {
      const newNotifierData = await apiCreateNotifier({
        name: `New ${newNotifierType} Notifier`,
        type: newNotifierType,
        config: {},
        enabled: true,
      });
      const newNotifier: NotifierConfig = {
        id: newNotifierData.id.toString(),
        name: newNotifierData.name,
        type: newNotifierData.type as NotifierType,
        enabled: newNotifierData.enabled,
        config: newNotifierData.config,
        createdAt: newNotifierData.created_at,
        updatedAt: newNotifierData.updated_at,
      };
      setNotifiers([...notifiers, newNotifier]);
      setAddingNotifier(false);
      setEditingNotifier(newNotifier.id);
    } catch (error) {
      console.error('Failed to create notifier:', error);
      alert('Failed to create notifier');
    }
  };

  const handleToggleNotifier = async (id: string) => {
    const notifier = notifiers.find((n) => n.id === id);
    if (!notifier) return;
    const newEnabled = !notifier.enabled;
    // Optimistic UI update
    setNotifiers(notifiers.map((n) => (n.id === id ? { ...n, enabled: newEnabled } : n)));
    try {
      await apiUpdateNotifier(parseInt(id), {
        enabled: newEnabled,
      });
    } catch (error) {
      console.error('Failed to toggle notifier:', error);
      // Revert on failure
      setNotifiers(notifiers.map((n) => (n.id === id ? { ...n, enabled: !newEnabled } : n)));
      alert('Failed to toggle notifier');
    }
  };

  const handleEditNotifier = (notifier: NotifierConfig) => {
    setEditingNotifier(notifier.id);
  };

  const handleDeleteNotifier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notifier?')) return;
    try {
      await apiDeleteNotifier(parseInt(id));
      setNotifiers(notifiers.filter((n) => n.id !== id));
      // Also remove rules that reference this notifier
      setRules(rules.filter((r) => r.notifier_id !== parseInt(id)));
    } catch (error) {
      console.error('Failed to delete notifier:', error);
      alert('Failed to delete notifier');
    }
  };

  const handleTestNotifier = async (id: string) => {
    setTestingNotifier(id);
    try {
      const result = await apiTestNotifier(parseInt(id));
      if (result.success) {
        alert('Test notification sent successfully!');
      } else {
        alert(`Test failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to test notifier:', error);
      alert('Failed to send test notification');
    } finally {
      setTestingNotifier(null);
    }
  };

  const handleSaveNotifier = async (notifier: NotifierConfig) => {
    try {
      await apiUpdateNotifier(parseInt(notifier.id), {
        name: notifier.name,
        type: notifier.type as NotifierType,
        config: notifier.config,
        enabled: notifier.enabled,
      });
      setNotifiers(notifiers.map((n) => (n.id === notifier.id ? notifier : n)));
      setEditingNotifier(null);
    } catch (error) {
      console.error('Failed to save notifier:', error);
      alert('Failed to save notifier');
    }
  };

  const handleCancelEditNotifier = () => {
    setEditingNotifier(null);
  };

  // Rule handlers
  const handleSaveRule = async (rule: Omit<EventRule, 'id'>) => {
    try {
      const createdRule = await apiCreateRule({
        name: rule.name,
        event_type: rule.eventType,
        notifier_id: parseInt(rule.notifierId),
        enabled: rule.enabled,
        filters: {
          user_id: rule.filters?.userId ? parseInt(rule.filters.userId) : undefined,
          library_id: rule.filters?.libraryId ? parseInt(rule.filters.libraryId) : undefined,
          media_type: rule.filters?.mediaType,
        },
        template: rule.template,
      });
      setRules([...rules, createdRule]);
      setAddingRule(false);
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert('Failed to create rule. Please try again.');
    }
  };

  const handleUpdateRule = async (rule: NotificationRule) => {
    try {
      const updatedRule = await apiUpdateRule(rule.id, {
        name: rule.name,
        event_type: rule.event_type,
        enabled: rule.enabled,
        notifier_id: rule.notifier_id,
        filters: rule.filters,
        template: rule.template,
      });
      setRules(rules.map((r) => (r.id === rule.id ? updatedRule : r)));
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to update rule:', error);
      alert('Failed to update rule');
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await apiDeleteRule(id);
      setRules(rules.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Failed to delete rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleToggleRule = async (id: number) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    const newEnabled = !rule.enabled;
    // Optimistic UI update
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: newEnabled } : r)));
    try {
      await apiUpdateRule(id, { enabled: newEnabled });
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      // Revert on failure
      setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !newEnabled } : r)));
      alert('Failed to toggle rule');
    }
  };

  const handleTestRule = async (id: number) => {
    setTestingRule(id);
    try {
      const response = await fetch(`/api/notifications/rules/${id}/test`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert('Test notification sent successfully!');
      } else {
        alert(`Test failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to test rule:', error);
      alert('Failed to send test notification');
    } finally {
      setTestingRule(null);
    }
  };

  // Convert a NotificationRule to an EventRule for the editor
  const ruleToEventRule = (rule: NotificationRule): EventRule => ({
    id: rule.id.toString(),
    name: rule.name || rule.event_type,
    eventType: rule.event_type,
    notifierId: rule.notifier_id.toString(),
    enabled: rule.enabled,
    filters: rule.filters ? {
      userId: rule.filters.user_id?.toString(),
      libraryId: rule.filters.library_id?.toString(),
      mediaType: rule.filters.media_type as 'movie' | 'show' | 'music' | 'photo' | undefined,
    } : undefined,
    template: rule.template,
  });

  // Log handlers
  const handleRetryLog = (id: string) => {
    setLogs(
      logs.map((log) =>
        log.id === id
          ? {
              ...log,
              status: 'retrying' as const,
              retryCount: (log.retryCount || 0) + 1,
            }
          : log
      )
    );
    setTimeout(() => {
      setLogs(
        logs.map((log) => (log.id === id ? { ...log, status: 'sent' as const } : log))
      );
    }, 2000);
  };

  const handleDeleteLog = (id: string) => {
    setLogs(logs.filter((l) => l.id !== id));
  };

  const handleRefreshLogs = () => {
    setLoadingLogs(true);
    setTimeout(() => {
      setLoadingLogs(false);
    }, 1000);
  };

  const handleExportLogs = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Notifications</h1>
        <p className="text-muted-foreground">
          Configure notification notifiers, event rules, and view notification logs
        </p>
      </div>

      <Tabs defaultValue="notifiers" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
          <TabsTrigger value="notifiers" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifiers
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings className="h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-2">
            <History className="h-4 w-4" />
            Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifiers" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Notifiers</h2>
              <p className="text-sm text-muted-foreground">
                Configure where notifications are sent
              </p>
            </div>
            <Dialog open={addingNotifier} onOpenChange={setAddingNotifier}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Notifier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Notifier</DialogTitle>
                  <DialogDescription>
                    Choose the type of notifier you want to add
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notifier-type">Notifier Type</Label>
                    <Select
                      value={newNotifierType}
                      onValueChange={(value) => setNewNotifierType(value as NotifierType)}
                    >
                      <SelectTrigger id="notifier-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="telegram">
                          <div className="flex items-center gap-2">
                            <span>📱</span>
                            <span>Telegram Bot</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="discord">
                          <div className="flex items-center gap-2">
                            <span>💬</span>
                            <span>Discord Webhook</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <span>📧</span>
                            <span>Email</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="webhook">
                          <div className="flex items-center gap-2">
                            <span>🔗</span>
                            <span>Custom Webhook</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="pushover">
                          <div className="flex items-center gap-2">
                            <span>📲</span>
                            <span>Pushover</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddingNotifier(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddNotifier}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {notifiers.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Notifiers Configured</h3>
              <p className="text-muted-foreground mb-4">
                Add a notifier to start receiving notifications
              </p>
              <Button onClick={() => setAddingNotifier(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Notifier
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notifiers.map((notifier) => (
                <NotifierCard
                  key={notifier.id}
                  notifier={notifier}
                  onToggle={handleToggleNotifier}
                  onEdit={handleEditNotifier}
                  onDelete={handleDeleteNotifier}
                  onTest={handleTestNotifier}
                  isTesting={testingNotifier === notifier.id}
                  isEditing={editingNotifier === notifier.id}
                  onSave={handleSaveNotifier}
                  onCancel={handleCancelEditNotifier}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Event Rules</h2>
              <p className="text-sm text-muted-foreground">
                Define when notifications are sent
              </p>
            </div>
            <Button onClick={() => setAddingRule(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          {addingRule && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <EventRuleEditor
                notifiers={notifiers.map((n) => ({ id: n.id, name: n.name, type: n.type }))}
                onSave={handleSaveRule}
                onCancel={() => setAddingRule(false)}
                users={mockUsers}
                libraries={mockLibraries}
              />
            </div>
          )}

          {editingRule !== null && (() => {
            const rule = rules.find((r) => r.id === editingRule);
            if (!rule) return null;
            const eventRule = ruleToEventRule(rule);
            return (
              <div className="border rounded-lg p-4 bg-muted/50">
                <EventRuleEditor
                  rule={eventRule}
                  notifiers={notifiers.map((n) => ({ id: n.id, name: n.name, type: n.type }))}
                  onSave={async (updatedRule) => {
                    await handleUpdateRule({
                      ...rule,
                      name: updatedRule.name,
                      event_type: updatedRule.eventType,
                      notifier_id: parseInt(updatedRule.notifierId),
                      enabled: updatedRule.enabled,
                      filters: updatedRule.filters ? {
                        user_id: updatedRule.filters.userId ? parseInt(updatedRule.filters.userId) : undefined,
                        library_id: updatedRule.filters.libraryId ? parseInt(updatedRule.filters.libraryId) : undefined,
                        media_type: updatedRule.filters.mediaType,
                      } : undefined,
                      template: updatedRule.template,
                    });
                  }}
                  onCancel={() => setEditingRule(null)}
                  users={mockUsers}
                  libraries={mockLibraries}
                />
              </div>
            );
          })()}

          {rules.length === 0 && !addingRule ? (
            <div className="text-center py-12 border rounded-lg">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rules Configured</h3>
              <p className="text-muted-foreground mb-4">
                Create rules to define when notifications should be sent
              </p>
              <Button onClick={() => setAddingRule(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => {
                const notifier = notifiers.find((n) => n.id === rule.notifier_id?.toString());
                return (
                  <div
                    key={rule.id}
                    className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{rule.name || rule.event_type}</h3>
                          {rule.enabled ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline" className="capitalize">
                            {rule.event_type.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="outline">
                            → {notifier?.name || 'Unknown Notifier'}
                          </Badge>
                        </div>
                        {rule.filters && (rule.filters.user_id || rule.filters.library_id || rule.filters.media_type) && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {rule.filters.user_id && (
                              <Badge variant="secondary">User: {rule.filters.user_id}</Badge>
                            )}
                            {rule.filters.library_id && (
                              <Badge variant="secondary">Library: {rule.filters.library_id}</Badge>
                            )}
                            {rule.filters.media_type && (
                              <Badge variant="secondary" className="capitalize">
                                Type: {rule.filters.media_type}
                              </Badge>
                            )}
                          </div>
                        )}
                        {rule.template && (
                          <div className="bg-muted p-3 rounded-md">
                            <p className="text-sm font-medium mb-1">Message Template:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {rule.template}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestRule(rule.id)}
                          disabled={testingRule === rule.id}
                        >
                          {testingRule === rule.id ? 'Testing...' : 'Test'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleRule(rule.id)}
                        >
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRule(rule.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Notification Log</h2>
            <p className="text-sm text-muted-foreground">
              View history of sent notifications and retry failed ones
            </p>
          </div>

          <NotificationLog
            logs={logs}
            onRetry={handleRetryLog}
            onDelete={handleDeleteLog}
            onRefresh={handleRefreshLogs}
            onExport={handleExportLogs}
            loading={loadingLogs}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}