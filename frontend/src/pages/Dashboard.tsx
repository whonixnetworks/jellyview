import { useState, useEffect } from 'react';
import {
  Play,
  Clock,
  Users,
  Film,
  TrendingUp,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorAlert } from '@/components/ui/Alerts';
import StatCard from '@/components/dashboard/StatCard';
import ActiveSessionCard from '@/components/dashboard/ActiveSessionCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TopStats from '@/components/dashboard/TopStats';
import {
  getHistoryStats,
  listHistory,
  getHistoryStatsByDay,
  getHistoryStatsByDevice,
  HistoryStatsByDay,
  HistoryStatsByDevice,
  HistoryRecord,
} from '@/api/history';
import { listSessions, Session } from '@/api/sessions';
import { getTopUsersByWatchTime, User } from '@/api/users';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type TimeRange = '7d' | '30d';

interface TopItem {
  id: number;
  name: string;
  item_type: string;
  poster_url?: string;
  plays: number;
  watch_time: number;
  year?: number;
  series_name?: string;
  season_number?: number;
  episode_number?: number;
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [playsOverTime, setPlaysOverTime] = useState<HistoryStatsByDay[]>([]);
  const [recentActivity, setRecentActivity] = useState<HistoryRecord[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [deviceBreakdown, setDeviceBreakdown] = useState<HistoryStatsByDevice[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  async function loadDashboardData() {
    setIsLoading(true);
    setError(null);

    try {
      const days = timeRange === '7d' ? 7 : 30;

      // Load stats
      const [statsData, playsData, recentData, sessionsData, usersData, devicesData] =
        await Promise.all([
          getHistoryStats(),
          getHistoryStatsByDay({ days }),
          listHistory({ limit: 10, sort_by: 'started_at', sort_order: 'desc' }),
          listSessions(),
          getTopUsersByWatchTime(5),
          getHistoryStatsByDevice(),
        ]);

      setStats(statsData);
      setPlaysOverTime(playsData);
      setRecentActivity(recentData.items || []);
      setActiveSessions(sessionsData || []);
      setTopUsers(usersData || []);
      setDeviceBreakdown(devicesData || []);

      // Calculate top items from recent history (temporary solution)
      const itemStats = new Map<number, TopItem>();
      for (const record of recentData.items || []) {
        const existing = itemStats.get(record.item.id);
        if (existing) {
          existing.plays++;
          existing.watch_time += record.duration;
        } else {
          itemStats.set(record.item.id, {
            id: record.item.id,
            name: record.item.name,
            item_type: record.item.item_type,
            poster_url: record.item.poster_url,
            plays: 1,
            watch_time: record.duration,
            year: record.item.year,
            series_name: record.series_name,
            season_number: record.season_number,
            episode_number: record.episode_number,
          });
        }
      }
      setTopItems(Array.from(itemStats.values()).sort((a, b) => b.plays - a.plays).slice(0, 5));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard data. Please check your connection and try again.';
      setError(errorMessage);
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const watchTimeHours = stats ? Math.round(stats.total_watch_time / 3600) : 0;
  const chartData = playsOverTime.map((day) => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    plays: day.plays,
    watchTime: Math.round(day.watch_time / 60), // Convert to minutes
  }));

  const deviceColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#8dd1e1', '#d0ed57'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your Jellyfin server activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <ErrorAlert
          title="Unable to load dashboard"
          message={error}
          onRetry={loadDashboardData}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Plays"
          value={stats?.total_plays ?? 0}
          icon={Play}
          isLoading={isLoading}
        />
        <StatCard
          label="Watch Time"
          value={`${watchTimeHours}h`}
          icon={Clock}
          isLoading={isLoading}
        />
        <StatCard
          label="Active Users"
          value={stats?.total_users ?? 0}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          label="Media Items"
          value={stats?.total_items ?? 0}
          icon={Film}
          isLoading={isLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plays Over Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Plays Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading...</div>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} className="h-[200px] sm:h-[250px] lg:h-[300px]">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: 'currentColor', fontSize: 10 }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: 'currentColor', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--card-foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="plays"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Plays"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Device Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading...</div>
                </div>
              ) : deviceBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} className="h-[200px] sm:h-[250px] lg:h-[300px]">
                  <PieChart>
                    <Pie
                      data={deviceBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ client, device, plays }) => {
                        const isMobile = window.innerWidth < 640;
                        return isMobile ? `${plays}` : `${client} ${device} (${plays})`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="plays"
                    >
                      {deviceBreakdown.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={deviceColors[index % deviceColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--card-foreground))',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Active Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeSessions.slice(0, 3).map((session) => (
                  <ActiveSessionCard key={session.id} session={session} />
                ))}
                {activeSessions.length > 3 && (
                  <div className="text-center">
                    <Button variant="outline" size="sm" className="w-full">
                      View All ({activeSessions.length})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <RecentActivity activities={recentActivity} isLoading={isLoading} maxItems={5} />
        </div>
      </div>

      {/* Top Stats */}
      <TopStats
        topUsers={topUsers}
        topItems={topItems}
        isLoading={isLoading}
      />
    </div>
  );
}
