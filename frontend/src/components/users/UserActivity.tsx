import { UserStats } from '@/api/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, Play } from 'lucide-react';

interface UserActivityProps {
  stats: UserStats;
}

const DAY_COLORS = {
  0: '#ef4444', // Sunday - red
  1: '#f97316', // Monday - orange
  2: '#eab308', // Tuesday - yellow
  3: '#22c55e', // Wednesday - green
  4: '#3b82f6', // Thursday - blue
  5: '#8b5cf6', // Friday - purple
  6: '#ec4899', // Saturday - pink
};

export default function UserActivity({ stats }: UserActivityProps) {
  const totalPlaysByDay = stats.plays_by_day.reduce((sum, d) => sum + d.plays, 0);
  const totalWatchTimeByDay = stats.plays_by_day.reduce((sum, d) => sum + d.watch_time, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity by Day of Week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Play className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs text-muted-foreground">Total Plays</p>
                <p className="text-lg font-semibold">{totalPlaysByDay}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-xs text-muted-foreground">Total Watch Time</p>
                <p className="text-lg font-semibold">
                  {Math.floor(totalWatchTimeByDay / 3600)}h
                </p>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.plays_by_day}>
                <XAxis
                  dataKey="day_name"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="plays"
                  name="Plays"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Day List */}
          <div className="space-y-2">
            {stats.plays_by_day.map((day) => (
              <div
                key={day.day}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: DAY_COLORS[day.day as keyof typeof DAY_COLORS] }}
                  />
                  <span className="font-medium">{day.day_name}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{day.plays}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{Math.floor(day.watch_time / 60)}m</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
