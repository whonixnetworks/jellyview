import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getUserDetail,
  getUserStats,
  getUserDevices,
  getUserHistoryPaginated,
  getUserLibraryActivity,
} from '@/api/users';
import { UserDetail as UserDetailType, UserStats, UserDevice, UserLibraryActivity } from '@/api/users';
import { formatWatchTime, getUserInitials } from '@/api/users';
import UserActivity from '@/components/users/UserActivity';
import UserDeviceList from '@/components/users/UserDeviceList';
import { formatDurationShort } from '@/api/history';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Film, Shield } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = parseInt(id || '0');

  const [user, setUser] = useState<UserDetailType | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [libraryActivity, setLibraryActivity] = useState<UserLibraryActivity[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      loadUserDetail();
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadHistory(historyPage);
    }
  }, [userId, historyPage]);

  async function loadUserDetail() {
    try {
      setLoading(true);
      const [userData, statsData, devicesData, libraryData] = await Promise.all([
        getUserDetail(userId),
        getUserStats(userId),
        getUserDevices(userId),
        getUserLibraryActivity(userId),
      ]);

      setUser(userData);
      setStats(statsData);
      setDevices(devicesData);
      setLibraryActivity(libraryData);
    } catch (error) {
      console.error('Failed to load user detail:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(page: number) {
    try {
      setHistoryLoading(true);
      const response = await getUserHistoryPaginated(userId, { page, limit: 10 });
      setHistory(response.items);
      setHistoryTotal(response.total);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  // Prepare chart data
  const watchTimeData = stats?.plays_over_time.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    watchTime: Math.round(item.watch_time / 3600), // Convert to hours
  })) || [];

  const playsByDayData = stats?.plays_by_day.map((item) => ({
    day: item.day_name.substring(0, 3),
    plays: item.plays,
    watchTime: Math.round(item.watch_time / 60), // Convert to minutes
  })) || [];

  const deviceData = stats?.plays_by_hour.map((item) => ({
    hour: `${item.hour}:00`,
    plays: item.plays,
  })) || [];

  const libraryPieData = libraryActivity.map((lib) => ({
    name: lib.library_name,
    value: lib.total_plays,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/users')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.avatar_url} alt={user.username} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {getUserInitials(user.username)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">{user.username}</h1>
              {user.is_admin && (
                <Badge variant="secondary">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Member since {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-6 w-full sm:w-auto">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold">{user.total_plays}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Plays</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold">{Math.floor(user.total_watch_time / 3600)}h</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Watch Time</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold">{user.total_items_watched || 0}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Items Watched</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Session */}
      {user.active_session && (
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="font-medium">Currently watching</p>
                <p className="text-sm text-muted-foreground">{user.active_session.item_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watch Time Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Watch Time Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-56 lg:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={watchTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="watchTime"
                    name="Watch Time (hours)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plays by Day of Week */}
        <Card>
          <CardHeader>
            <CardTitle>Plays by Day of Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-56 lg:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={playsByDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="plays" name="Plays" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Library Activity Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-56 lg:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={libraryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={{ fontSize: 10 }}
                  >
                    {libraryPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hourly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Activity by Hour of Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-56 lg:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="plays" name="Plays" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Detailed Views */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto min-h-[44px]">
          <TabsTrigger value="activity" className="min-h-[44px]">Activity</TabsTrigger>
          <TabsTrigger value="history" className="min-h-[44px]">Watch History</TabsTrigger>
          <TabsTrigger value="top" className="min-h-[44px]">Top Media</TabsTrigger>
          <TabsTrigger value="devices" className="min-h-[44px]">Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <UserActivity stats={stats!} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Watch History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Library</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.item_name}</TableCell>
                          <TableCell>{record.library.name}</TableCell>
                          <TableCell>{formatDurationShort(record.duration)}</TableCell>
                          <TableCell>
                            {new Date(record.started_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {historyTotal > 10 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
                  <p className="text-sm text-muted-foreground text-center sm:text-left">
                    Showing {((historyPage - 1) * 10) + 1} to {Math.min(historyPage * 10, historyTotal)} of {historyTotal} entries
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                      className="min-h-[44px] touch-target"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => p + 1)}
                      disabled={historyPage * 10 >= historyTotal}
                      className="min-h-[44px] touch-target"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Watched Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.top_items && stats.top_items.length > 0 ? (
                  stats.top_items.map((item) => (
                    <div
                      key={item.item_id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {item.poster_url && (
                        <img
                          src={item.poster_url}
                          alt={item.name}
                          className="w-12 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.item_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{item.plays} plays</p>
                        <p className="text-sm text-muted-foreground">
                          {formatWatchTime(item.watch_time)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No watch data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <UserDeviceList devices={devices} />

          {/* Library Activity Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Library Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {libraryActivity.map((activity) => (
                  <div
                    key={activity.library_id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Film className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{activity.library_name}</h4>
                        <p className="text-sm text-muted-foreground">{activity.item_count} items</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{activity.total_plays} plays</p>
                      <p className="text-sm text-muted-foreground">
                        {formatWatchTime(activity.total_watch_time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
